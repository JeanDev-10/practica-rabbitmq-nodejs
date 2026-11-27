# Lección 6 — Fiabilidad

## Concepto

Un mensaje puede perderse o repetirse en varios puntos. Cada riesgo tiene su defensa:

```
productor ──▶ exchange ──▶ cola ──▶ consumidor
    ①             ②          ③          ④
```

| # | Riesgo | Defensa |
|---|---|---|
| ① | El productor no sabe si el broker recibió el mensaje | publisher confirms |
| ② | Ninguna cola coincide y el mensaje se descarta | `mandatory` + evento `return` |
| ③ | El broker se reinicia | cola `durable` + mensaje `persistent` |
| ④ | El consumidor muere a medio trabajo | `ack` manual |
| ④ | El mensaje llega dos veces | idempotencia |

### Publisher confirms

En un canal creado con `createConfirmChannel()`, el broker responde **ack** (me hago cargo) o
**nack** (no pude) por cada publicación. `waitForConfirms()` espera esas respuestas.

Un confirm **no** significa que un consumidor haya procesado el mensaje.

### `mandatory`

Un mensaje sin ninguna cola de destino se **confirma igual**. Con `mandatory: true`, además, el
broker lo devuelve por el evento `return`. Por eso `producer.ts` revisa las dos señales.

### Idempotencia

Con ack manual la entrega es **al menos una vez**: puede haber duplicados, ya sea porque el
consumidor murió antes del ack o porque el productor reintentó sin saber si el primer envío
llegó. La defensa es que procesar dos veces tenga el mismo resultado que una.

Aquí cada pago lleva un `messageId`, y el consumidor anota los cobrados en `cobros.log`.

## Ejecutar

```bash
node lessons/06-fiabilidad/consumer.ts
node lessons/06-fiabilidad/producer.ts pago-1
node lessons/06-fiabilidad/producer.ts pago-1    # duplicado: no se cobra otra vez
```

Para empezar de cero, borra `lessons/06-fiabilidad/cobros.log`.

## Experimentos

1. **Sin destino:** `producer.ts pago-2 clave.mala`. Verás el mensaje devuelto.
2. **Caída antes del ack:** arranca `consumer.ts --caer`, envía `pago-3` y, cuando muera,
   arranca `consumer.ts`. Llega `REENTREGADO` y no se cobra dos veces.
3. **Sin idempotencia:** comenta el bloque `if (alreadyCharged(id))`, repite el experimento 2
   y cuenta las líneas de `pago-3` en `cobros.log`. Deshaz el cambio.
4. **Broker apagado:** ejecuta `docker compose stop rabbitmq` y publica. Observa el error y
   vuelve a levantarlo con `npm run up`.

## Límites de este ejemplo

- Con **varios consumidores**, dos podrían comprobar a la vez y cobrar ambos. En una base de
  datos se resuelve con una restricción única dentro de la transacción.
- Cobrar con un servicio externo no se puede unir a esa transacción: se le envía el mismo id
  como clave de idempotencia.
- Si el broker no confirma, el mensaje puede haber llegado o no. Reintentar es correcto
  siempre que el consumidor sea idempotente.
- Guardar en tu base de datos **y** publicar sigue sin ser atómico: eso lo resuelve el outbox
  (lección 11).

## Autoevaluación

1. ¿Qué garantiza un confirm y qué no?
2. ¿Por qué un reintento del productor debe usar el **mismo** `messageId`?
3. ¿Es posible la entrega "exactamente una vez"? ¿Qué se hace en su lugar?
