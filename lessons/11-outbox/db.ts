import { readFileSync } from 'node:fs';
import pg from 'pg';

export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgres://practica:practica@localhost:5433/practica',
});
// Sin este listener, una conexión inactiva que se cae tumba el proceso.
pool.on('error', (err) => console.error('[postgres]', err.message));

/** Crea las tablas si no existen. Ejecútalo con un solo proceso la primera vez. */
export async function init() {
  await pool.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
}

/** Todo lo que haga `work` se guarda junto o no se guarda. */
export async function transaction<T>(work: (client: pg.PoolClient) => Promise<T>) {
  // Una transacción debe usar siempre el mismo cliente, nunca pool.query.
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
