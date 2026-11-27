// Relay: publica los eventos pendientes del outbox y los marca como enviados.
import { setTimeout as sleep } from 'node:timers/promises';
import { connect } from '../../shared/rabbit.ts';
import { init, pool, transaction } from './db.ts';
import { declare, exchange } from './topology.ts';

// Uso: node relay.ts [nombre] [--caer]
const crash = process.argv.includes('--caer');
const name = process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? 'relay';

await init();
const { connection } = await connect();
// Si se pierde el broker, el proceso termina; lo pendiente sigue en la base de datos.
connection.on('close', () => {
  if (running) {
    console.error('[!] Conexión con RabbitMQ perdida');
    process.exit(1);
  }
});
const channel = await connection.createConfirmChannel();
await declare(channel);

let returned = false;
channel.on('return', () => (returned = true));

function publishBatch() {
  return transaction(async (client) => {
    // FOR UPDATE bloquea las filas; SKIP LOCKED hace que otro relay tome las siguientes.
    const { rows } = await client.query(
      `SELECT id, event_id, routing_key, payload FROM l11_outbox
        WHERE published_at IS NULL
        ORDER BY id LIMIT 5
        FOR UPDATE SKIP LOCKED`,
    );

    for (const event of rows) {
      returned = false;
      channel.publish(exchange, event.routing_key, Buffer.from(JSON.stringify(event.payload)), {
        persistent: true,
        mandatory: true,
        messageId: event.event_id,
        contentType: 'application/json',
      });
      await channel.waitForConfirms();
      if (returned) throw new Error(`sin cola para ${event.routing_key}`);

      console.log(`[${name}] publicado evento ${event.id}`);
      if (crash) {
        console.error('[!] Caída tras publicar y antes de marcar como enviado');
        process.exit(1);
      }
      await client.query('UPDATE l11_outbox SET published_at = now() WHERE id = $1', [event.id]);
      await sleep(200); // más lento a propósito, para observar dos relays
    }
    return rows.length;
  });
}

let running = true;
process.once('SIGINT', () => (running = false));
console.log(`[${name}] buscando eventos pendientes. Ctrl+C para salir.`);

while (running) {
  try {
    // Si no había nada, espera antes de volver a preguntar (polling).
    if ((await publishBatch()) === 0) await sleep(1000);
  } catch (err) {
    console.error(`[${name}] error, se reintentará:`, (err as Error).message);
    await sleep(2000);
  }
}

await connection.close();
await pool.end();
