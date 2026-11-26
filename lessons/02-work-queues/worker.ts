import { setTimeout as sleep } from 'node:timers/promises';
import { connect } from '../../shared/rabbit.ts';

const queue = 'leccion02.tareas';
// Uso: node worker.ts [nombre] [prefetch]
const name = process.argv[2] ?? 'worker';
const prefetch = Number(process.argv[3] ?? 1);

const { connection, channel } = await connect();
await channel.assertQueue(queue, { durable: true });

// Máximo de mensajes sin confirmar que el broker entrega a este consumidor.
await channel.prefetch(prefetch);

await channel.consume(queue, async (message) => {
  if (!message) return;
  const task = message.content.toString();
  const seconds = task.split('.').length - 1;
  const again = message.fields.redelivered ? ' (REENTREGADA)' : '';

  console.log(`[${name}] empieza ${task}${again}`);
  await sleep(seconds * 1000);
  console.log(`[${name}] termina ${task}`);

  // El ack va DESPUÉS del trabajo: si el proceso muere antes, la tarea no se pierde.
  channel.ack(message);
});

console.log(`[${name}] esperando tareas (prefetch=${prefetch}). Ctrl+C para salir.`);

process.once('SIGINT', async () => {
  // Salida brusca a propósito: lo que no tenga ack vuelve a la cola.
  await connection.close();
  process.exit(0);
});
