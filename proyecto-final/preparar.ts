// Crea tablas, colas, usuarios y datos iniciales. Se ejecuta con permisos de administrador.
// Uso: node preparar.ts [--borrar]
import { readFileSync } from 'node:fs';
import { connect } from '../shared/rabbit.ts';
import { password } from './lib/connection.ts';
import { pool } from './lib/db.ts';
import { deadQueue, declare, delays, exchange, queues, retryQueue, type Service } from './lib/events.ts';

const reset = process.argv.includes('--borrar');
const services = Object.keys(queues) as Service[];

await pool.query(readFileSync(new URL('./lib/schema.sql', import.meta.url), 'utf8'));

const { connection, channel } = await connect();
await declare(channel);

// --- Usuarios con los permisos mínimos, mediante la API de administración ---

async function put(path: string, body: unknown) {
  const response = await fetch(`http://localhost:15672/api/${path}`, {
    method: 'PUT',
    headers: {
      authorization: `Basic ${Buffer.from('guest:guest').toString('base64')}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
}

/** Expresión regular que solo coincide con ese nombre. "^$" no coincide con ningún recurso. */
const only = (name: string) => `^${name.replaceAll('.', '\\.')}$`;

async function createUser(user: string, write: string, read: string) {
  await put(`users/${user}`, { password, tags: '' });
  await put(`permissions/%2F/${user}`, { configure: '^$', write, read });
}

await createUser('relay', only(exchange), '^$');
for (const service of services) {
  // Cada servicio: lee su cola y publica solo en su exchange de reintentos.
  await createUser(service, only(`proyecto.${service}.reintentos`), only(queues[service].name));
}

// --- Datos ---

if (reset) {
  await pool.query(`TRUNCATE
    pedidos.pedidos, pedidos.outbox, pedidos.inbox,
    inventario.productos, inventario.reservas, inventario.outbox, inventario.inbox,
    pagos.pagos, pagos.outbox, pagos.inbox,
    notificaciones.enviadas, notificaciones.inbox`);
  for (const service of services) {
    await channel.purgeQueue(queues[service].name);
    for (const delay of delays) await channel.purgeQueue(retryQueue(service, delay));
  }
  await channel.purgeQueue(deadQueue);
}

await pool.query(`
  INSERT INTO inventario.productos (id, precio, stock)
  VALUES ('teclado', 50, 10), ('mouse', 20, 10), ('monitor', 400, 5)
  ON CONFLICT (id) DO NOTHING`);

console.log(reset ? 'Proyecto reiniciado.' : 'Proyecto preparado.');

await channel.close();
await connection.close();
await pool.end();
