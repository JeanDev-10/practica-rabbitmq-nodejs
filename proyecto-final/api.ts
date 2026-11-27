// API HTTP. No habla con RabbitMQ: guarda el pedido y su evento en el outbox.
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { emit, pool, transaction } from './lib/db.ts';

const port = Number(process.env.PORT ?? 3000);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 10_000) throw new SyntaxError('cuerpo demasiado grande');
  }
  return JSON.parse(body);
}

async function createOrder(request: IncomingMessage, response: ServerResponse) {
  const { producto, cantidad } = ((await readJson(request)) ?? {}) as Record<string, unknown>;

  if (
    typeof producto !== 'string' ||
    producto === '' ||
    typeof cantidad !== 'number' ||
    !Number.isInteger(cantidad) ||
    cantidad < 1 ||
    cantidad > 100
  ) {
    return send(response, 400, { error: 'se espera producto (texto) y cantidad (1 a 100)' });
  }

  const id = randomUUID();
  await transaction(async (client) => {
    await client.query('INSERT INTO pedidos.pedidos (id, producto, cantidad) VALUES ($1, $2, $3)', [
      id,
      producto,
      cantidad,
    ]);
    await emit(client, 'pedidos', 'pedido.creado', { pedidoId: id, producto, cantidad });
  });

  console.log(`[api] ${id.slice(0, 8)} pedido recibido`);
  // 202: aceptado, todavía no procesado.
  send(response, 202, { id, estado: 'pendiente' });
}

async function getOrder(id: string, response: ServerResponse) {
  const { rows } = await pool.query(
    'SELECT id, producto, cantidad, estado, motivo FROM pedidos.pedidos WHERE id = $1',
    [id],
  );
  if (rows.length === 0) return send(response, 404, { error: 'pedido no encontrado' });
  send(response, 200, rows[0]);
}

const server = createServer(async (request, response) => {
  try {
    const [, resource, id] = (request.url ?? '').split('/');
    if (request.method === 'POST' && resource === 'pedidos' && !id) {
      await createOrder(request, response);
    } else if (request.method === 'GET' && resource === 'pedidos' && id && uuid.test(id)) {
      await getOrder(id, response);
    } else {
      send(response, 404, { error: 'ruta no encontrada' });
    }
  } catch (err) {
    if (err instanceof SyntaxError) return send(response, 400, { error: 'JSON inválido' });
    console.error('[api]', (err as Error).message);
    send(response, 500, { error: 'error interno' });
  }
});

server.listen(port, '127.0.0.1', () => console.log(`[api] http://127.0.0.1:${port}`));

process.once('SIGINT', async () => {
  server.close();
  await pool.end();
  process.exit(0);
});
