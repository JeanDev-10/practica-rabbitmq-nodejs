// Publica los outbox de todos los servicios y marca como enviado lo que el broker confirma.
import { setTimeout as sleep } from 'node:timers/promises';
import { connect } from '../shared/rabbit.ts';
import { pool, publishers, transaction, type Publisher } from './lib/db.ts';
import { declare, exchange } from './lib/events.ts';

const { connection } = await connect();
let running = true;
// Fase 1: si se pierde el broker el proceso termina; lo pendiente queda en la base de datos.
connection.on('close', () => {
  if (running) {
    console.error('[relay] conexión con RabbitMQ perdida');
    process.exit(1);
  }
});
const channel = await connection.createConfirmChannel();
await declare(channel);

let returned = false;
channel.on('return', () => (returned = true));

function publishBatch(schema: Publisher) {
  return transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, event_id, tipo, datos FROM ${schema}.outbox
        WHERE published_at IS NULL
        ORDER BY id LIMIT 10
        FOR UPDATE SKIP LOCKED`,
    );

    for (const event of rows) {
      returned = false;
      channel.publish(exchange, event.tipo, Buffer.from(JSON.stringify(event.datos)), {
        persistent: true,
        mandatory: true,
        messageId: event.event_id,
        contentType: 'application/json',
      });
      await channel.waitForConfirms();
      if (returned) throw new Error(`sin cola para ${event.tipo}`);
      await client.query(`UPDATE ${schema}.outbox SET published_at = now() WHERE id = $1`, [
        event.id,
      ]);
    }
    return rows.length;
  });
}

process.once('SIGINT', () => (running = false));
console.log('[relay] buscando eventos pendientes');

while (running) {
  try {
    let published = 0;
    for (const schema of publishers) published += await publishBatch(schema);
    if (published === 0) await sleep(300);
  } catch (err) {
    console.error('[relay] error, se reintentará:', (err as Error).message);
    await sleep(2000);
  }
}

await connection.close();
await pool.end();
