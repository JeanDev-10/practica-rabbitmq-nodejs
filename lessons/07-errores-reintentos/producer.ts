import { randomUUID } from 'node:crypto';
import { connect } from '../../shared/rabbit.ts';
import { declare, queue } from './topology.ts';

// Uso: node producer.ts <ok|temporal|siempre|invalida>
const task = process.argv[2] ?? 'ok';

const { connection } = await connect();
const channel = await connection.createConfirmChannel();
await declare(channel);

channel.sendToQueue(queue, Buffer.from(task), { persistent: true, messageId: randomUUID() });
await channel.waitForConfirms();
console.log(`[x] Enviada tarea "${task}"`);

await channel.close();
await connection.close();
