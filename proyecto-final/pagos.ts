// Cobro simulado. Un rechazo es un resultado de negocio, no un error: no se reintenta.
import { startService } from './lib/consume.ts';
import { emit } from './lib/db.ts';

/** Regla inventada para poder provocar rechazos. */
const limit = 1000;

await startService('pagos', async (client, _type, { pedidoId, total }) => {
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
