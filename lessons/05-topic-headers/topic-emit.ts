import { connect } from '../../shared/rabbit.ts';

const exchange = 'leccion05.topic';
// Uso: node topic-emit.ts <routing.key> <mensaje>
const key = process.argv[2] ?? 'pedido.creado.pe';
const text = process.argv.slice(3).join(' ') || 'evento';

const { connection, channel } = await connect();
await channel.assertExchange(exchange, 'topic', { durable: true });

channel.publish(exchange, key, Buffer.from(text));
console.log(`[x] ${key}: "${text}"`);

await channel.close();
await connection.close();
