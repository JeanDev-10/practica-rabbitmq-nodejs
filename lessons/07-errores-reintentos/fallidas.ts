import type { GetMessage } from 'amqplib';
import { connect } from '../../shared/rabbit.ts';
import { deadQueue, declare, queue } from './topology.ts';

// Uso: node fallidas.ts [--reprocesar]
const replay = process.argv.includes('--reprocesar');

const { connection } = await connect();
const channel = await connection.createConfirmChannel();
await declare(channel);

// Se leen todas antes de actuar. Sin ack, siguen perteneciendo a la cola.
const messages: GetMessage[] = [];
let next = await channel.get(deadQueue);
while (next) {
  messages.push(next);
  next = await channel.get(deadQueue);
}

console.log(`${messages.length} mensaje(s) en ${deadQueue}`);

for (const message of messages) {
  const death = message.properties.headers?.['x-death']?.[0];
  const retries = message.properties.headers?.['x-reintentos'] ?? 0;
  console.log(`- "${message.content}" motivo=${death?.reason} reintentos=${retries}`);

  if (replay) {
    // Vuelve a la cola principal con el contador a cero.
    channel.sendToQueue(queue, message.content, {
      persistent: true,
      messageId: message.properties.messageId,
    });
    await channel.waitForConfirms();
    channel.ack(message);
  }
}

if (replay) console.log('Reenviadas a la cola principal.');

// Al cerrar, lo que quedó sin ack vuelve a la cola de fallidas.
await channel.close();
await connection.close();
