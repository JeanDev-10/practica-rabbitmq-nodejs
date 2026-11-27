// Parte del servicio de pedidos que reacciona a eventos y cierra la saga.
import { startService } from './lib/consume.ts';
import { emit } from './lib/db.ts';

await startService('pedidos', async (client, type, { pedidoId, motivo }) => {
  const confirmed = type === 'pago.aprobado';
  const status = confirmed ? 'confirmado' : 'cancelado';

  const updated = await client.query(
    `UPDATE pedidos.pedidos SET estado = $2, motivo = $3
      WHERE id = $1 AND estado = 'pendiente'`,
    [pedidoId, status, confirmed ? null : motivo],
  );
  if (updated.rowCount === 0) return `${type} ignorado: el pedido no está pendiente`;

  await emit(client, 'pedidos', confirmed ? 'pedido.confirmado' : 'pedido.cancelado', {
    pedidoId,
    motivo,
  });
  return `pedido ${status}`;
});
