import { connect } from '../../shared/rabbit.ts';
import { declare, delays, queue, retryQueue } from './topology.ts';

/** Error que no se arregla reintentando. */
class PermanentError extends Error {}

// Simula el trabajo. `attempt` empieza en 1.
function process_(task: string, attempt: number) {
  if (task === 'ok') return;
  if (task === 'temporal') {
    if (attempt < 3) throw new Error('el servicio externo no responde');
    return;
  }
  if (task === 'siempre') throw new Error('el servicio externo sigue caído');
  throw new PermanentError(`tarea desconocida: "${task}"`);
}

const { connection } = await connect();
const channel = await connection.createConfirmChannel();
channel.on('error', (err) => console.error('Error de canal:', err.message));
await declare(channel);
await channel.prefetch(1);

await channel.consume(queue, async (message) => {
  if (!message) return;
  const task = message.content.toString();
  const retries = Number(message.properties.headers?.['x-reintentos'] ?? 0);
  const attempt = retries + 1;
  const time = new Date().toLocaleTimeString('es');

  try {
    process_(task, attempt);
    console.log(`${time} [ok] "${task}" en el intento ${attempt}`);
    channel.ack(message);
  } catch (error) {
    const reason = (error as Error).message;
    const delay = delays[retries];

    if (error instanceof PermanentError || delay === undefined) {
      console.log(`${time} [dlq] "${task}" intento ${attempt}: ${reason}`);
      channel.nack(message, false, false); // requeue=false → dead letter exchange
      return;
    }

    console.log(`${time} [reintento] "${task}" intento ${attempt}: ${reason}. Espera ${delay / 1000} s`);
    channel.sendToQueue(retryQueue(delay), message.content, {
      persistent: true,
      messageId: message.properties.messageId,
      headers: { 'x-reintentos': attempt },
    });
    // Primero se asegura la copia y después se borra el original.
    // Si algo falla en medio habrá un duplicado, nunca una pérdida.
    await channel.waitForConfirms();
    channel.ack(message);
  }
});

console.log(`[*] Esperando tareas en "${queue}". Ctrl+C para salir.`);

process.once('SIGINT', async () => {
  await connection.close();
  process.exit(0);
});
