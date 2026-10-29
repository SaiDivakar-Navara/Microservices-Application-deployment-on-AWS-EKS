import logging
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from . import clients, config, db
from .schemas import OrderCreate, StatusUpdate

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("order-service")

app = FastAPI(title="Verve Order Service", version="1.0.0", docs_url="/api/orders/docs", openapi_url="/api/orders/openapi.json")


@app.on_event("startup")
def startup() -> None:
    db.init_pool()
    db.migrate()


# ---------- errors: always {"error": "..."} ----------
@app.exception_handler(HTTPException)
async def http_error(_req: Request, exc: HTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(_req: Request, exc: RequestValidationError):
    first = exc.errors()[0]
    where = ".".join(str(p) for p in first["loc"] if p != "body")
    return JSONResponse({"error": f"{where}: {first['msg']}" if where else first["msg"]}, status_code=422)


@app.exception_handler(httpx.HTTPError)
async def upstream_error(_req: Request, exc: httpx.HTTPError):
    log.error("upstream call failed: %s", exc)
    return JSONResponse({"error": "a required service is unavailable, please try again"}, status_code=503)


# ---------- identity ----------
class Caller(dict):
    @property
    def is_admin(self) -> bool:
        return self.get("role") == "ADMIN" or self.get("internal", False)


def caller(authorization: Optional[str] = Header(default=None), x_internal_key: Optional[str] = Header(default=None)) -> Caller:
    if x_internal_key == config.INTERNAL_API_KEY:
        return Caller(internal=True, role="ADMIN")
    user = clients.lookup_user(authorization)
    if not user:
        raise HTTPException(401, "sign in required")
    return Caller(user)


def internal_only(x_internal_key: Optional[str] = Header(default=None)) -> None:
    if x_internal_key != config.INTERNAL_API_KEY:
        raise HTTPException(403, "internal endpoint")


# ---------- helpers ----------
def money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def load_orders(cur, where: str = "", params: tuple = (), limit: int = 200) -> list[dict]:
    cur.execute(f"SELECT * FROM orders {where} ORDER BY id DESC LIMIT %s", params + (limit,))
    orders = cur.fetchall()
    if not orders:
        return []
    ids = [o["id"] for o in orders]
    cur.execute("SELECT * FROM order_items WHERE order_id = ANY(%s) ORDER BY id", (ids,))
    by_order: dict[int, list] = {}
    for item in cur.fetchall():
        by_order.setdefault(item["order_id"], []).append(item)
    for order in orders:
        order["items"] = by_order.get(order["id"], [])
    return orders


def load_order(order_id: int) -> dict:
    with db.transaction() as cur:
        rows = load_orders(cur, "WHERE id = %s", (order_id,))
    if not rows:
        raise HTTPException(404, "order not found")
    return rows[0]


def ensure_access(order: dict, who: Caller) -> None:
    if not who.is_admin and order["user_id"] != who.get("id"):
        raise HTTPException(404, "order not found")  # do not reveal other people's order IDs


# ---------- health ----------
@app.get("/health")
@app.get("/api/orders/health")
def health():
    try:
        with db.transaction() as cur:
            cur.execute("SELECT 1")
    except Exception:
        return JSONResponse({"service": "order-service", "status": "DOWN"}, status_code=503)
    return {"service": "order-service", "status": "UP", "language": "Python"}


# ---------- orders ----------
@app.post("/api/orders", status_code=201)
def create_order(payload: OrderCreate, who: Caller = Depends(caller)):
    if who.get("internal"):
        raise HTTPException(403, "orders must be placed by a signed-in shopper")

    # Merge duplicate lines, then price everything from the catalog (never trust client prices).
    wanted: dict[int, int] = {}
    for item in payload.items:
        wanted[item.product_id] = wanted.get(item.product_id, 0) + item.quantity

    lines, subtotal = [], Decimal("0")
    for product_id, quantity in sorted(wanted.items()):
        product = clients.get_product(product_id)
        if product is None or not product.get("active", True):
            raise HTTPException(409, f"product {product_id} is no longer available")
        unit = Decimal(str(product["price"]))
        line_total = money(unit * quantity)
        subtotal += line_total
        lines.append({
            "product_id": product_id, "name": product["name"], "category": product["category"],
            "emoji": product["emoji"], "color": product["color"],
            "unit_price": unit, "quantity": quantity, "line_total": line_total,
        })

    shipping = Decimal("0.00") if subtotal >= Decimal(config.FREE_SHIPPING_THRESHOLD) else Decimal(config.FLAT_SHIPPING)
    tax = money(subtotal * Decimal(config.TAX_RATE))
    total = money(subtotal + shipping + tax)

    reserved = False
    try:
        with db.transaction() as cur:
            cur.execute(
                """INSERT INTO orders (user_id, user_email, user_name, subtotal, shipping, tax, total, shipping_address)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                (who["id"], who["email"], who.get("name", ""), money(subtotal), shipping, tax, total,
                 db.json_value(payload.shipping_address.model_dump())),
            )
            order_id = cur.fetchone()["id"]
            for line in lines:
                cur.execute(
                    """INSERT INTO order_items (order_id, product_id, name, category, emoji, color, unit_price, quantity, line_total)
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (order_id, line["product_id"], line["name"], line["category"], line["emoji"], line["color"],
                     line["unit_price"], line["quantity"], line["line_total"]),
                )
            ok, body = clients.reserve_stock(order_id, [{"product_id": l["product_id"], "quantity": l["quantity"]} for l in lines])
            if not ok:
                names = {l["product_id"]: l["name"] for l in lines}
                short = body.get("shortages", [])
                detail = ", ".join(f"{names.get(s['product_id'], s['product_id'])} (only {s['available']} left)" for s in short)
                raise HTTPException(409, f"Not enough stock: {detail}" if detail else body.get("error", "Not enough stock"))
            reserved = True
    except Exception:
        if reserved:
            clients.release_stock(order_id)
        raise

    clients.notify(who["email"], "ORDER_PLACED", f"Order #{order_id} received",
                   f"We reserved your items. Complete payment of ${total:.2f} to confirm order #{order_id}.", order_id)
    return load_order(order_id)


@app.get("/api/orders")
def list_orders(all: bool = False, status: Optional[str] = None, who: Caller = Depends(caller)):
    clauses, params = [], []
    if not (all and who.is_admin):
        clauses.append("user_id = %s")
        params.append(who.get("id"))
    if status:
        clauses.append("status = %s")
        params.append(status.upper())
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    with db.transaction() as cur:
        return load_orders(cur, where, tuple(params))


@app.get("/api/orders/{order_id}")
def get_order(order_id: int, who: Caller = Depends(caller)):
    order = load_order(order_id)
    ensure_access(order, who)
    return order


@app.post("/api/orders/{order_id}/cancel")
def cancel_order(order_id: int, who: Caller = Depends(caller)):
    order = load_order(order_id)
    ensure_access(order, who)
    if order["status"] != "PENDING_PAYMENT":
        raise HTTPException(409, f"an order that is {order['status'].lower().replace('_', ' ')} can no longer be cancelled")
    with db.transaction() as cur:
        cur.execute("UPDATE orders SET status = 'CANCELLED' WHERE id = %s AND status = 'PENDING_PAYMENT'", (order_id,))
        if cur.rowcount == 0:
            raise HTTPException(409, "order status changed, please refresh")
    clients.release_stock(order_id)
    clients.notify(order["user_email"], "ORDER_CANCELLED", f"Order #{order_id} cancelled",
                   "Your order was cancelled and the reserved items are back in stock.", order_id)
    return load_order(order_id)


@app.patch("/api/orders/{order_id}/status")
def update_status(order_id: int, payload: StatusUpdate, who: Caller = Depends(caller)):
    if not who.is_admin:
        raise HTTPException(403, "admin access required")
    order = load_order(order_id)
    allowed = {"SHIPPED": "PAID", "DELIVERED": "SHIPPED"}
    if order["status"] != allowed[payload.status]:
        raise HTTPException(409, f"cannot move an order from {order['status']} to {payload.status}")
    with db.transaction() as cur:
        cur.execute("UPDATE orders SET status = %s WHERE id = %s", (payload.status, order_id))
    messages = {
        "SHIPPED": ("Your order is on the way", f"Order #{order_id} has shipped."),
        "DELIVERED": ("Your order was delivered", f"Order #{order_id} has been delivered. Enjoy!"),
    }
    title, text = messages[payload.status]
    clients.notify(order["user_email"], f"ORDER_{payload.status}", title, text, order_id)
    return load_order(order_id)


@app.post("/api/orders/{order_id}/mark-paid", dependencies=[Depends(internal_only)])
def mark_paid(order_id: int):
    """Called by payment-service after a successful charge. Safe to call twice."""
    order = load_order(order_id)
    if order["status"] == "PAID":
        return order
    if order["status"] != "PENDING_PAYMENT":
        raise HTTPException(409, f"order is {order['status']} and cannot be paid")
    with db.transaction() as cur:
        cur.execute("UPDATE orders SET status = 'PAID', paid_at = NOW() WHERE id = %s", (order_id,))
    return load_order(order_id)
