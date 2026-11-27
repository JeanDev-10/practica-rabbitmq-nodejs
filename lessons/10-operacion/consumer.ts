import { connectResilient, queue } from './resilient.ts';

const connection = await connectResilient(async (model) => {
  const channel = await model.createChannel();
  channel.on('error', (err) => console.error('[canal]', err.message));
  await channel.assertQueue(queue, { durable: true, arguments: { 'x-queue-type': 'quorum' } });
  await channel.prefetch(10);
  await channel.consume(queue, (message) => {
    if (!message) return;
    console.log(`[<] ${message.content.toString()}`);
    channel.ack(message);
  });
  console.log(`[*] Consumiendo "${queue}"`);
});

process.once('SIGINT', async () => {
  await connection.close();
  process.exit(0);
});
