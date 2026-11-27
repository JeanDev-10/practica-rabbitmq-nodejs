CREATE TABLE IF NOT EXISTS l11_orders (
  id         uuid PRIMARY KEY,
  amount     integer     NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Eventos por publicar. Se escriben en la misma transacción que el pedido.
CREATE TABLE IF NOT EXISTS l11_outbox (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- orden de envío
  event_id     uuid        NOT NULL UNIQUE,                     -- viaja como messageId
  routing_key  text        NOT NULL,
  payload      jsonb       NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS l11_outbox_pending
  ON l11_outbox (id) WHERE published_at IS NULL;

-- Mensajes ya procesados por el consumidor. La clave primaria impide repetir.
CREATE TABLE IF NOT EXISTS l11_inbox (
  message_id  uuid PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- Sin restricción única a propósito: la protección la pone el inbox.
CREATE TABLE IF NOT EXISTS l11_charges (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id   uuid    NOT NULL,
  amount     integer NOT NULL,
  charged_at timestamptz NOT NULL DEFAULT now()
);
