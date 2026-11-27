// Crea tablas, colas y datos iniciales. Ejecutar una vez antes de arrancar los servicios.
// Uso: node preparar.ts [--borrar]
import { readFileSync } from 'node:fs';
import { connect } from '../shared/rabbit.ts';
import { pool } from './lib/db.ts';
import { declare, queues } from './lib/events.ts';

const reset = process.argv.includes('--borrar');

await pool.query(readFileSync(new URL('./lib/schema.sql', import.meta.url), 'utf8'));

const { connection, channel } = await connect();
await declare(channel);

if (reset) {
  await pool.query(`TRUNCATE
    pedidos.pedidos, pedidos.outbox, pedidos.inbox,
    inventario.productos, inventario.reservas, inventario.outbox, inventario.inbox,
    pagos.pagos, pagos.outbox, pagos.inbox,
    notificaciones.enviadas, notificaciones.inbox`);
  for (const { name } of Object.values(queues)) await channel.purgeQueue(name);
  await channel.purgeQueue('proyecto.fallidas');
}

await pool.query(`
  INSERT INTO inventario.productos (id, precio, stock)
  VALUES ('teclado', 50, 10), ('mouse', 20, 10), ('monitor', 400, 5)
  ON CONFLICT (id) DO NOTHING`);

console.log(reset ? 'Proyecto reiniciado.' : 'Proyecto preparado.');

await channel.close();
await connection.close();
await pool.end();
