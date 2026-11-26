# Lección 2 — Work queues (colas de trabajo)

## Concepto

Varios workers consumen de la **misma cola** y se reparten las tareas. Cada mensaje se entrega
a un solo worker a la vez. Para ir más rápido, arrancas más workers.

```
                         ┌──▶ worker A
producer ──▶ [ tareas ] ─┤
                         └──▶ worker B
```

### Ack, nack y reentrega

- `ack`: "procesado, bórralo".
- `nack` / `reject`: "no pude"; con `requeue: true` vuelve a la cola.
- Si el worker muere (se cierra su canal o conexión) sin hacer ack, el mensaje **vuelve a la
  cola** y llega marcado como `redelivered`.

Esto es entrega **al menos una vez**: una tarea puede ejecutarse dos veces. Tu código debe
tolerarlo (*idempotencia*, lección 6).

### Prefetch

Límite de mensajes sin ack que un consumidor puede tener a la vez. Sin límite, el broker
reparte todo de golpe, aunque un worker esté ocupado y otro libre.

## Ejecutar

Tres terminales, desde la raíz:

```bash
node lessons/02-work-queues/worker.ts A
node lessons/02-work-queues/worker.ts B
node lessons/02-work-queues/producer.ts 10
```

## Experimentos

1. **Mata un worker:** envía 10 tareas y pulsa Ctrl+C en A mientras trabaja. B recibe esa
   tarea como `REENTREGADA`.
2. **Prefetch alto:** arranca `worker.ts A 100` solo, envía 10 tareas y después arranca B.
   ¿Por qué B se queda sin trabajo? Mira la columna **Unacked** en la UI.
3. **Reparto justo:** repite con prefetch 1 en ambos y compara quién hace cuántas.
4. **Olvida el ack:** comenta `channel.ack(message)`, envía tareas y observa cómo el worker
   se detiene tras la primera. Deshaz el cambio.

## Autoevaluación

1. ¿Por qué el ack va después del trabajo y no antes?
2. ¿Qué ventaja y qué coste tiene subir el prefetch?
3. ¿Se mantiene el orden de las tareas con varios workers y reentregas?
