import { setTimeout as sleep } from 'node:timers/promises';
import { connect } from '../../shared/rabbit.ts';

const queue = 'leccion08.stock';
const stock: Record<string, number> = { teclado: 12, monitor: 3, mouse: 0 };

const { connection, channel } = await connect();
await channel.assertQueue(queue, { durable: true });
await channel.prefetch(10); // atiende varias peticiones a la vez

await channel.consume(queue, async (message) => {
  if (!message) return;
  const { replyTo, correlationId } = message.properties;
  const product = message.content.toString();

  if (!replyTo) {
    console.error(`[!] Petición sin replyTo (${product}): se descarta`);
    channel.nack(message, false, false);
    return;
  }

  // Demora al azar: las respuestas salen en distinto orden que las peticiones.
  await sleep(200 + Math.random() * 1300);

  // Un error también se responde; si no, el cliente solo vería un timeout.
  const reply = Object.hasOwn(stock, product)
    ? { ok: true, product, units: stock[product] }
    : { ok: false, product, error: 'producto desconocido' };

  channel.sendToQueue(replyTo, Buffer.from(JSON.stringify(reply)), {
    correlationId, // permite al cliente saber a qué petición corresponde
    contentType: 'application/json',
  });
  channel.ack(message);
  console.log(`[x] Respondido ${product}`);
});

console.log(`[*] Servidor RPC en "${queue}". Ctrl+C para salir.`);

process.once('SIGINT', async () => {
  await connection.close();
  process.exit(0);
});
