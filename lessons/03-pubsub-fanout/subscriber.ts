import { connect } from '../../shared/rabbit.ts';

const exchange = 'leccion03.eventos';
const name = process.argv[2] ?? 'suscriptor';

const { connection, channel } = await connect();
await channel.assertExchange(exchange, 'fanout', { durable: true });

// Nombre vacío = el broker inventa uno. exclusive = se borra al cerrar esta conexión.
const { queue } = await channel.assertQueue('', { exclusive: true });
await channel.bindQueue(queue, exchange, '');

await channel.consume(queue, (message) => {
  if (!message) return;
  console.log(`[${name}] ${message.content.toString()}`);
}, { noAck: true }); // sin ack: se da por entregado al enviarlo

console.log(`[${name}] escuchando en la cola ${queue}. Ctrl+C para salir.`);

process.once('SIGINT', async () => {
  await connection.close();
  process.exit(0);
});
