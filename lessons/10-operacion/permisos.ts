import amqp from 'amqplib';

// Usuario de práctica creado en el README. La clave es de ejemplo, solo para local.
const url = 'amqp://app:clave-local@localhost:5672/practica';

const connection = await amqp.connect(url);
connection.on('error', () => {});

for (const name of ['app.pedidos', 'otra.cola']) {
  const channel = await connection.createChannel();
  channel.on('error', () => {}); // el rechazo cierra el canal
  try {
    await channel.assertQueue(name, { durable: true });
    console.log(`[ok] puede declarar ${name}`);
    await channel.close();
  } catch (err) {
    console.log(`[no] no puede declarar ${name}: ${(err as Error).message}`);
  }
}

await connection.close();
