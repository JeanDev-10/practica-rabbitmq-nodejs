// Revisión manual de la DLQ. Uso: node fallidas.ts [--reprocesar]
import type { GetMessage } from 'amqplib';
import { connect } from '../shared/rabbit.ts';
import { deadQueue } from './lib/events.ts';

const replay = process.argv.includes('--reprocesar');

const { connection } = await connect(); // administrador
const channel = await connection.createConfirmChannel();

// Se leen todas antes de actuar. Sin ack, siguen perteneciendo a la cola.
const messages: GetMessage[] = [];
let next = await channel.get(deadQueue);
while (next) {
  messages.push(next);
  next = await channel.get(deadQueue);
}

console.log(`${messages.length} mensaje(s) en ${deadQueue}`);

for (const message of messages) {
  // x-death[0] describe la última vez que fue descartado: de qué cola y por qué.
  const death = message.properties.headers?.['x-death']?.[0];
  const origin: string | undefined = death?.queue;
  console.log(
    `- ${message.properties.type ?? '(sin tipo)'} cola=${origin} motivo=${death?.reason} ${message.content}`,
  );

  if (replay && origin) {
    // Directo a la cola que falló (no al exchange): los demás servicios no se enteran.
    channel.sendToQueue(origin, message.content, {
      persistent: true,
      messageId: message.properties.messageId,
      type: message.properties.type,
      contentType: message.properties.contentType,
    });
    await channel.waitForConfirms();
    channel.ack(message);
    console.log(`  reenviado a ${origin}`);
  }
}

// Al cerrar, lo que quedó sin ack vuelve a la cola de fallidas.
await channel.close();
await connection.close();
