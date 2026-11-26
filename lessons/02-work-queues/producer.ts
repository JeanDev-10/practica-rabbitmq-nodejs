import { connect } from '../../shared/rabbit.ts';

const queue = 'leccion02.tareas';
// Uso: node producer.ts [cantidad]   Cada punto del texto = 1 segundo de trabajo.
const total = Number(process.argv[2] ?? 6);

const { connection, channel } = await connect();
await channel.assertQueue(queue, { durable: true });

for (let i = 1; i <= total; i++) {
  // Las tareas impares son pesadas (3 s) y las pares ligeras (1 s).
  const task = `tarea-${i}${i % 2 ? '...' : '.'}`;
  channel.sendToQueue(queue, Buffer.from(task), { persistent: true });
  console.log(`[x] Enviada ${task}`);
}

await channel.close();
await connection.close();
