import express from "express";
import { pool, withTransaction, waitForDatabase, migrate } from "./db.js";
import { adminOnly, internalOnly } from "./auth.js";

const app = express();
app.use(express.json());

const STOCK_SELECT = `
  SELECT product_id, quantity, reserved, quantity - reserved AS available, reorder_level,
         CASE WHEN quantity - reserved <= 0 THEN 'OUT_OF_STOCK'
              WHEN quantity - reserved <= reorder_level THEN 'LOW_STOCK'
              ELSE 'IN_STOCK' END AS status,
         updated_at
  FROM stock`;

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// ---------- health ----------
async function health(_req, res) {
  try {
    await pool.query("SELECT 1");
    res.json({ service: "inventory-service", status: "UP", language: "Node.js" });
  } catch {
    res.status(503).json({ service: "inventory-service", status: "DOWN" });
  }
}
app.get("/health", health);
app.get("/api/inventory/health", health);

// ---------- public reads ----------
app.get("/api/inventory", async (_req, res) => {
  const { rows } = await pool.query(`${STOCK_SELECT} ORDER BY product_id`);
  res.json(rows);
});

app.get("/api/inventory/:productId", async (req, res) => {
  const { rows } = await pool.query(`${STOCK_SELECT} WHERE product_id = $1`, [req.params.productId]);
  if (!rows.length) throw new HttpError(404, "no stock record for this product");
  res.json(rows[0]);
});

// ---------- admin: set stock level ----------
app.put("/api/inventory/:productId", adminOnly, async (req, res) => {
  const productId = Number(req.params.productId);
  const quantity = Number(req.body.quantity);
  const reorderLevel = req.body.reorder_level === undefined ? null : Number(req.body.reorder_level);
  if (!Number.isInteger(quantity) || quantity < 0) throw new HttpError(400, "quantity must be a whole number, 0 or more");
  if (reorderLevel !== null && (!Number.isInteger(reorderLevel) || reorderLevel < 0)) {
    throw new HttpError(400, "reorder_level must be a whole number, 0 or more");
  }
  const result = await withTransaction(async (c) => {
    const current = await c.query("SELECT reserved FROM stock WHERE product_id = $1 FOR UPDATE", [productId]);
    if (!current.rows.length) {
      await c.query("INSERT INTO stock (product_id, quantity, reorder_level) VALUES ($1, $2, COALESCE($3, 10))", [
        productId, quantity, reorderLevel,
      ]);
    } else {
      if (quantity < current.rows[0].reserved) {
        throw new HttpError(409, `quantity cannot be lower than the ${current.rows[0].reserved} units reserved by open orders`);
      }
      await c.query(
        "UPDATE stock SET quantity = $2, reorder_level = COALESCE($3, reorder_level), updated_at = NOW() WHERE product_id = $1",
        [productId, quantity, reorderLevel]
      );
    }
    return (await c.query(`${STOCK_SELECT} WHERE product_id = $1`, [productId])).rows[0];
  });
  res.json(result);
});

// ---------- internal: reservations used by order-service and payment-service ----------
function parseItems(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) throw new HttpError(400, "items are required");
  const merged = new Map();
  for (const item of items) {
    const productId = Number(item.product_id);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity <= 0) {
      throw new HttpError(400, "each item needs a product_id and a positive whole-number quantity");
    }
    merged.set(productId, (merged.get(productId) || 0) + quantity);
  }
  return [...merged.entries()].sort((a, b) => a[0] - b[0]); // stable lock order avoids deadlocks
}

app.post("/api/inventory/reservations", internalOnly, async (req, res) => {
  const orderId = Number(req.body.order_id);
  if (!Number.isInteger(orderId)) throw new HttpError(400, "order_id is required");
  const items = parseItems(req.body);

  await withTransaction(async (c) => {
    const existing = await c.query("SELECT 1 FROM reservations WHERE order_id = $1 LIMIT 1", [orderId]);
    if (existing.rows.length) throw new HttpError(409, "this order already has a reservation");

    const shortages = [];
    for (const [productId, quantity] of items) {
      const row = await c.query("SELECT quantity, reserved FROM stock WHERE product_id = $1 FOR UPDATE", [productId]);
      const available = row.rows.length ? row.rows[0].quantity - row.rows[0].reserved : 0;
      if (available < quantity) shortages.push({ product_id: productId, requested: quantity, available });
    }
    if (shortages.length) throw new HttpError(409, "not enough stock", { shortages });

    for (const [productId, quantity] of items) {
      await c.query("UPDATE stock SET reserved = reserved + $2, updated_at = NOW() WHERE product_id = $1", [productId, quantity]);
      await c.query("INSERT INTO reservations (order_id, product_id, quantity) VALUES ($1, $2, $3)", [orderId, productId, quantity]);
    }
  });
  res.status(201).json({ order_id: orderId, status: "RESERVED" });
});

/** Moves every RESERVED line of an order to `next`; applying it twice is harmless. */
async function settle(orderId, next) {
  return withTransaction(async (c) => {
    const lines = await c.query("SELECT * FROM reservations WHERE order_id = $1 ORDER BY product_id FOR UPDATE", [orderId]);
    if (!lines.rows.length) throw new HttpError(404, "no reservation for this order");
    const state = lines.rows[0].status;
    if (state === next) return { order_id: orderId, status: next };
    if (state !== "RESERVED") throw new HttpError(409, `reservation is already ${state}`);

    for (const line of lines.rows) {
      if (next === "COMMITTED") {
        await c.query(
          "UPDATE stock SET quantity = quantity - $2, reserved = reserved - $2, updated_at = NOW() WHERE product_id = $1",
          [line.product_id, line.quantity]
        );
      } else {
        await c.query("UPDATE stock SET reserved = reserved - $2, updated_at = NOW() WHERE product_id = $1", [
          line.product_id, line.quantity,
        ]);
      }
    }
    await c.query("UPDATE reservations SET status = $2 WHERE order_id = $1", [orderId, next]);
    return { order_id: orderId, status: next };
  });
}

app.post("/api/inventory/reservations/:orderId/commit", internalOnly, async (req, res) => {
  res.json(await settle(Number(req.params.orderId), "COMMITTED"));
});

app.post("/api/inventory/reservations/:orderId/release", internalOnly, async (req, res) => {
  res.json(await settle(Number(req.params.orderId), "RELEASED"));
});

// ---------- errors ----------
app.use((req, res) => res.status(404).json({ error: `no route for ${req.method} ${req.path}` }));
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "request body is not valid JSON" });
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

await waitForDatabase();
await migrate();
const port = Number(process.env.PORT || 8083);
app.listen(port, () => console.log(`inventory-service listening on :${port}`));
