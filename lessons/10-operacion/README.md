# Lección 10 — Operación y producción

Los comandos de esta lección usan comillas de **bash** (en Windows, usa Git Bash).

## 1. Reconexión automática

Los brokers se reinician y las redes fallan. `amqplib` puede reconectar solo (opción
`recovery`), pero los canales y consumidores hay que crearlos de nuevo: eso hace `setup`
en [resilient.ts](resilient.ts).

```bash
node lessons/10-operacion/consumer.ts
node lessons/10-operacion/publisher.ts
docker compose restart rabbitmq      # en una tercera terminal
```

Mira cómo el publicador acumula pendientes y los envía al volver. Puede haber duplicados.
Los pendientes están en memoria: si el proceso muere, se pierden (lo resuelve la lección 11).

## 2. Alarmas de memoria y disco

Si el broker se queda sin recursos, **bloquea a quien publica** en lugar de caerse.

```bash
# Con publisher.ts corriendo: forzar la alarma bajando el umbral
docker compose exec rabbitmq rabbitmqctl set_vm_memory_high_watermark 0.001
# Restaurar (0.6 es el valor por defecto)
docker compose exec rabbitmq rabbitmqctl set_vm_memory_high_watermark 0.6
```

## 3. Usuarios, vhosts y permisos

`guest` es para desarrollo. En producción, cada aplicación tiene su usuario y solo los permisos
que necesita.

```bash
docker compose exec rabbitmq rabbitmqctl add_vhost practica
docker compose exec rabbitmq rabbitmqctl add_user app clave-local
docker compose exec rabbitmq rabbitmqctl set_permissions -p practica app '^app\.' '^app\.' '^app\.'
node lessons/10-operacion/permisos.ts
```

Las tres expresiones son, en orden: **configurar** (declarar y borrar), **escribir** (publicar)
y **leer** (consumir).

Para limpiar: `rabbitmqctl delete_user app` y `rabbitmqctl delete_vhost practica`.

## 4. Policies

Configuran muchas colas a la vez por patrón de nombre, **sin recrearlas** ni tocar el código.
Suelen ser preferibles a los argumentos `x-...` de las lecciones 7 y 9.

```bash
docker compose exec rabbitmq rabbitmqctl set_policy limite-eventos '^leccion10\.' \
  '{"max-length": 10000}' --apply-to queues
docker compose exec rabbitmq rabbitmqctl list_policies
docker compose exec rabbitmq rabbitmqctl clear_policy limite-eventos
```

A cada cola se le aplica **una** policy: la de mayor prioridad que coincida.

## 5. Observar

| Qué | Cómo |
|---|---|
| Colas | `rabbitmqctl list_queues name type messages_ready messages_unacknowledged consumers` |
| Conexiones y canales | `rabbitmqctl list_connections`, `rabbitmqctl list_channels` |
| Salud | `rabbitmq-diagnostics status`, `rabbitmq-diagnostics check_running` |
| Alarmas | `rabbitmq-diagnostics check_alarms` |
| Copia de la configuración | `rabbitmqctl export_definitions -` (no incluye mensajes) |

En producción se recogen métricas con Prometheus (plugin `rabbitmq_prometheus`) y Grafana.

Señales de problemas: `Ready` creciendo sin parar (faltan consumidores), `Unacked` alto
(consumidores atascados o prefetch excesivo), mensajes en las DLQ, conexiones que se abren y
cierran continuamente.

## 6. Clustering (solo teoría)

- Varios nodos comparten usuarios, exchanges, bindings y policies.
- Los mensajes se replican en **quorum queues** y **streams**, no en las classic.
- Usa 3 o 5 nodos: se necesita mayoría para seguir escribiendo.
- Un balanceador o varias direcciones en el cliente permiten reconectar a otro nodo.
- No conviene un clúster entre regiones lejanas; para eso están **federation** y **shovel**.

## Lista antes de producción

- [ ] TLS y usuarios propios; sin `guest`.
- [ ] Interfaz de administración no expuesta a internet.
- [ ] Quorum queues para lo importante, con DLQ y límites de longitud.
- [ ] Publisher confirms, ack manual y consumidores idempotentes.
- [ ] Reconexión probada reiniciando el broker.
- [ ] Alertas sobre alarmas, DLQ y colas que crecen.
- [ ] Plan de actualización de versiones.

## Autoevaluación

1. ¿Por qué tras reconectar no basta con tener otra vez la conexión?
2. ¿Qué ventaja tiene una policy sobre un argumento `x-...`?
3. Con 3 nodos, ¿qué pasa si caen 2?
