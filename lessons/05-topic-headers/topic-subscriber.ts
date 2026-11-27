import { connect } from '../../shared/rabbit.ts';

const exchange = 'leccion05.topic';
// Uso: node topic-subscriber.ts "pedido.*.pe" ["pago.#" ...]
const patterns = process.argv.slice(2);
if (patterns.length === 0) {
  console.error('Indica al menos un patrón, por ejemplo "pedido.#"');
  process.exit(1);
}

const { connection, channel } = await connect();
await channel.assertExchange(exchange, 'topic', { durable: true });
const { queue } = await channel.assertQueue('', { exclusive: true });

for (const pattern of patterns) {
  await channel.bindQueue(queue, exchange, pattern);
}

await channel.consume(queue, (message) => {
  if (!message) return;
  console.log(`[${message.fields.routingKey}] ${message.content.toString()}`);
}, { noAck: true });

console.log(`[*] Patrones: ${patterns.join(', ')}. Ctrl+C para salir.`);

process.once('SIGINT', async () => {
  await connection.close();
  process.exit(0);
});
