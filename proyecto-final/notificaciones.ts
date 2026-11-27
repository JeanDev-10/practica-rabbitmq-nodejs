// Aviso simulado del resultado final.
import { startService } from './lib/consume.ts';

await startService('notificaciones', async (client, type, { pedidoId, motivo }) => {
  const text =
    type === 'pedido.confirmado' ? 'Tu pedido fue confirmado' : `Tu pedido fue cancelado: ${motivo}`;

  // Un correo real no se puede meter en la transacción: necesitaría su propia clave
  // de idempotencia en el proveedor.
  await client.query('INSERT INTO notificaciones.enviadas (pedido_id, mensaje) VALUES ($1, $2)', [
    pedidoId,
    text,
  ]);
  return `aviso: "${text}"`;
});
