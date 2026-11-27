# Mi práctica de RabbitMQ (Node.js + TypeScript)

Repositorio personal donde practico **RabbitMQ 4.x** desde cero: una lección por concepto,
código ejecutable, experimentos para "romper" cosas y, al final, una mini-aplicación de pedidos.

## Requisitos

- Docker (con Compose)
- Node.js 22.18 o superior (ejecuta TypeScript sin compilar)

## Arranque

```bash
npm install
npm run up      # levanta RabbitMQ y espera a que esté sano
```

Interfaz de administración: http://localhost:15672 — usuario `guest`, clave `guest`.

> Las credenciales `guest/guest` son solo para aprender en local (los puertos quedan ligados a
> `127.0.0.1`). No uses esta configuración en producción.

Para apagar: `npm run down`. Para borrar también los datos: `docker compose down -v`.

## Mi avance

| # | Tema | Estado |
|---|---|---|
| 0 | [Fundamentos](lessons/00-fundamentos/README.md) | ✅ |
| 1 | [Hola mundo](lessons/01-hola-mundo/README.md) | ✅ |
| 2 | [Work queues, ack y prefetch](lessons/02-work-queues/README.md) | ✅ |
| 3 | [Publish/Subscribe (`fanout`)](lessons/03-pubsub-fanout/README.md) | ✅ |
| 4 | [Routing (`direct`)](lessons/04-routing-direct/README.md) | ✅ |
| 5 | `topic` y `headers` | ⏳ |
| 6 | Fiabilidad: confirms, returns, idempotencia | ⏳ |
| 7 | Errores: DLX, TTL, reintentos | ⏳ |
| 8 | RPC | ⏳ |
| 9 | Quorum queues y streams | ⏳ |
| 10 | Operación y producción | ⏳ |
| — | Proyecto final: sistema de pedidos | ⏳ |

## Estructura

```
docker-compose.yml   RabbitMQ con interfaz de administración
shared/rabbit.ts     Conexión y canal reutilizables
lessons/             Una carpeta por lección (README + código)
```

## Comandos útiles

```bash
docker compose exec rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged consumers
docker compose logs -f rabbitmq
npm run typecheck
```
