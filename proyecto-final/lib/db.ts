import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { EventData, EventType } from './events.ts';

export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgres://practica:practica@localhost:5433/practica',
});
pool.on('error', (err) => console.error('[postgres]', err.message));

/** Todo lo que haga `work` se guarda junto o no se guarda. */
export async function transaction<T>(work: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Servicios que publican eventos (tienen tabla outbox). */
export const publishers = ['pedidos', 'inventario', 'pagos'] as const;
export type Publisher = (typeof publishers)[number];

/** Anota un evento en el outbox. Debe llamarse dentro de la transacción del cambio. */
export async function emit(
  client: pg.PoolClient,
  schema: Publisher,
  type: EventType,
  data: EventData,
) {
  // `schema` sale de una lista fija, nunca de datos externos.
  await client.query(`INSERT INTO ${schema}.outbox (event_id, tipo, datos) VALUES ($1, $2, $3)`, [
    randomUUID(),
    type,
    data,
  ]);
}
