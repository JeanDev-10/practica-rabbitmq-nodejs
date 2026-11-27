# Proyecto final — Sistema de pedidos con saga

Servicios de pedidos que se comunican por RabbitMQ, con saga coreografiada, outbox, inbox,
reintentos, DLQ, reconexión y permisos mínimos.

## Inicio rápido

```bash
npm install
npm run up
npm run verificar    # levanta los servicios, prueba 9 escenarios y limpia
```

> `verificar` **borra los datos del proyecto** y no arranca si ya hay una instancia en marcha.

## Dónde está cada idea

| Archivo | Qué contiene | Lección |
|---|---|---|
| `lib/events.ts` | exchanges, colas, bindings, colas de reintento | 5, 7, 9 |
| `lib/consume.ts` | inbox, reintentos, ack | 6, 7, 11 |
| `lib/connection.ts` | reconexión automática | 10 |
| `relay.ts` | outbox, confirms, `mandatory` | 6, 11 |
| `inventario.ts` | reserva y compensación | — |
| `preparar.ts` | topología, usuarios y permisos | 10 |
| `fallidas.ts` | revisión manual de la DLQ | 7 |
| `verificar.ts` | pruebas de punta a punta | — |

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

## Ejecutar a mano

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

## Fallos

| Situación | Qué hace el sistema |
|---|---|
| Error temporal (pasarela o base de datos) | reintenta a los 2, 4 y 8 s |
| Reintentos agotados | a `proyecto.fallidas`, para **revisión manual** |
| Mensaje mal formado | directo a la DLQ |
| RabbitMQ se reinicia | relay y consumidores reconectan; lo pendiente sigue en el outbox |
| Mensaje repetido | el inbox lo ignora |

Los reintentos pasan por un exchange propio de cada servicio hacia colas con TTL
(`proyecto.<servicio>.reintento.<ms>`), que devuelven el mensaje a su cola.

### Pasarela caída que se recupera

```bash
node proyecto-final/pasarela.ts caida
node proyecto-final/pedir.ts teclado 1
node proyecto-final/pasarela.ts ok        # en otra terminal, antes de unos 14 s
```

### Pasarela caída que no se recupera

Repite sin ejecutar `ok`. El pedido queda `pendiente` con el stock reservado:

```bash
node proyecto-final/fallidas.ts                 # ver
node proyecto-final/pasarela.ts ok
node proyecto-final/fallidas.ts --reprocesar    # el pedido se completa
```

No se cancela solo a propósito: con una pasarela real, un fallo de conexión no dice si el cobro
llegó a hacerse. Alguien debe comprobarlo.

### Reinicio del broker

```bash
docker compose restart rabbitmq
```

## Usuarios y permisos

`preparar.ts` (como administrador) crea la topología y un usuario por servicio. Ninguno puede
declarar ni borrar nada.

| Usuario | Publica en | Consume de |
|---|---|---|
| `relay` | `proyecto.eventos` | — |
| `<servicio>` | `proyecto.<servicio>.reintentos` | `proyecto.<servicio>` |

Las claves son de práctica, solo para local.

## Qué verifica `npm run verificar`

1. Pedido válido: confirmado, stock descontado y un solo aviso.
2. Sin stock: cancelado.
3. Pago rechazado: cancelado y stock liberado.
4. Eventos duplicados: no repiten efectos.
5. Pasarela caída que se recupera.
6. Pasarela caída sin recuperar: DLQ y reproceso manual.
7. Mensaje mal formado: a la DLQ.
8. Un servicio no puede consumir la cola de otro.
9. Reinicio de RabbitMQ sin perder pedidos.

**No cubre:** la caída de PostgreSQL, varias instancias de un mismo servicio en paralelo, la
muerte de un proceso a mitad de un mensaje ni la carga.

## Para seguir practicando

- Arranca dos `inventario.ts` y comprueba que no se vende de más.
- Añade una columna con la fecha a las reservas y detecta pedidos `pendiente` demasiado tiempo.
- Convierte la saga a **orquestada** y compara.
- Da a cada servicio su propio usuario de PostgreSQL.

## Limitaciones

- La API no usa RabbitMQ, pero depende de PostgreSQL.
- Todos los servicios usan el mismo usuario de base de datos: la separación por esquemas es una
  convención, no un permiso.
- `pasarela.ts` simula el fallo; el cobro es una fila en una tabla.
- Nadie avisa cuando algo llega a la DLQ: en producción haría falta una alerta.
- Con un solo nodo de RabbitMQ no hay alta disponibilidad.
