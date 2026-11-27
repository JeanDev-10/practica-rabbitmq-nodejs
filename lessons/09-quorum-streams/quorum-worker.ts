import { setTimeout as sleep } from 'node:timers/promises';
import { connect } from '../../shared/rabbit.ts';
import { declare, queue } from './quorum-topology.ts';

// Uso: node quorum-worker.ts <reject|nack>   Este worker SIEMPRE falla y reencola.
const mode = process.argv[2] === 'nack' ? 'nack' : 'reject';

const { connection, channel } = await connect();
await declare(channel);
await channel.prefetch(1);

await channel.consume(queue, async (message) => {
  if (!message) return;
  const headers = message.properties.headers ?? {};
  console.log(
    `[!] "${message.content}" falla; fallos previos=${headers['x-delivery-count'] ?? 0}` +
      ` entregas previas=${headers['x-acquired-count'] ?? 0}`,
  );
  await sleep(1000); // para poder seguirlo a simple vista

  if (mode === 'reject') {
    channel.reject(message, true); // cuenta como fallo
  } else {
    channel.nack(message, false, true); // "no lo procesé": no cuenta como fallo
  }
});

console.log(`[*] Worker (${mode}) en "${queue}". Ctrl+C para salir.`);

process.once('SIGINT', async () => {
  await connection.close();
  process.exit(0);
});
