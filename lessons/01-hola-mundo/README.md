# Lección 1 — Hola mundo

## Concepto

```
producer.ts ──▶ (exchange por defecto "") ──▶ [ leccion01.hola ] ──▶ consumer.ts
```

El exchange por defecto entrega cada mensaje a la cola cuyo nombre coincide con la routing key.
`sendToQueue(cola, ...)` es un atajo para eso.

## Ejecutar

Desde la raíz del proyecto, con el broker arriba (`npm run up`):

```bash
node lessons/01-hola-mundo/producer.ts "mi primer mensaje"
node lessons/01-hola-mundo/consumer.ts
```

## Qué mirar

En http://localhost:15672 (guest / guest), pestaña **Queues and Streams** → `leccion01.hola`:

- **Ready:** mensajes esperando.
- **Unacked:** entregados pero sin confirmar.
- **Consumers:** cuántos están escuchando.

## Experimentos

1. **Desacoplamiento:** con el consumidor apagado, envía 5 mensajes. Mira `Ready = 5`.
   Después arranca el consumidor: los recibe todos.
2. **Persistencia:** envía mensajes, ejecuta `docker compose restart rabbitmq` y revisa que
   siguen ahí (cola `durable` + mensaje `persistent`).
3. **Dos consumidores:** abre dos terminales con `consumer.ts` y envía varios mensajes.
   ¿Reciben los dos cada mensaje, o se los reparten?
4. **Rompe el assert:** cambia `durable: true` por `false` solo en `consumer.ts` y ejecútalo.
   Lee el error y deshaz el cambio.

## Autoevaluación

1. ¿Qué diferencia hay entre una cola *durable* y un mensaje *persistent*?
2. ¿Qué pasa si publicas en el exchange por defecto con el nombre de una cola que no existe?

## Ojo

`persistent` no es una garantía total: sin *publisher confirms* (lección 6) el productor no
sabe si el broker llegó a guardar el mensaje.
