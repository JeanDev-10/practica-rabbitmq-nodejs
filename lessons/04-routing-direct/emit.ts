import { connect } from '../../shared/rabbit.ts';

const exchange = 'leccion04.logs';
// Uso: node emit.ts <severidad> <mensaje>
const severity = process.argv[2] ?? 'info';
const text = process.argv.slice(3).join(' ') || 'algo pasó';

const { connection, channel } = await connect();
await channel.assertExchange(exchange, 'direct', { durable: true });

channel.publish(exchange, severity, Buffer.from(text));
console.log(`[x] ${severity}: "${text}"`);

await channel.close();
await connection.close();
