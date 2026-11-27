# Lección 4 — Routing con `direct`

## Concepto

Un exchange `direct` entrega a las colas cuyo **binding key** es **exactamente igual** a la
**routing key** del mensaje.

```
                         ── error ──────────▶ [cola alertas]
emit ──▶ (direct) ──────┤
                         ── info/warn/error ▶ [cola consola]
```

## Ejecutar

```bash
node lessons/04-routing-direct/subscriber.ts error
node lessons/04-routing-direct/subscriber.ts info warn error
node lessons/04-routing-direct/emit.ts info "arrancó el servicio"
node lessons/04-routing-direct/emit.ts error "fallo al cobrar"
```

## Experimentos

1. **Clave sin destino:** `emit.ts debug "hola"`. ¿Alguien lo recibe? ¿El productor se entera?
2. **Mismo binding en dos colas:** abre dos suscriptores de `error`. Se comporta como `fanout`.
3. **Mayúsculas:** publica con `ERROR` y observa si coincide.

## Autoevaluación

1. ¿En qué se diferencia el exchange por defecto de uno `direct` creado por ti?
2. ¿Cómo harías que una cola reciba solo errores y otra todo?
