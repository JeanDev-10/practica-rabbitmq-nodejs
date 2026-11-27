// Reserva stock y, si el pago falla, lo libera (compensación).
import { startService } from './lib/consume.ts';
import { emit } from './lib/db.ts';

await startService('inventario', async (client, type, { pedidoId, producto, cantidad }) => {
  if (type === 'pago.rechazado') {
    // Marcar y devolver en la misma transacción: no se puede liberar dos veces.
    const { rows } = await client.query(
      `UPDATE inventario.reservas SET liberada = true
        WHERE pedido_id = $1 AND NOT liberada
        RETURNING producto, cantidad`,
      [pedidoId],
    );
    if (rows.length === 0) return 'no había reserva que liberar';
    await client.query('UPDATE inventario.productos SET stock = stock + $2 WHERE id = $1', [
      rows[0].producto,
      rows[0].cantidad,
    ]);
    return `COMPENSACIÓN: liberadas ${rows[0].cantidad} de ${rows[0].producto}`;
  }

  // Comprobar y descontar en una sola sentencia evita vender de más.
  const { rows } = await client.query(
    `UPDATE inventario.productos SET stock = stock - $2
      WHERE id = $1 AND stock >= $2
      RETURNING precio`,
    [producto, cantidad],
  );

  if (rows.length === 0) {
    await emit(client, 'inventario', 'stock.insuficiente', {
      pedidoId,
      motivo: 'sin stock o producto inexistente',
    });
    return `sin stock de ${producto}`;
  }

  await client.query(
    'INSERT INTO inventario.reservas (pedido_id, producto, cantidad) VALUES ($1, $2, $3)',
    [pedidoId, producto, cantidad],
  );
  await emit(client, 'inventario', 'stock.reservado', {
    pedidoId,
    total: rows[0].precio * cantidad!,
  });
  return `reservadas ${cantidad} de ${producto}`;
});
