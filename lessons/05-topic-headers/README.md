# Lección 5 — `topic` y `headers`

## `topic`: patrones sobre la routing key

La routing key son palabras separadas por puntos, por ejemplo `pedido.creado.pe`.

| Comodín | Significa |
|---|---|
| `*` | exactamente una palabra |
| `#` | cero o más palabras |

```bash
node lessons/05-topic-headers/topic-subscriber.ts "pedido.#"
node lessons/05-topic-headers/topic-subscriber.ts "*.*.pe"
node lessons/05-topic-headers/topic-emit.ts pedido.creado.pe "pedido 1"
node lessons/05-topic-headers/topic-emit.ts pago.rechazado.pe "pago 1"
node lessons/05-topic-headers/topic-emit.ts pedido.cancelado.mx "pedido 2"
```

Antes de ejecutar, anota qué suscriptor recibirá cada mensaje y compara.

## `headers`: enrutar por cabeceras

Ignora la routing key y compara las cabeceras del mensaje con las del binding (`x-match`).

```bash
node lessons/05-topic-headers/headers-subscriber.ts all
node lessons/05-topic-headers/headers-subscriber.ts any
node lessons/05-topic-headers/headers-emit.ts pdf reporte
node lessons/05-topic-headers/headers-emit.ts pdf factura
```

## Cuál usar

| Exchange | Enruta por | Úsalo para |
|---|---|---|
| `fanout` | nada | avisar a todos |
| `direct` | clave exacta | destinos fijos |
| `topic` | patrón de clave | eventos con jerarquía (el más flexible habitual) |
| `headers` | cabeceras | criterios que no caben en una sola clave |

## Experimentos

1. Suscríbete a `#`: ¿qué recibe?
2. ¿Coincide `pedido.*` con `pedido.creado.pe`? Predice y comprueba.
3. Enlaza una cola a `pedido.#` y `*.*.pe` a la vez y publica `pedido.creado.pe`. ¿Llega una o dos veces?

## Autoevaluación

1. Diseña las routing keys para los eventos de un sistema de tu trabajo.
2. ¿Cuándo preferirías `headers` sobre `topic`?
