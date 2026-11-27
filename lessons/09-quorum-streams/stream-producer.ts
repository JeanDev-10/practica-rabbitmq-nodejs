import { connect } from '../../shared/rabbit.ts';

const stream = 'leccion09.stream';
// Uso: node stream-producer.ts [cantidad]
const total = Number(process.argv[2] ?? 5);

const { connection } = await connect();
const channel = await connection.createConfirmChannel();
await channel.assertQueue(stream, {
  durable: true,
  arguments: { 'x-queue-type': 'stream', 'x-max-age': '1h' }, // retención
});

for (let i = 1; i <= total; i++) {
  channel.sendToQueue(stream, Buffer.from(`evento-${i} ${new Date().toISOString()}`), {
    persistent: true,
  });
}
await channel.waitForConfirms();
console.log(`[x] ${total} eventos añadidos al stream`);

await channel.close();
await connection.close();
