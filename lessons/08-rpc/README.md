# Lección 8 — RPC (petición y respuesta)

## Concepto

Hasta ahora el productor enviaba y se olvidaba. En **RPC** necesita la respuesta.

```
          petición (replyTo, correlationId)
client ───────────────▶ [leccion08.stock] ──▶ server
   ▲                                             │
   └────────────── [amq.gen-...] ◀───────────────┘
          respuesta (mismo correlationId)
```

Dos propiedades del mensaje lo hacen posible:

| Propiedad | Para qué |
|---|---|
| `replyTo` | en qué cola quiere el cliente la respuesta |
| `correlationId` | a qué petición corresponde cada respuesta |

El cliente usa **una** cola de respuestas para todas sus peticiones y las distingue por el
`correlationId`.

## Ejecutar

```bash
node lessons/08-rpc/server.ts
node lessons/08-rpc/client.ts
node lessons/08-rpc/client.ts monitor
```

Compara el orden de las preguntas con el de las respuestas.

## Experimentos

1. **Sin servidor:** apágalo y ejecuta el cliente. A los 5 s da timeout. Mira que la cola
   `leccion08.stock` queda vacía porque las peticiones caducan (`expiration`).
2. **Varios servidores:** arranca dos y repite. Se reparten las peticiones como en la lección 2.
3. **Sin correlationId:** haz que el cliente resuelva la primera petición pendiente con
   cualquier respuesta. Observa cómo se cruzan los datos.
4. **Prefetch 1:** cambia `prefetch(10)` por `prefetch(1)` en el servidor y mide la diferencia.

## ¿Conviene usar RPC sobre RabbitMQ?

Piénsalo antes. El cliente vuelve a depender de que el servidor responda, que es justo lo que
la mensajería evitaba.

| Situación | Suele convenir |
|---|---|
| Necesitas la respuesta ya y el servicio tiene API | HTTP o gRPC |
| Puedes responder más tarde | evento de respuesta, sin esperar |
| Los consumidores solo son accesibles por el broker, o quieres repartir carga por la cola | RPC |

## A tener en cuenta

- **Siempre con timeout.** Una respuesta puede no llegar nunca.
- Un timeout no significa que no se ejecutó. Si la operación cambia datos, debe ser idempotente.
- Las respuestas aquí no son persistentes: si el cliente muere, se pierden con su cola.
- RabbitMQ ofrece **direct reply-to** (`amq.rabbitmq.reply-to`), que evita declarar la cola de
  respuestas.

## Autoevaluación

1. ¿Qué pasaría si todos los clientes compartieran la misma cola de respuestas?
2. ¿Por qué el servidor responde también los errores?
3. ¿Qué operación de tu trabajo *no* harías por RPC?
