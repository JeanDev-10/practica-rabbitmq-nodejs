// Verificación de punta a punta. BORRA los datos del proyecto.
// Requiere `npm run up` y que no haya otros procesos del proyecto en marcha.
// Uso: node verificar.ts
import assert from 'node:assert/strict';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import amqp, { type ConfirmChannel } from 'amqplib';
import { connect } from '../shared/rabbit.ts';
import { password } from './lib/connection.ts';
import { pool } from './lib/db.ts';
import { deadQueue, exchange, queues } from './lib/events.ts';
import { flag } from './pasarela.ts';

const run = promisify(execFile);
const here = (file: string) => fileURLToPath(new URL(file, import.meta.url));
const script = (name: string, ...args: string[]) =>
  run(process.execPath, [here(`./${name}.ts`), ...args]);
const api = `http://127.0.0.1:${process.env.PORT ?? 3000}/pedidos`;

const services = ['api', 'relay', 'pedidos', 'inventario', 'pagos', 'notificaciones'];
const children = new Map<string, ChildProcess>();
let logs = '';

// --- Utilidades ---

/** Abre un canal de administrador solo para una operación (sobrevive a reinicios del broker). */
async function asAdmin<T>(work: (channel: ConfirmChannel) => Promise<T>) {
  const { connection } = await connect();
  const channel = await connection.createConfirmChannel();
  try {
    return await work(channel);
  } finally {
    await connection.close();
  }
}

/** El sistema es asíncrono: se espera a que algo se cumpla, con un límite. */
async function until(what: string, check: () => Promise<boolean> | boolean, timeoutMs = 30_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(250);
  }
  throw new Error(`tiempo agotado esperando: ${what}`);
}

async function createOrder(producto: string, cantidad: number) {
  const response = await fetch(api, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ producto, cantidad }),
  });
  assert.equal(response.status, 202);
  return ((await response.json()) as { id: string }).id;
}

async function status(id: string) {
  return ((await (await fetch(`${api}/${id}`)).json()) as { estado: string }).estado;
}

const reaches = (id: string, expected: string) =>
  until(`pedido ${expected}`, async () => (await status(id)) === expected);

async function value(sql: string, params: unknown[] = []) {
  const { rows } = await pool.query({ text: sql, values: params, rowMode: 'array' });
  return rows[0]?.[0];
}

const stock = (product: string): Promise<number> =>
  value('SELECT stock FROM inventario.productos WHERE id = $1', [product]);

const notifications = (id: string): Promise<number> =>
  value('SELECT count(*)::int FROM notificaciones.enviadas WHERE pedido_id = $1', [id]);

const deadCount = () =>
  asAdmin(async (channel) => (await channel.checkQueue(deadQueue)).messageCount);

/** Publica otra vez un evento ya enviado, con el mismo messageId. */
async function republish(schema: 'pedidos' | 'pagos', type: string, orderId: string) {
  const { rows } = await pool.query(
    `SELECT event_id, datos FROM ${schema}.outbox WHERE tipo = $1 AND datos->>'pedidoId' = $2`,
    [type, orderId],
  );
  await asAdmin(async (channel) => {
    channel.publish(exchange, type, Buffer.from(JSON.stringify(rows[0].datos)), {
      messageId: rows[0].event_id,
      type,
      persistent: true,
    });
    await channel.waitForConfirms();
  });
}

// --- Escenarios ---

