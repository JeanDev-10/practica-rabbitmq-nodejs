// Outbox: el pedido y su evento se guardan en la MISMA transacción. No usa RabbitMQ.
import { randomUUID } from 'node:crypto';
import { init, pool, transaction } from './db.ts';

// Uso: node crear-pedido.ts [cantidad] [--fallar]
const total = Number(process.argv.slice(2).find((arg) => /^\d+$/.test(arg)) ?? 1);
const fail = process.argv.includes('--fallar');

await init();

for (let i = 0; i < total; i++) {
  const id = randomUUID();
  try {
    await transaction(async (client) => {
      await client.query('INSERT INTO l11_orders (id, amount) VALUES ($1, $2)', [id, 100]);
      await client.query(
        'INSERT INTO l11_outbox (event_id, routing_key, payload) VALUES ($1, $2, $3)',
        [randomUUID(), 'pedido.creado', { orderId: id, amount: 100 }],
      );
      if (fail) throw new Error('fallo simulado antes del COMMIT');
    });
    console.log(`[db] pedido ${id} y su evento guardados`);
  } catch (err) {
    console.error(`[!] ${(err as Error).message}: no se guardó ni el pedido ni el evento`);
    process.exitCode = 1;
  }
}

await pool.end();
