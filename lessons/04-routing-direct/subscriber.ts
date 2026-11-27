import { connect } from '../../shared/rabbit.ts';

const exchange = 'leccion04.logs';
// Uso: node subscriber.ts <severidad> [más severidades]
const severities = process.argv.slice(2);
if (severities.length === 0) {
  console.error('Indica al menos una severidad: info, warn, error');
  process.exit(1);
}

const { connection, channel } = await connect();
await channel.assertExchange(exchange, 'direct', { durable: true });
const { queue } = await channel.assertQueue('', { exclusive: true });

// Una misma cola puede tener varios bindings.
for (const severity of severities) {
  await channel.bindQueue(queue, exchange, severity);
}

await channel.consume(queue, (message) => {
  if (!message) return;
  console.log(`[${message.fields.routingKey}] ${message.content.toString()}`);
}, { noAck: true });

console.log(`[*] Escuchando: ${severities.join(', ')}. Ctrl+C para salir.`);

process.once('SIGINT', async () => {
  await connection.close();
  process.exit(0);
});
