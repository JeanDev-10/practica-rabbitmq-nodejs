import type { Channel } from 'amqplib';

export const exchange = 'leccion06.pagos';
export const queue = 'leccion06.cobros';
export const routingKey = 'pago.solicitado';

/** Exchange y cola durables, enlazados. Lo declaran productor y consumidor. */
export async function declare(channel: Channel) {
  await channel.assertExchange(exchange, 'direct', { durable: true });
  await channel.assertQueue(queue, { durable: true });
  await channel.bindQueue(queue, exchange, routingKey);
}
