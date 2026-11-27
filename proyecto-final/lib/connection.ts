import amqp, { type ChannelModel } from 'amqplib';

const host = process.env.RABBITMQ_HOST ?? 'localhost';
/** Clave de práctica para los usuarios de cada servicio. Solo para local. */
export const password = 'clave-local';

/**
 * Conexión con el usuario del servicio, que se recupera sola. `setup` se ejecuta tras cada
 * (re)conexión porque los canales y consumidores anteriores ya no sirven.
 */
export async function connectAs(user: string, setup: (model: ChannelModel) => Promise<void>) {
  const connection = await amqp.connect(`amqp://${user}:${password}@${host}:5672`, {
    recovery: { initialDelay: 500, maxDelay: 5000, setup },
  });

  connection.on('error', (err) => console.error(`[${user}] error de conexión:`, err.message));
  connection.on('disconnect', () => console.warn(`[${user}] conexión perdida, reintentando`));
  connection.on('connect', () => console.log(`[${user}] conexión recuperada`));

  return connection;
}
