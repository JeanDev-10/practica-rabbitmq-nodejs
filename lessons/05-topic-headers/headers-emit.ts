import { connect } from '../../shared/rabbit.ts';

const exchange = 'leccion05.headers';
// Uso: node headers-emit.ts <formato> <tipo>
const format = process.argv[2] ?? 'pdf';
const type = process.argv[3] ?? 'reporte';

const { connection, channel } = await connect();
await channel.assertExchange(exchange, 'headers', { durable: true });

// La routing key no se usa: el enrutamiento mira las cabeceras.
channel.publish(exchange, '', Buffer.from(`documento ${type}.${format}`), {
  headers: { format, type },
});
console.log(`[x] format=${format} type=${type}`);

await channel.close();
await connection.close();
