// Cobro simulado. Un rechazo es un resultado de negocio, no un error: no se reintenta.
import { existsSync } from 'node:fs';
import { startService } from './lib/consume.ts';
import { emit } from './lib/db.ts';
import { flag } from './pasarela.ts';

/** Regla inventada para poder provocar rechazos. */
const limit = 1000;

await startService('pagos', async (client, _type, { pedidoId, total }) => {
  // Error temporal: se lanza para que se reintente. A una pasarela real se le enviaría
  // `pedidoId` como clave de idempotencia, para no cobrar dos veces al reintentar.
  if (existsSync(flag)) throw new Error('la pasarela de pago no responde');

  const approved = total! <= limit;

  await client.query('INSERT INTO pagos.pagos (pedido_id, total, aprobado) VALUES ($1, $2, $3)', [
    pedidoId,
    total,
    approved,
  ]);
  await emit(client, 'pagos', approved ? 'pago.aprobado' : 'pago.rechazado', {
    pedidoId,
    total,
    motivo: approved ? undefined : `el total ${total} supera el límite de ${limit}`,
  });

  return `pago de ${total} ${approved ? 'aprobado' : 'RECHAZADO'}`;
});
