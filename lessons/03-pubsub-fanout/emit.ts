import { connect } from '../../shared/rabbit.ts';

const exchange = 'leccion03.eventos';
const text = process.argv.slice(2).join(' ') || 'usuario registrado';

const { connection, channel } = await connect();
await channel.assertExchange(exchange, 'fanout', { durable: true });

// El productor no conoce las colas: publica en el exchange. fanout ignora la routing key.
channel.publish(exchange, '', Buffer.from(text));
console.log(`[x] Publicado: "${text}"`);

await channel.close();
await connection.close();
