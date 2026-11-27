import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { connect } from '../../shared/rabbit.ts';
import { declare, queue } from './topology.ts';

// Uso: node consumer.ts [--caer]   (--caer: muere después de cobrar y antes del ack)
const crash = process.argv.includes('--caer');

// Hace de "base de datos": una línea por pago cobrado. Sobrevive a reinicios.
const ledger = new URL('./cobros.log', import.meta.url);

function alreadyCharged(id: string) {
  return existsSync(ledger) && readFileSync(ledger, 'utf8').split('\n').includes(id);
}

const { connection, channel } = await connect();
await declare(channel);
await channel.prefetch(1);

await channel.consume(queue, (message) => {
  if (!message) return;
  const id: string | undefined = message.properties.messageId;

  if (!id) {
    console.error('[!] Mensaje sin messageId: se descarta');
    channel.nack(message, false, false);
    return;
  }

  const again = message.fields.redelivered ? ' (REENTREGADO)' : '';

  if (alreadyCharged(id)) {
    console.log(`[=] ${id}${again}: ya estaba cobrado, no se repite`);
    channel.ack(message);
    return;
  }

  // El efecto (cobrar) y la marca de "ya procesado" son la misma escritura.
  appendFileSync(ledger, `${id}\n`);
  console.log(`[$] ${id}${again}: cobrado`);

  if (crash) {
    console.error('[!] Caída simulada antes del ack');
    process.exit(1);
  }

  channel.ack(message);
});

console.log(`[*] Esperando pagos en "${queue}". Ctrl+C para salir.`);

process.once('SIGINT', async () => {
  await connection.close();
  process.exit(0);
});
