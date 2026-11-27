import type { Channel } from 'amqplib';

export const exchange = 'leccion11.eventos';
export const queue = 'leccion11.cobros';
export const routingKey = 'pedido.creado';
const deadExchange = 'leccion11.dlx';
const deadQueue = 'leccion11.fallidas';

export async function declare(channel: Channel) {
  await channel.assertExchange(deadExchange, 'fanout', { durable: true });
  await channel.assertQueue(deadQueue, { durable: true });
  await channel.bindQueue(deadQueue, deadExchange, '');

  await channel.assertExchange(exchange, 'topic', { durable: true });
  await channel.assertQueue(queue, {
    durable: true,
    deadLetterExchange: deadExchange,
    arguments: { 'x-queue-type': 'quorum', 'x-delivery-limit': 5 },
  });
  await channel.bindQueue(queue, exchange, routingKey);
}
