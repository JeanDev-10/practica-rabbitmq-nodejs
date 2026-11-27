import { randomUUID } from 'node:crypto';
import { connect } from '../../shared/rabbit.ts';
import { declare, exchange, routingKey } from './topology.ts';

// Uso: node producer.ts [idPago] [routingKey]
const id = process.argv[2] ?? randomUUID();
const key = process.argv[3] ?? routingKey;

const { connection } = await connect();
// En un canal de confirmación el broker responde por cada mensaje publicado.
const channel = await connection.createConfirmChannel();
channel.on('error', (err) => console.error('Error de canal:', err.message));
await declare(channel);

// "return" llega cuando un mensaje mandatory no coincide con ninguna cola.
let returned = false;
channel.on('return', (message) => {
  returned = true;
  console.error(`[!] Devuelto: ninguna cola para "${message.fields.routingKey}"`);
});

channel.publish(exchange, key, Buffer.from(JSON.stringify({ id, monto: 100 })), {
  persistent: true,
  mandatory: true,
  messageId: id, // identifica el mensaje para detectar duplicados
  contentType: 'application/json',
});

try {
  await channel.waitForConfirms();
  // Ojo: un mensaje devuelto también se confirma. Hay que mirar las dos señales.
  if (returned) {
    process.exitCode = 1;
  } else {
    console.log(`[x] Pago ${id} confirmado por el broker`);
  }
} catch (err) {
  console.error(`[!] Sin confirmación para ${id}:`, (err as Error).message);
  process.exitCode = 1;
}

await channel.close();
await connection.close();
