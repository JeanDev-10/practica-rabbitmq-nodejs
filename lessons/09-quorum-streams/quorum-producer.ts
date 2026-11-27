import { connect } from '../../shared/rabbit.ts';
import { declare, queue } from './quorum-topology.ts';

const text = process.argv[2] ?? 'mensaje-venenoso';

const { connection } = await connect();
const channel = await connection.createConfirmChannel();
await declare(channel);

channel.sendToQueue(queue, Buffer.from(text), { persistent: true });
await channel.waitForConfirms();
console.log(`[x] Enviado "${text}"`);

await channel.close();
await connection.close();
