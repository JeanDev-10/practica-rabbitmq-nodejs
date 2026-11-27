import { connect } from '../../shared/rabbit.ts';

const exchange = 'leccion05.headers';
// Uso: node headers-subscriber.ts <all|any>
const match = process.argv[2] === 'any' ? 'any' : 'all';

const { connection, channel } = await connect();
await channel.assertExchange(exchange, 'headers', { durable: true });
const { queue } = await channel.assertQueue('', { exclusive: true });

// all = deben coincidir todas las cabeceras; any = basta con una.
await channel.bindQueue(queue, exchange, '', {
  'x-match': match,
  format: 'pdf',
  type: 'reporte',
});

await channel.consume(queue, (message) => {
  if (!message) return;
  console.log(`[${match}] ${message.content.toString()}`);
}, { noAck: true });

console.log(`[*] x-match=${match}, format=pdf, type=reporte. Ctrl+C para salir.`);

process.once('SIGINT', async () => {
  await connection.close();
  process.exit(0);
});
