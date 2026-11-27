import type { Channel } from 'amqplib';

export const exchange = 'proyecto.eventos';
const deadExchange = 'proyecto.dlx';
const deadQueue = 'proyecto.fallidas';

export type EventType =
  | 'pedido.creado'
  | 'stock.reservado'
  | 'stock.insuficiente'
  | 'pago.aprobado'
  | 'pago.rechazado'
  | 'pedido.confirmado'
  | 'pedido.cancelado';

export interface EventData {
  pedidoId: string;
  producto?: string;
  cantidad?: number;
  total?: number;
  motivo?: string;
}

/** Una cola por servicio y los eventos que le interesan. */
export const queues = {
  inventario: { name: 'proyecto.inventario', events: ['pedido.creado', 'pago.rechazado'] },
  pagos: { name: 'proyecto.pagos', events: ['stock.reservado'] },
  pedidos: {
    name: 'proyecto.pedidos',
    events: ['stock.insuficiente', 'pago.aprobado', 'pago.rechazado'],
  },
  notificaciones: {
    name: 'proyecto.notificaciones',
    events: ['pedido.confirmado', 'pedido.cancelado'],
  },
} satisfies Record<string, { name: string; events: EventType[] }>;

export type Service = keyof typeof queues;

/**
 * Todos los procesos declaran la topología completa: así ningún evento se queda sin cola
 * porque su consumidor todavía no haya arrancado.
 */
export async function declare(channel: Channel) {
  await channel.assertExchange(exchange, 'topic', { durable: true });
  await channel.assertExchange(deadExchange, 'fanout', { durable: true });
  await channel.assertQueue(deadQueue, { durable: true });
  await channel.bindQueue(deadQueue, deadExchange, '');

  for (const { name, events } of Object.values(queues)) {
    await channel.assertQueue(name, {
      durable: true,
      deadLetterExchange: deadExchange,
      arguments: { 'x-queue-type': 'quorum', 'x-delivery-limit': 5 },
    });
    for (const event of events) await channel.bindQueue(name, exchange, event);
  }
}
