# Lección 11 — Outbox e Inbox

## El problema: escritura doble (*dual write*)

Crear un pedido implica **guardarlo** y **publicar** `pedido.creado`. No hay una transacción que
cubra la base de datos y RabbitMQ a la vez.

- Guardas y el proceso muere antes de publicar → el pedido existe y nadie se entera.
- Publicas y luego falla el guardado → se procesa un pedido que no existe.

Los confirms (lección 6) no lo arreglan: solo cubren el tramo hasta el broker.

## La solución

```
                 una sola transacción
crear-pedido ──▶ [ l11_orders + l11_outbox ]
                                 │
                               relay ──▶ (leccion11.eventos) ──▶ [leccion11.cobros]
                                                                        │
                              [ l11_inbox + l11_charges ] ◀── consumer ─┘
                                 una sola transacción
```

- **Outbox:** el evento se guarda como una fila junto al pedido. Un *relay* lo publica después.
- **Inbox:** el consumidor anota el `messageId` en la misma transacción que el efecto.

El relay puede publicar y morir antes de marcar la fila, así que **publicará dos veces**. El
outbox garantiza "al menos una vez" y el inbox evita que el efecto se repita.

## Preparar

```bash
npm install
npm run up                                   # ahora levanta también PostgreSQL (puerto 5433)
node lessons/11-outbox/estado.ts --borrar
```

## Paso 1: ver el problema

```bash
node lessons/11-outbox/ingenuo.ts --caer
node lessons/11-outbox/estado.ts             # hay un pedido, pero ningún mensaje en la cola
```

## Paso 2: guardar con outbox

```bash
node lessons/11-outbox/estado.ts --borrar
node lessons/11-outbox/crear-pedido.ts 3
node lessons/11-outbox/crear-pedido.ts --fallar    # no queda ni pedido ni evento
node lessons/11-outbox/estado.ts                   # 3 pedidos, 3 pendientes
```

`crear-pedido.ts` no se conecta a RabbitMQ: funciona aunque el broker esté apagado.

## Paso 3: publicar y consumir

```bash
node lessons/11-outbox/consumer.ts
node lessons/11-outbox/relay.ts
```

## Paso 4: dos relays

Cierra el relay del paso 3. Arranca primero los dos relays, cada uno en su terminal, y después
crea los pedidos:

```bash
node lessons/11-outbox/relay.ts A
node lessons/11-outbox/relay.ts B
node lessons/11-outbox/crear-pedido.ts 40
```

Se reparten las filas gracias a `FOR UPDATE SKIP LOCKED`. Antes del paso 5, ciérralos.

## Paso 5: provocar un duplicado

```bash
node lessons/11-outbox/crear-pedido.ts
node lessons/11-outbox/relay.ts --caer       # publica y muere sin marcar
node lessons/11-outbox/relay.ts              # lo publica otra vez
node lessons/11-outbox/consumer.ts           # cobra una vez e ignora la otra
```

## Experimentos

1. Ejecuta `docker compose stop rabbitmq`, crea pedidos y comprueba que quedan pendientes.
   Levántalo con `npm run up` y arranca el relay.
2. En `consumer.ts`, quita el `if (inserted.rowCount === 0)` y repite el paso 5. Deshaz el cambio.
3. Corre `consumer.ts --caer` con un pedido y luego sin `--caer`.
4. Mira las filas: `docker compose exec postgres psql -U practica -c "table l11_outbox"`.

## Decisiones y límites

| Tema | En este ejemplo | A considerar |
|---|---|---|
| Detección | *polling* cada segundo | CDC lee el log de la base de datos (por ejemplo, Debezium): menos latencia, más infraestructura |
| Orden | se conserva aproximadamente con **un** relay | con varios relays se pierde |
| Transacción del relay | abierta mientras publica | lotes pequeños |
| Fallo en un lote | se revierte y se republica el lote | el inbox absorbe los duplicados |
| Limpieza | ninguna | borrar o archivar filas antiguas de outbox e inbox |
| Efectos externos | el cobro es una fila | un proveedor externo necesita su propia clave de idempotencia |

Si guardas los datos y el inbox en bases de datos distintas, vuelves a tener escritura doble.

## Autoevaluación

1. ¿Por qué el outbox no evita los duplicados?
2. ¿Qué pasaría sin `SKIP LOCKED` con dos relays?
3. ¿Cuándo **no** merece la pena este patrón?
