-- Un esquema por servicio. Cada servicio solo lee y escribe el suyo.
CREATE SCHEMA IF NOT EXISTS pedidos;
CREATE SCHEMA IF NOT EXISTS inventario;
CREATE SCHEMA IF NOT EXISTS pagos;
CREATE SCHEMA IF NOT EXISTS notificaciones;

CREATE TABLE IF NOT EXISTS pedidos.pedidos (
  id         uuid PRIMARY KEY,
  producto   text        NOT NULL,
  cantidad   integer     NOT NULL CHECK (cantidad > 0),
  estado     text        NOT NULL DEFAULT 'pendiente'
             CHECK (estado IN ('pendiente', 'confirmado', 'cancelado')),
  motivo     text,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventario.productos (
  id     text PRIMARY KEY,
  precio integer NOT NULL,
  stock  integer NOT NULL CHECK (stock >= 0)
);

-- Lo reservado por cada pedido: permite compensar una sola vez.
CREATE TABLE IF NOT EXISTS inventario.reservas (
  pedido_id uuid PRIMARY KEY,
  producto  text    NOT NULL,
  cantidad  integer NOT NULL,
  liberada  boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS pagos.pagos (
  pedido_id uuid PRIMARY KEY,
  total     integer NOT NULL,
  aprobado  boolean NOT NULL
);

CREATE TABLE IF NOT EXISTS notificaciones.enviadas (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pedido_id uuid NOT NULL,
  mensaje   text NOT NULL
);

-- Outbox (eventos por publicar) e inbox (eventos ya procesados).
CREATE TABLE IF NOT EXISTS pedidos.outbox (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id     uuid        NOT NULL UNIQUE,
  tipo         text        NOT NULL,
  datos        jsonb       NOT NULL,
  published_at timestamptz
);
CREATE TABLE IF NOT EXISTS inventario.outbox (LIKE pedidos.outbox INCLUDING ALL);
CREATE TABLE IF NOT EXISTS pagos.outbox (LIKE pedidos.outbox INCLUDING ALL);

CREATE TABLE IF NOT EXISTS pedidos.inbox (message_id uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS inventario.inbox (message_id uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS pagos.inbox (message_id uuid PRIMARY KEY);
CREATE TABLE IF NOT EXISTS notificaciones.inbox (message_id uuid PRIMARY KEY);
