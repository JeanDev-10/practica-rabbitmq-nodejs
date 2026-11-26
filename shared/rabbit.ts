import amqp from 'amqplib';

const url = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';

/** Abre una conexión TCP y, dentro de ella, un canal. */
export async function connect() {
  const connection = await amqp.connect(url);
  // Sin este listener, un error de conexión tumba el proceso sin explicación clara.
  connection.on('error', (err) => console.error('Error de conexión:', err.message));

  const channel = await connection.createChannel();
  channel.on('error', (err) => console.error('Error de canal:', err.message));

  return { connection, channel };
}
