# Proyecto final — Sistema de pedidos con saga

Estado: **fase 1** (camino feliz y compensación). Pendientes: fallos (fase 2) y verificación
automática (fase 3).

## Flujo

```
POST /pedidos ──▶ api ── pedido.creado ──▶ inventario
                                              │
                   stock.insuficiente ◀───────┴──────▶ stock.reservado ──▶ pagos
                            │                                                │
                            ▼                        pago.aprobado ◀─────────┤
                         pedidos ◀───────────────────pago.rechazado ◀────────┘
                            │                              │
             pedido.confirmado / cancelado                 └──▶ inventario libera el stock
                            ▼
                     notificaciones
```

## Procesos

| Proceso | Escucha | Publica |
|---|---|---|
| `api` | HTTP | `pedido.creado` |
| `inventario` | `pedido.creado`, `pago.rechazado` | `stock.reservado`, `stock.insuficiente` |
| `pagos` | `stock.reservado` | `pago.aprobado`, `pago.rechazado` |
| `pedidos` | `stock.insuficiente`, `pago.*` | `pedido.confirmado`, `pedido.cancelado` |
| `notificaciones` | `pedido.confirmado`, `pedido.cancelado` | — |
| `relay` | tablas outbox | todo lo anterior |

Ningún servicio publica directamente: escribe en su outbox y el `relay` envía. Todos los
consumidores usan inbox.

## Ejecutar

```bash
npm run up
node proyecto-final/preparar.ts --borrar
```

Cada proceso en su terminal, para leer sus logs por separado:

```bash
node proyecto-final/api.ts
node proyecto-final/relay.ts
node proyecto-final/pedidos.ts
node proyecto-final/inventario.ts
node proyecto-final/pagos.ts
node proyecto-final/notificaciones.ts
```

O todos juntos: `node proyecto-final/iniciar.ts`.

## Probar los tres caminos

Datos iniciales: teclado (50, 10 unidades), mouse (20, 10) y monitor (400, 5). El pago se
rechaza si el total supera 1000.

```bash
node proyecto-final/pedir.ts teclado 2     # confirmado
node proyecto-final/pedir.ts mouse 50      # cancelado: sin stock
node proyecto-final/pedir.ts monitor 3     # cancelado: pago rechazado, stock liberado
```

Comprobar el stock:

```bash
docker compose exec postgres psql -U practica -c "table inventario.productos" -c "table inventario.reservas"
```

## La saga

Cada servicio confirma su propia transacción; no existe un `ROLLBACK` global. Cuando el pago se
rechaza, la reserva ya está guardada, así que se **compensa** con otra transacción que devuelve
el stock.

- Entre la reserva y la compensación el stock aparece descontado: es **consistencia eventual**.
- La compensación debe ser idempotente (`liberada` impide devolver dos veces).

| Estilo | Cómo funciona | Cuándo conviene |
|---|---|---|
| **Coreografía** (este proyecto) | cada servicio reacciona a eventos | pocos pasos |
| Orquestación | un coordinador envía órdenes y decide | muchos pasos o ramas; el flujo se ve en un sitio |

## Limitaciones de la fase 1

- Si RabbitMQ se cae, el relay y los consumidores terminan y hay que arrancarlos de nuevo.
- Un error temporal se reintenta cada segundo, sin espera creciente, hasta ir a la DLQ.
- Un pedido cuyo evento acaba en la DLQ se queda `pendiente`.
- Todos usan el usuario `guest` y la misma base de datos.
