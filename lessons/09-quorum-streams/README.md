# Lección 9 — Quorum queues y streams

## Tres tipos de cola

| | Classic | Quorum | Stream |
|---|---|---|---|
| Replicada entre nodos | no | sí | sí |
| Al confirmar con ack | se borra | se borra | **no se borra** |
| Pensada para | datos que se pueden perder, colas temporales | trabajo importante | releer, muchos lectores |
| Se fija con | (por defecto) | `x-queue-type: quorum` | `x-queue-type: stream` |

## Quorum queues

Se replican con el algoritmo **Raft**: hay un líder y seguidores, y un mensaje se confirma
cuando la mayoría lo tiene. Con 3 nodos se tolera la caída de 1. Aquí hay un solo nodo, así que
verás su comportamiento pero **no** alta disponibilidad.

Reemplazan a las colas espejo (*mirrored*), eliminadas en RabbitMQ 4.0.

### `delivery-limit`

Cuenta las reentregas fallidas y, al superar el límite, manda el mensaje al DLX. Desde
RabbitMQ 4.3 importa cómo lo devuelvas:

| Acción | ¿Cuenta como fallo? |
|---|---|
| `reject` con requeue | sí |
| Se cierra la conexión o el canal sin ack | sí |
| `nack` con requeue | **no** |

```bash
node lessons/09-quorum-streams/quorum-producer.ts
node lessons/09-quorum-streams/quorum-worker.ts reject
```

El worker falla unas cuantas veces y el mensaje acaba en `leccion09.fallidas`. Después:

```bash
node lessons/09-quorum-streams/quorum-producer.ts
node lessons/09-quorum-streams/quorum-worker.ts nack
```

Ahora no termina nunca. Corta con Ctrl+C y vacía la cola desde la UI (**Purge Messages**).

## Streams

Un stream es un **registro** al que solo se añade al final, parecido a Kafka. Leer no borra:
cada consumidor elige desde dónde empezar, con su *offset* (posición).

```
offset:   0    1    2    3    4
stream: [ e1 | e2 | e3 | e4 | e5 ] ◀── se añade aquí
          ▲              ▲
     lector "first"   lector "3"
```

```bash
node lessons/09-quorum-streams/stream-producer.ts 5
node lessons/09-quorum-streams/stream-consumer.ts first
node lessons/09-quorum-streams/stream-consumer.ts 3
node lessons/09-quorum-streams/stream-consumer.ts next
```

Los mensajes se eliminan solo por **retención** (`x-max-age`, `x-max-length-bytes`), y se hace
por bloques (segmentos), así que no es exacta al segundo.

Con AMQP 0-9-1, tu aplicación debe **guardar el offset** por donde iba; si no, al reiniciar no
sabrá desde dónde seguir.

## Experimentos

1. Lee el mismo stream dos veces con `first`. ¿Sigue todo ahí?
2. Deja un lector `next` abierto y publica más eventos.
3. Con el worker `reject`, comenta el DLX en la topología de una cola **nueva** (otro nombre) y
   observa que al superar el límite el mensaje se descarta.
4. Ejecuta `docker compose restart rabbitmq` y vuelve a leer el stream.

## Autoevaluación

1. ¿Por qué un clúster de quorum necesita un número impar de nodos para aprovecharse bien?
2. Da un caso para stream y otro para quorum queue.
3. ¿Qué riesgo tiene usar `nack` con requeue ante un error permanente?
