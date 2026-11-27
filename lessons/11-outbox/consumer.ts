// Inbox: registra el messageId y aplica el efecto en la misma transacción.
import { setTimeout as sleep } from 'node:timers/promises';
import { connect } from '../../shared/rabbit.ts';
import { init, pool, transaction } from './db.ts';
import { declare, queue } from './topology.ts';

// Uso: node consumer.ts [--caer]
const crash = process.argv.includes('--caer');

await init();
const { connection, channel } = await connect();
await declare(channel);
await channel.prefetch(1);

await channel.consume(queue, async (message) => {
  if (!message) return;
  const id: string = message.properties.messageId;

  try {
    const { orderId, amount } = JSON.parse(message.content.toString());

    const isNew = await transaction(async (client) => {
      const inserted = await client.query(
        'INSERT INTO l11_inbox (message_id) VALUES ($1) ON CONFLICT DO NOTHING',
        [id],
      );
      if (inserted.rowCount === 0) return false; // duplicado
      await client.query('INSERT INTO l11_charges (order_id, amount) VALUES ($1, $2)', [
        orderId,
        amount,
      ]);
      return true;
    });

    console.log(isNew ? `[$] cobrado pedido ${orderId}` : `[=] duplicado ignorado: ${id}`);

    if (crash) {
      console.error('[!] Caída después del COMMIT y antes del ack');
      process.exit(1);
    }
    channel.ack(message);
  } catch (err) {
    console.error('[!] no se pudo procesar:', (err as Error).message);
    await sleep(1000);
    channel.reject(message, true); // cuenta para delivery-limit y acaba en la DLQ
  }
});

console.log(`[*] Esperando pedidos en "${queue}". Ctrl+C para salir.`);

process.once('SIGINT', async () => {
  await connection.close();
  await pool.end();
  process.exit(0);
});
