// Cliente de prueba: crea un pedido y espera su estado final.
// Uso: node pedir.ts [producto] [cantidad]
import { setTimeout as sleep } from 'node:timers/promises';

const api = `http://127.0.0.1:${process.env.PORT ?? 3000}/pedidos`;
const producto = process.argv[2] ?? 'teclado';
const cantidad = Number(process.argv[3] ?? 1);

const response = await fetch(api, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ producto, cantidad }),
});
const order = (await response.json()) as { id?: string; estado?: string; error?: string };
console.log(response.status, order);

if (order.id) {
  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(500);
    const current = (await (await fetch(`${api}/${order.id}`)).json()) as { estado: string };
    if (current.estado !== 'pendiente') {
      console.log(current);
      process.exit(0);
    }
  }
  console.log('Sigue pendiente. ¿Están todos los servicios en marcha?');
  process.exitCode = 1;
}
