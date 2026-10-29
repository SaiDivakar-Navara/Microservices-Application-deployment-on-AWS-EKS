import pg from "pg";

// BIGINT comes back as a string by default; product and order IDs fit safely in a JS number.
pg.types.setTypeParser(20, (v) => Number(v));

const sslRequired = ["require", "verify-full", "verify-ca"].includes(process.env.DB_SSLMODE);

export const pool = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "inventory_db",
  user: process.env.DB_USER || "verve",
  password: process.env.DB_PASSWORD || "verve_pass",
  // Amazon RDS needs TLS; a local container does not.
  ssl: sslRequired ? { rejectUnauthorized: false } : false,
});

/** Runs fn inside a transaction and rolls back if it throws. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function waitForDatabase(attempts = 30) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      console.log(`waiting for database (${i}/${attempts}): ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("database unreachable");
}

// Stock for the 24 products seeded by catalog-service (IDs 1..24).
// Product 3 is low and product 21 is sold out so the storefront shows both states.
const SEED_QUANTITIES = [
  40, 120, 6, 55, 80, 35, 45, 90, 150, 70, 200, 64, 48, 30, 85, 110, 160, 220, 140, 75, 0, 25, 300, 180,
];

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stock (
      product_id    BIGINT PRIMARY KEY,
      quantity      INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      reserved      INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
      reorder_level INTEGER NOT NULL DEFAULT 10 CHECK (reorder_level >= 0),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (reserved <= quantity)
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id         BIGSERIAL PRIMARY KEY,
      order_id   BIGINT NOT NULL,
      product_id BIGINT NOT NULL,
      quantity   INTEGER NOT NULL CHECK (quantity > 0),
      status     VARCHAR(20) NOT NULL DEFAULT 'RESERVED',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (order_id, product_id)
    )`);

  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM stock");
  if (rows[0].n === 0) {
    for (let i = 0; i < SEED_QUANTITIES.length; i++) {
      await pool.query("INSERT INTO stock (product_id, quantity) VALUES ($1, $2)", [i + 1, SEED_QUANTITIES[i]]);
    }
    console.log(`seeded stock for ${SEED_QUANTITIES.length} products`);
  }
}
