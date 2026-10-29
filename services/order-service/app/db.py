import logging
import time
from contextlib import contextmanager

import psycopg2
from psycopg2.extensions import DECIMAL, new_type, register_type
from psycopg2.extras import Json, RealDictCursor
from psycopg2.pool import ThreadedConnectionPool

from . import config

log = logging.getLogger("order-service")

# NUMERIC columns come back as float so they serialise as plain JSON numbers.
register_type(new_type(DECIMAL.values, "DECIMAL_AS_FLOAT", lambda v, _cur: float(v) if v is not None else None))

_pool = None


def init_pool(attempts: int = 30) -> None:
    global _pool
    for attempt in range(1, attempts + 1):
        try:
            _pool = ThreadedConnectionPool(
                1, 10,
                host=config.DB_HOST, port=config.DB_PORT, dbname=config.DB_NAME,
                user=config.DB_USER, password=config.DB_PASSWORD, sslmode=config.DB_SSLMODE,
            )
            return
        except psycopg2.OperationalError as exc:
            log.warning("waiting for database (%d/%d): %s", attempt, attempts, str(exc).strip())
            time.sleep(2)
    raise RuntimeError("database unreachable")


@contextmanager
def transaction():
    """Yields a dict cursor. Commits on success, rolls back on any exception."""
    conn = _pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)


def migrate() -> None:
    with transaction() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id               BIGSERIAL PRIMARY KEY,
                user_id          BIGINT NOT NULL,
                user_email       VARCHAR(200) NOT NULL,
                user_name        VARCHAR(120) NOT NULL DEFAULT '',
                status           VARCHAR(30) NOT NULL DEFAULT 'PENDING_PAYMENT',
                subtotal         NUMERIC(10,2) NOT NULL,
                shipping         NUMERIC(10,2) NOT NULL,
                tax              NUMERIC(10,2) NOT NULL,
                total            NUMERIC(10,2) NOT NULL CHECK (total >= 0),
                shipping_address JSONB NOT NULL,
                created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                paid_at          TIMESTAMPTZ
            )""")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS order_items (
                id         BIGSERIAL PRIMARY KEY,
                order_id   BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                product_id BIGINT NOT NULL,
                name       VARCHAR(160) NOT NULL,
                category   VARCHAR(80) NOT NULL DEFAULT '',
                emoji      VARCHAR(16) NOT NULL DEFAULT '',
                color      VARCHAR(16) NOT NULL DEFAULT '',
                unit_price NUMERIC(10,2) NOT NULL,
                quantity   INTEGER NOT NULL CHECK (quantity > 0),
                line_total NUMERIC(10,2) NOT NULL
            )""")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id)")


def json_value(value):
    return Json(value)
