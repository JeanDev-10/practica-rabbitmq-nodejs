// Versión INCORRECTA a propósito: guardar y publicar en dos pasos separados.
import { randomUUID } from 'node:crypto';
import { connect } from '../../shared/rabbit.ts';
import { init, pool } from './db.ts';
import { declare, exchange, routingKey } from './topology.ts';

// Uso: node ingenuo.ts [--caer]
const crash = process.argv.includes('--caer');

await init();
const { connection } = await connect();
const channel = await connection.createConfirmChannel();
await declare(channel);

const id = randomUUID();
await pool.query('INSERT INTO l11_orders (id, amount) VALUES ($1, $2)', [id, 100]);
console.log(`[db] pedido ${id} guardado`);

if (crash) {
  console.error('[!] El proceso muere antes de publicar: el evento se pierde para siempre');
  process.exit(1);
}

channel.publish(exchange, routingKey, Buffer.from(JSON.stringify({ orderId: id, amount: 100 })), {
  persistent: true,
  messageId: randomUUID(),
});
await channel.waitForConfirms();
console.log('[x] evento publicado');

await channel.close();
await connection.close();
await pool.end();
