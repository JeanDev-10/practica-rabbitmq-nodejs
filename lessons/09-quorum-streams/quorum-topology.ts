import type { Channel } from 'amqplib';

export const queue = 'leccion09.quorum';
export const deadExchange = 'leccion09.dlx';
export const deadQueue = 'leccion09.fallidas';

export async function declare(channel: Channel) {
  await channel.assertExchange(deadExchange, 'fanout', { durable: true });
  await channel.assertQueue(deadQueue, { durable: true });
  await channel.bindQueue(deadQueue, deadExchange, '');

  // El tipo de cola se fija al crearla y no se puede cambiar después.
  await channel.assertQueue(queue, {
    durable: true,
    deadLetterExchange: deadExchange,
    arguments: {
      'x-queue-type': 'quorum',
      'x-delivery-limit': 3, // reentregas fallidas permitidas (por defecto 20)
    },
  });
}
