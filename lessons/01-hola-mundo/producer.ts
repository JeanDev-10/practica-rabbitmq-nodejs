import { connect } from '../../shared/rabbit.ts';

const queue = 'leccion01.hola';
const text = process.argv.slice(2).join(' ') || 'Hola mundo';

const { connection, channel } = await connect();

// "assert" = crea la cola si no existe; si existe, comprueba que las opciones coincidan.
await channel.assertQueue(queue, { durable: true });

// sendToQueue usa el exchange por defecto (""), que enruta por nombre de cola.
channel.sendToQueue(queue, Buffer.from(text), { persistent: true });
console.log(`[x] Enviado: "${text}"`);

// Cerrar el canal antes que la conexión asegura que el mensaje salga del cliente.
await channel.close();
await connection.close();
