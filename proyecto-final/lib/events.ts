import type { Channel } from 'amqplib';

export const exchange = 'proyecto.eventos';
const deadExchange = 'proyecto.dlx';
export const deadQueue = 'proyecto.fallidas';

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

/** Espera antes de cada reintento, en milisegundos. */
export const delays = [2000, 4000, 8000];
export const retryExchange = (service: Service) => `proyecto.${service}.reintentos`;
export const retryQueue = (service: Service, delay: number) =>
  `proyecto.${service}.reintento.${delay}`;

/**
 * Crea toda la topología. Solo la ejecuta `preparar.ts` con un usuario administrador:
 * los servicios no tienen permiso para declarar nada.
 */
export async function declare(channel: Channel) {
  await channel.assertExchange(exchange, 'topic', { durable: true });
  await channel.assertExchange(deadExchange, 'fanout', { durable: true });
  await channel.assertQueue(deadQueue, { durable: true });
  await channel.bindQueue(deadQueue, deadExchange, '');

  for (const service of Object.keys(queues) as Service[]) {
    const { name, events } = queues[service];
    await channel.assertQueue(name, {
      durable: true,
      deadLetterExchange: deadExchange,
      arguments: { 'x-queue-type': 'quorum', 'x-delivery-limit': 5 },
    });
    for (const event of events) await channel.bindQueue(name, exchange, event);

    // Colas de espera sin consumidores: al vencer el TTL, el mensaje vuelve a su servicio.
    await channel.assertExchange(retryExchange(service), 'direct', { durable: true });
    for (const delay of delays) {
      await channel.assertQueue(retryQueue(service, delay), {
        durable: true,
        messageTtl: delay,
        deadLetterExchange: '',
        deadLetterRoutingKey: name,
        arguments: {
          'x-queue-type': 'quorum',
          // El mensaje no sale de aquí hasta que la cola destino lo confirma.
          'x-dead-letter-strategy': 'at-least-once',
          'x-overflow': 'reject-publish',
        },
      });
      await channel.bindQueue(retryQueue(service, delay), retryExchange(service), String(delay));
    }
  }
}
