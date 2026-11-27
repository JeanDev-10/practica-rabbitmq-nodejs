# Lección 3 — Publish/Subscribe con `fanout`

## Concepto

En la lección 2 cada mensaje iba a **un** worker. Aquí cada suscriptor recibe **una copia**.
Un exchange `fanout` es como un altavoz: entrega a todas las colas enlazadas.

```
                       ┌──▶ [cola correo]    ──▶ suscriptor correo
emit ──▶ (fanout) ─────┤
                       └──▶ [cola auditoría] ──▶ suscriptor auditoria
```

La copia es **por cola**, no por consumidor: dos consumidores en la misma cola se reparten.

## Ejecutar

```bash
node lessons/03-pubsub-fanout/subscriber.ts correo
node lessons/03-pubsub-fanout/subscriber.ts auditoria
node lessons/03-pubsub-fanout/emit.ts "usuario 42 registrado"
```

## Qué mirar

En la UI, pestaña **Exchanges** → `leccion03.eventos` → **Bindings**. Al cerrar un suscriptor,
su cola `amq.gen-...` desaparece.

## Experimentos

1. **Nadie escucha:** cierra los suscriptores y publica. Arranca uno después: ¿llega el mensaje?
2. **Tercer suscriptor:** agrégalo sin tocar `emit.ts`.
3. **Cola con nombre:** en una copia de `subscriber.ts`, usa
   `assertQueue('leccion03.auditoria', { durable: true })` con ack manual. Ciérralo, publica y
   vuelve a abrirlo: ahora el mensaje esperó.

## Autoevaluación

1. ¿Qué pasa con un mensaje publicado en un exchange sin colas enlazadas?
2. ¿Cuándo usarías una cola exclusiva y cuándo una durable con nombre?
