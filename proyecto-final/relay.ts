// Publica los outbox de todos los servicios y marca como enviado lo que el broker confirma.
import { setTimeout as sleep } from 'node:timers/promises';
import type { ConfirmChannel } from 'amqplib';
import { connectAs } from './lib/connection.ts';
import { pool, publishers, transaction, type Publisher } from './lib/db.ts';
import { exchange } from './lib/events.ts';

/** Sin definir mientras no haya conexión. */
let channel: ConfirmChannel | undefined;
let returned = false;

const connection = await connectAs('relay', async (model) => {
  const created = await model.createConfirmChannel();
  created.on('error', (err) => console.error('[relay] canal cerrado:', err.message));
  created.on('return', () => (returned = true));
  created.on('close', () => {
    if (channel === created) channel = undefined;
  });
  channel = created;
  console.log('[relay] listo');
});

function publishBatch(current: ConfirmChannel, schema: Publisher) {
  return transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT id, event_id, tipo, datos FROM ${schema}.outbox
        WHERE published_at IS NULL
        ORDER BY id LIMIT 10
        FOR UPDATE SKIP LOCKED`,
    );

    for (const event of rows) {
      returned = false;
      current.publish(exchange, event.tipo, Buffer.from(JSON.stringify(event.datos)), {
        persistent: true,
        mandatory: true,
        messageId: event.event_id,
        type: event.tipo,
        contentType: 'application/json',
      });
      await current.waitForConfirms();
      if (returned) throw new Error(`sin cola para ${event.tipo}`);
      await client.query(`UPDATE ${schema}.outbox SET published_at = now() WHERE id = $1`, [
        event.id,
      ]);
    }
    return rows.length;
  });
}

let running = true;
process.once('SIGINT', () => (running = false));

while (running) {
  try {
    let published = 0;
    for (const schema of publishers) {
      if (channel) published += await publishBatch(channel, schema);
    }
    if (published === 0) await sleep(300);
  } catch (err) {
    console.error('[relay] error, se reintentará:', (err as Error).message);
    await sleep(2000);
  }
}

await connection.close();
await pool.end();
