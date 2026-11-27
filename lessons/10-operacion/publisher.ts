import { setTimeout as sleep } from 'node:timers/promises';
import type { ConfirmChannel } from 'amqplib';
import { connectResilient, queue } from './resilient.ts';

let channel: ConfirmChannel | undefined;
const pending: number[] = []; // en memoria: se pierde si el proceso muere
let next = 0;

const connection = await connectResilient(async (model) => {
  const ch = await model.createConfirmChannel();
  ch.on('error', (err) => console.error('[canal]', err.message));
  ch.on('close', () => {
    if (channel === ch) channel = undefined;
  });
  await ch.assertQueue(queue, { durable: true, arguments: { 'x-queue-type': 'quorum' } });
  channel = ch;
});

// La aplicación genera un evento por segundo, haya broker o no.
const timer = setInterval(() => pending.push(++next), 1000);

let running = true;
process.once('SIGINT', () => (running = false));

while (running) {
  const id = pending[0];
  if (id !== undefined && channel) {
    try {
      channel.sendToQueue(queue, Buffer.from(`evento-${id}`), { persistent: true });
      await channel.waitForConfirms();
      pending.shift(); // solo se descarta cuando el broker lo confirma
      console.log(`[x] confirmado evento-${id} (pendientes: ${pending.length})`);
      continue;
    } catch (err) {
      console.warn(`[!] evento-${id} sin confirmar: ${(err as Error).message}`);
    }
  }
  await sleep(500);
}

clearInterval(timer);
await connection.close();
