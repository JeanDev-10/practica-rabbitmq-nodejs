import { connect } from '../../shared/rabbit.ts';

const queue = 'leccion01.hola';

const { connection, channel } = await connect();
await channel.assertQueue(queue, { durable: true });

await channel.consume(queue, (message) => {
  if (!message) return; // null = el broker canceló el consumidor
  console.log(`[x] Recibido: "${message.content.toString()}"`);
  channel.ack(message); // "ya lo procesé, puedes borrarlo"
});

console.log(`[*] Esperando mensajes en "${queue}". Ctrl+C para salir.`);

process.once('SIGINT', async () => {
  await connection.close();
  process.exit(0);
});
