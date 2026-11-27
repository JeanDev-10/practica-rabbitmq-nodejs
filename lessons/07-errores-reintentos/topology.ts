import type { Channel } from 'amqplib';

export const queue = 'leccion07.tareas';
export const deadExchange = 'leccion07.dlx';
export const deadQueue = 'leccion07.fallidas';

/** Espera antes de cada reintento, en milisegundos. */
export const delays = [2000, 4000, 8000];
export const retryQueue = (delay: number) => `leccion07.reintento.${delay}`;

export async function declare(channel: Channel) {
  // Destino final de lo que no se pudo procesar.
  await channel.assertExchange(deadExchange, 'fanout', { durable: true });
  await channel.assertQueue(deadQueue, { durable: true });
  await channel.bindQueue(deadQueue, deadExchange, '');

  // Cola principal: lo rechazado sin requeue va al dead letter exchange.
  await channel.assertQueue(queue, { durable: true, deadLetterExchange: deadExchange });

  // Colas de espera sin consumidores: al vencer el TTL, el mensaje vuelve a la principal.
  for (const delay of delays) {
    await channel.assertQueue(retryQueue(delay), {
      durable: true,
      messageTtl: delay,
      deadLetterExchange: '', // exchange por defecto
      deadLetterRoutingKey: queue,
    });
  }
}
