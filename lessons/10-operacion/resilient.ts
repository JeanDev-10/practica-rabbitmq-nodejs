import amqp, { type ChannelModel } from 'amqplib';

const url = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';
export const queue = 'leccion10.eventos';

/**
 * Conexión que se recupera sola. `setup` se ejecuta tras cada (re)conexión:
 * los canales y consumidores anteriores ya no sirven y hay que crearlos de nuevo.
 */
export async function connectResilient(setup: (model: ChannelModel) => Promise<void>) {
  const connection = await amqp.connect(url, {
    recovery: {
      initialDelay: 500,
      maxDelay: 5000, // espera creciente entre intentos, hasta 5 s
      setup,
    },
  });

  connection.on('error', (err) => console.error('[conexión] error:', err.message));
  connection.on('disconnect', (err) => console.warn('[conexión] perdida:', err.message));
  connection.on('reconnect-scheduled', ({ attempt, delay }) =>
    console.warn(`[conexión] intento ${attempt} en ${Math.round(delay)} ms`),
  );
  connection.on('connect', () => console.log('[conexión] recuperada'));
  // El broker pide parar de publicar (alarma de memoria o disco).
  connection.on('blocked', (reason) => console.warn('[conexión] BLOQUEADA:', reason));
  connection.on('unblocked', () => console.log('[conexión] desbloqueada'));

  return connection;
}
