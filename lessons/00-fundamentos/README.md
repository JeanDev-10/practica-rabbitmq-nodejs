# Lección 0 — Fundamentos

## ¿Qué problema resuelve?

Sin broker, el servicio A llama directamente al B (por ejemplo, con HTTP). Si B está caído o
lento, A falla o espera. Con un broker, A deja un mensaje y sigue; B lo procesa cuando puede.

Piensa en una oficina de correos: dejas la carta y te vas. No necesitas que quien la recibe
esté en casa en ese momento.

**RabbitMQ** es un *message broker*: recibe, guarda, enruta y entrega mensajes.

## Las piezas

```
Productor ──publica──▶ Exchange ──binding──▶ Cola ──entrega──▶ Consumidor
```

| Pieza | Qué es |
|---|---|
| Productor | El programa que publica mensajes. |
| Exchange | Recibe cada publicación y decide a qué colas va. No guarda nada. |
| Binding | La regla que une un exchange con una cola. |
| Cola | Donde los mensajes esperan, normalmente en orden de llegada. |
| Consumidor | El programa que recibe mensajes y confirma (*ack*) que los procesó. |
| Routing key | La "dirección" que el productor pone en el mensaje. |

Un productor **nunca** publica directamente en una cola: siempre pasa por un exchange.
Cuando parezca que sí, está usando el *exchange por defecto* (`""`).

## Conexión y canal

- **Conexión:** un enlace TCP con el broker. Abrirla es caro; se reutiliza.
- **Canal:** una sesión ligera dentro de la conexión. Casi todas las operaciones van por un canal.
  Un error de protocolo suele cerrar el canal, no toda la conexión.

## AMQP y virtual hosts

- **AMQP 0-9-1** es el protocolo que usan estas lecciones. RabbitMQ también habla AMQP 1.0,
  MQTT, STOMP y un protocolo propio para *streams*.
- Un **vhost** es un espacio aislado (colas, exchanges y permisos propios). Aquí usamos `/`.

## ¿Cuándo usarlo?

**Sí:** tareas en segundo plano (correos, PDFs, imágenes), desacoplar servicios, absorber picos
de tráfico, avisar a varios sistemas de un mismo evento.

**No (o no todavía):** si necesitas la respuesta en el acto, si tienes un solo servicio sin
tareas lentas, o si lo que quieres es consultar datos como en una base de datos.

## RabbitMQ vs Kafka

| | RabbitMQ (colas) | Kafka |
|---|---|---|
| Modelo | El broker enruta y entrega | Registro (*log*) que el consumidor lee |
| Tras consumir | El mensaje se borra | El mensaje permanece según la retención |
| Fuerte en | Enrutamiento flexible, tareas, RPC | Volumen muy alto, releer eventos |

RabbitMQ también ofrece *streams*, un modelo de registro (lección 9).

## Autoevaluación

1. ¿Quién decide a qué cola va un mensaje: el productor o el exchange?
2. ¿Por qué se reutiliza la conexión y se abren canales?
3. Da un caso de tu trabajo donde un broker ayude y otro donde sobre.
