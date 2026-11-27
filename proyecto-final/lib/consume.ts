import { setTimeout as sleep } from 'node:timers/promises';
import type pg from 'pg';
import { connect } from '../../shared/rabbit.ts';
import { pool, transaction } from './db.ts';
import { declare, queues, type EventData, type EventType, type Service } from './events.ts';

/** Devuelve el texto a mostrar en el log. */
type Handler = (client: pg.PoolClient, type: EventType, data: EventData) => Promise<string>;

/** Consumidor con inbox: el registro del mensaje y sus efectos van en una transacción. */
export async function startService(service: Service, handler: Handler) {
  const { connection, channel } = await connect();
  let closing = false;
  // Fase 1: si se pierde el broker el proceso termina (la reconexión llega en la fase 2).
  connection.on('close', () => {
    if (!closing) {
      console.error(`[${service}] conexión con RabbitMQ perdida`);
      process.exit(1);
    }
  });
  await declare(channel);
  await channel.prefetch(1);

  await channel.consume(queues[service].name, async (message) => {
    if (!message) return;
    const type = message.fields.routingKey as EventType;
    const id: string | undefined = message.properties.messageId;

    let data: EventData;
    try {
      data = JSON.parse(message.content.toString());
      if (!id || !data.pedidoId) throw new Error('faltan messageId o pedidoId');
    } catch (err) {
      console.error(`[${service}] mensaje inválido, a la DLQ:`, (err as Error).message);
      channel.nack(message, false, false);
      return;
    }

    try {
      const result = await transaction(async (client) => {
        const inserted = await client.query(
          `INSERT INTO ${service}.inbox (message_id) VALUES ($1) ON CONFLICT DO NOTHING`,
          [id],
        );
        if (inserted.rowCount === 0) return `duplicado ignorado (${type})`;
        return handler(client, type, data);
      });
      console.log(`[${service}] ${data.pedidoId.slice(0, 8)} ${result}`);
      channel.ack(message);
    } catch (err) {
      console.error(`[${service}] error:`, (err as Error).message);
      await sleep(1000);
      channel.reject(message, true); // cuenta para delivery-limit y acaba en la DLQ
    }
  });

  console.log(`[${service}] escuchando`);

  process.once('SIGINT', async () => {
    closing = true;
    await connection.close();
    await pool.end();
    process.exit(0);
  });
}
