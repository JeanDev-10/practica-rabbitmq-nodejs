// Uso: node estado.ts [--borrar]
import { init, pool } from './db.ts';

await init();

if (process.argv.includes('--borrar')) {
  await pool.query('TRUNCATE l11_orders, l11_outbox, l11_inbox, l11_charges');
  console.log('Tablas vaciadas.');
}

const { rows } = await pool.query(`
  SELECT (SELECT count(*)::int FROM l11_orders)                            AS pedidos,
         (SELECT count(*)::int FROM l11_outbox WHERE published_at IS NULL) AS "outbox pendientes",
         (SELECT count(*)::int FROM l11_outbox
           WHERE published_at IS NOT NULL)                                 AS "outbox enviados",
         (SELECT count(*)::int FROM l11_inbox)                             AS inbox,
         (SELECT count(*)::int FROM l11_charges)                           AS cobros
`);
console.table(rows);

await pool.end();