const scenarios: [string, () => Promise<void>][] = [
  [
    'pedido válido: confirmado, stock descontado y un aviso',
    async () => {
      const before = await stock('teclado');
      const id = await createOrder('teclado', 2);
      await reaches(id, 'confirmado');
      await until('aviso', async () => (await notifications(id)) === 1);
      assert.equal(await stock('teclado'), before - 2);
    },
  ],
  [
    'sin stock: cancelado y stock intacto',
    async () => {
      const before = await stock('mouse');
      await reaches(await createOrder('mouse', 50), 'cancelado');
      assert.equal(await stock('mouse'), before);
    },
  ],
  [
    'pago rechazado: cancelado y stock liberado (compensación)',
    async () => {
      const before = await stock('monitor');
      const id = await createOrder('monitor', 3);
      await reaches(id, 'cancelado');
      await until('stock liberado', async () => (await stock('monitor')) === before);
    },
  ],
  [
    'mensajes duplicados: no repiten efectos',
    async () => {
      const id = await createOrder('teclado', 1);
      await reaches(id, 'confirmado');
      await until('aviso', async () => (await notifications(id)) === 1);
      const before = await stock('teclado');
      const ignored = () => logs.split('duplicado ignorado').length - 1;
      const previous = ignored();

      await republish('pedidos', 'pedido.creado', id);
      await republish('pagos', 'pago.aprobado', id);
      await until('duplicados ignorados', () => ignored() >= previous + 2);

      assert.equal(await stock('teclado'), before);
      assert.equal(await notifications(id), 1);
    },
  ],
  [
    'pasarela caída que se recupera: confirmado tras reintentar',
    async () => {
      writeFileSync(flag, '');
      const id = await createOrder('mouse', 1);
      await until('primer reintento', () => logs.includes('[pagos] intento 1 falló'));
      rmSync(flag, { force: true });
      await reaches(id, 'confirmado');
    },
  ],
  [
    'pasarela caída sin recuperar: DLQ, pendiente y reproceso manual',
    async () => {
      writeFileSync(flag, '');
      const id = await createOrder('mouse', 1);
      await until('mensaje en la DLQ', async () => (await deadCount()) === 1);
      assert.equal(await status(id), 'pendiente');

      rmSync(flag, { force: true });
      await script('fallidas', '--reprocesar');
      await reaches(id, 'confirmado');
      assert.equal(await deadCount(), 0);
    },
  ],
  [
    'mensaje mal formado: directo a la DLQ',
    async () => {
      await asAdmin(async (channel) => {
        channel.publish(exchange, 'stock.reservado', Buffer.from('no-es-json'));
        await channel.waitForConfirms();
      });
      await until('mensaje en la DLQ', async () => (await deadCount()) === 1);
      await asAdmin((channel) => channel.purgeQueue(deadQueue));
    },
  ],
  [
    'un servicio no puede consumir la cola de otro',
    async () => {
      const connection = await amqp.connect(`amqp://pagos:${password}@localhost:5672`);
      connection.on('error', () => {});
      const channel = await connection.createChannel();
      channel.on('error', () => {});
      await assert.rejects(channel.consume(queues.inventario.name, () => {}), /ACCESS_REFUSED/);
      await connection.close();
    },
  ],
  [
    'reinicio de RabbitMQ: ningún pedido se pierde ni se cae un proceso',
    async () => {
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) ids.push(await createOrder('mouse', 50));
      const restart = run('docker', ['compose', 'restart', 'rabbitmq'], { cwd: here('..') });
      for (let i = 0; i < 8; i++) {
        ids.push(await createOrder('mouse', 50)); // la API sigue aceptando pedidos
        await sleep(500);
      }
      await restart;
      await until(
        'todos los pedidos resueltos',
        async () => (await Promise.all(ids.map(status))).every((s) => s === 'cancelado'),
        90_000,
      );
      for (const [name, child] of children) assert.equal(child.exitCode, null, `${name} terminó`);
    },
  ],
];

// --- Ejecución ---

/** Evita borrar datos o repartir mensajes con una instancia que ya esté corriendo. */
async function ensureAlone() {
  const apiUp = await fetch(api).then(
    () => true,
    () => false,
  );
  const consumers = await asAdmin(async (channel) => {
    channel.on('error', () => {}); // la primera vez las colas aún no existen
    let total = 0;
    for (const { name } of Object.values(queues)) total += (await channel.checkQueue(name)).consumerCount;
    return total;
  }).catch((err: Error) => {
    if (err.message.includes('NOT_FOUND')) return 0;
    throw err;
  });

  if (apiUp || consumers > 0) {
    throw new Error('hay otra instancia del proyecto en marcha: deténla (Ctrl+C) y repite');
  }
}

let failed = 0;
let started = false;

try {
  await ensureAlone();
  started = true;
  rmSync(flag, { force: true });
  await script('preparar', '--borrar');

  for (const name of services) {
    const child = spawn(process.execPath, [here(`./${name}.ts`)]);
    child.stdout.on('data', (chunk) => (logs += chunk));
    child.stderr.on('data', (chunk) => (logs += chunk));
    children.set(name, child);
  }
  await until('servicios listos', () =>
    ['[api] http', '[relay] listo', ...Object.keys(queues).map((s) => `[${s}] escuchando`)].every(
      (line) => logs.includes(line),
    ),
  );

  for (const [name, scenario] of scenarios) {
    try {
      await scenario();
      console.log(`  ok     ${name}`);
    } catch (err) {
      failed++;
      console.error(`  FALLA  ${name}\n         ${(err as Error).message}`);
    } finally {
      rmSync(flag, { force: true });
    }
  }

  console.log(`\n${scenarios.length - failed} de ${scenarios.length} escenarios correctos`);
  if (failed) console.error(`\nÚltimos logs:\n${logs.split('\n').slice(-40).join('\n')}`);
} catch (err) {
  failed++;
  console.error(`No se pudo verificar: ${(err as Error).message}`);
} finally {
  for (const child of children.values()) child.kill();
  if (started) await script('preparar', '--borrar'); // deja el proyecto limpio
  await pool.end();
}

process.exitCode = failed ? 1 : 0;
