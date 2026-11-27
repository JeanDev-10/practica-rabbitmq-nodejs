import { connect } from '../../shared/rabbit.ts';

const stream = 'leccion09.stream';
// Uso: node stream-consumer.ts [first|last|next|<número de offset>]
const arg = process.argv[2] ?? 'first';
const offset = /^\d+$/.test(arg) ? Number(arg) : arg;

const { connection, channel } = await connect();
await channel.assertQueue(stream, {
  durable: true,
  arguments: { 'x-queue-type': 'stream', 'x-max-age': '1h' },
});

// En un stream el prefetch es obligatorio.
await channel.prefetch(100);

await channel.consume(
  stream,
  (message) => {
    if (!message) return;
    const position = message.properties.headers?.['x-stream-offset'];
    console.log(`[offset ${position}] ${message.content.toString()}`);
    // El ack no borra nada: solo permite que sigan llegando mensajes.
    channel.ack(message);
  },
  { noAck: false, arguments: { 'x-stream-offset': offset } },
);

console.log(`[*] Leyendo "${stream}" desde ${arg}. Ctrl+C para salir.`);

process.once('SIGINT', async () => {
  await connection.close();
  process.exit(0);
});
