# Lección 7 — Errores: dead letter, TTL y reintentos

## El problema

Si un mensaje falla y haces `nack` con `requeue: true`, vuelve enseguida a la cola, falla otra
vez y así sin fin. Es un **mensaje venenoso**: consume CPU y estorba a los demás.

## Las piezas

- **Dead letter exchange (DLX):** exchange al que una cola reenvía mensajes que descarta, ya sea
  por `nack`/`reject` sin requeue, por TTL vencido o por superar la longitud máxima.
- **TTL:** tiempo máximo que un mensaje puede esperar en una cola.
- **DLQ:** cola enlazada al DLX donde quedan los fallidos para revisarlos.

## Reintentos con espera creciente (backoff)

Combinando TTL y DLX, una cola **sin consumidores** funciona como temporizador:

```
            ┌──────────────── al vencer el TTL ─────────────────┐
            ▼                                                   │
[leccion07.tareas] ──▶ worker ── error temporal ──▶ [reintento 2 s / 4 s / 8 s]
                         │
                         └── error permanente o sin reintentos ──▶ (DLX) ──▶ [fallidas]
```

| Tipo de error | Ejemplo | Qué hacer |
|---|---|---|
| Temporal | servicio caído, timeout | reintentar con espera |
| Permanente | datos inválidos | directo a la DLQ |

Hay **una cola por cada espera**. Una cola solo vence mensajes cuando llegan al frente; si
mezclaras TTL distintos en la misma, uno largo retendría a los cortos que van detrás.

## Ejecutar

```bash
node lessons/07-errores-reintentos/worker.ts
```

En otra terminal:

```bash
node lessons/07-errores-reintentos/producer.ts ok         # éxito al primer intento
node lessons/07-errores-reintentos/producer.ts temporal   # falla 2 veces y luego funciona
node lessons/07-errores-reintentos/producer.ts siempre    # agota reintentos (unos 14 s)
node lessons/07-errores-reintentos/producer.ts invalida   # directo a la DLQ
node lessons/07-errores-reintentos/fallidas.ts            # ver la DLQ sin vaciarla
node lessons/07-errores-reintentos/fallidas.ts --reprocesar
```

## Experimentos

1. **Mira la espera:** envía `siempre` y observa en la UI cómo el mensaje pasa por las colas de
   reintento. Compara las horas que imprime el worker.
2. **Bucle venenoso:** en `worker.ts`, cambia `nack(message, false, false)` por
   `nack(message, false, true)`, envía `invalida` y mira qué pasa. Ctrl+C y deshaz el cambio.
3. **No bloquea:** envía `siempre` y enseguida varias `ok`. Las `ok` no esperan.
4. **Cambia un TTL:** modifica `delays` a `[3000, 4000, 8000]` y ejecuta. Luego prueba a cambiar
   solo el `messageTtl` de una cola existente (sin cambiar su nombre) y lee el error.

## A tener en cuenta

- Los reintentos **alteran el orden** de los mensajes.
- Reintentar implica duplicados posibles: el worker debe ser idempotente (lección 6).
- Una DLQ que nadie mira solo esconde errores. En producción se vigila y genera alertas.
- Aquí se configura con argumentos de cola; en producción suele preferirse una **policy**, que se
  puede cambiar sin recrear la cola (lección 10).
- Las *quorum queues* limitan las reentregas con `delivery-limit` (lección 9).

## Autoevaluación

1. ¿Por qué no basta con `nack` y `requeue: true`?
2. ¿Por qué el worker espera el confirm antes de hacer ack del original?
3. ¿Cómo distingues un error temporal de uno permanente en tu trabajo?
