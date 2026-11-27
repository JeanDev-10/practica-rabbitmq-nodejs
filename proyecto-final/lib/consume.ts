import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import type pg from 'pg';
import { connectAs } from './connection.ts';
import { pool, transaction } from './db.ts';
import {
  delays,
  queues,
  retryExchange,
  type EventData,
  type EventType,
  type Service,
} from './events.ts';

/** Devuelve el texto a mostrar en el log. Si lanza un error, se reintenta. */
type Handler = (client: pg.PoolClient, type: EventType, data: EventData) => Promise<string>;

/** Consumidor con inbox, reintentos con espera creciente y reconexión. */
export async function startService(service: Service, handler: Handler) {
  async function retryOrDiscard(channel: ConfirmChannel, message: ConsumeMessage, error: Error) {
    const retries = Number(message.properties.headers?.['x-reintentos'] ?? 0);
    const delay = delays[retries];

    if (delay === undefined) {
      console.error(`[${service}] sin más reintentos, a la DLQ: ${error.message}`);
      channel.nack(message, false, false);
      return;
    }

    console.warn(
      `[${service}] intento ${retries + 1} falló (${error.message}). Espera ${delay / 1000} s`,
    );
    channel.publish(retryExchange(service), String(delay), message.content, {
      persistent: true,
      messageId: message.properties.messageId, // el mismo, para que el inbox lo reconozca
      type: message.properties.type,
      contentType: message.properties.contentType,
      headers: { 'x-reintentos': retries + 1 },
    });
    await channel.waitForConfirms(); // primero la copia, después se borra el original
    channel.ack(message);
  }

  async function process_(channel: ConfirmChannel, message: ConsumeMessage) {
    // Tras un reintento la routing key es el nombre de la cola, por eso se usa `type`.
    const type = (message.properties.type ?? message.fields.routingKey) as EventType;
    const id: string | undefined = message.properties.messageId;

    let data: EventData;
    try {
      data = JSON.parse(message.content.toString());
      if (!id || !data.pedidoId) throw new Error('faltan messageId o pedidoId');
    } catch (err) {
      // Error permanente: reintentar no lo arreglaría.
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
      await retryOrDiscard(channel, message, err as Error);
    }
  }

  const connection = await connectAs(service, async (model) => {
    const channel = await model.createConfirmChannel();
    // El broker cerró el canal (por ejemplo, falta la topología o un permiso).
    channel.on('error', (err) => {
      console.error(`[${service}] canal cerrado: ${err.message}`);
      process.exit(1);
    });
    await channel.prefetch(1);
    await channel.consume(queues[service].name, async (message) => {
      if (!message) return;
      try {
        await process_(channel, message);
      } catch (err) {
        // Típicamente la conexión se cayó a mitad: sin ack, el broker lo reentregará.
        console.warn(`[${service}] mensaje sin confirmar: ${(err as Error).message}`);
      }
    });
    console.log(`[${service}] escuchando`);
  });

  process.once('SIGINT', async () => {
    await connection.close();
    await pool.end();
    process.exit(0);
  });
}
