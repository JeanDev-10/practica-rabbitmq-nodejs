import { randomUUID } from 'node:crypto';
import { connect } from '../../shared/rabbit.ts';

const queue = 'leccion08.stock';
const timeoutMs = 5000;
// Uso: node client.ts [producto ...]
const products = process.argv.slice(2);
if (products.length === 0) products.push('teclado', 'monitor', 'mouse', 'silla');

const { connection, channel } = await connect();
await channel.assertQueue(queue, { durable: true });

// Cola privada donde este cliente recibe sus respuestas.
const { queue: replyQueue } = await channel.assertQueue('', { exclusive: true });

/** Peticiones en curso: correlationId → quién espera la respuesta. */
const pending = new Map<string, (reply: string) => void>();

await channel.consume(replyQueue, (message) => {
  if (!message) return;
  const resolve = pending.get(message.properties.correlationId);
  // Una respuesta sin dueño (tardía o repetida) se ignora.
  resolve?.(message.content.toString());
}, { noAck: true });

function call(product: string) {
  const correlationId = randomUUID();

  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(correlationId);
      reject(new Error(`sin respuesta en ${timeoutMs / 1000} s`));
    }, timeoutMs);

    pending.set(correlationId, (reply) => {
      clearTimeout(timer);
      pending.delete(correlationId);
      resolve(reply);
    });

    channel.sendToQueue(queue, Buffer.from(product), {
      correlationId,
      replyTo: replyQueue,
      expiration: timeoutMs, // si nadie la atiende a tiempo, la petición caduca
    });
    console.log(`[?] Pregunto por ${product}`);
  });
}

await Promise.all(
  products.map(async (product) => {
    try {
      console.log(`[=] ${product}: ${await call(product)}`);
    } catch (err) {
      console.error(`[!] ${product}: ${(err as Error).message}`);
      process.exitCode = 1;
    }
  }),
);

await channel.close();
await connection.close();
