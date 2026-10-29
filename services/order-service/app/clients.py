"""HTTP calls to the other microservices."""
import logging
from typing import Optional

import httpx

from . import config

log = logging.getLogger("order-service")
TIMEOUT = httpx.Timeout(5.0)
INTERNAL = {"X-Internal-Key": config.INTERNAL_API_KEY}


def lookup_user(authorization: Optional[str]) -> Optional[dict]:
    """Returns the user that owns the Bearer token, or None."""
    if not authorization:
        return None
    try:
        resp = httpx.get(f"{config.AUTH_URL}/api/auth/me", headers={"Authorization": authorization}, timeout=TIMEOUT)
    except httpx.HTTPError as exc:
        log.error("auth-service unreachable: %s", exc)
        raise
    return resp.json() if resp.status_code == 200 else None


def get_product(product_id: int) -> Optional[dict]:
    resp = httpx.get(f"{config.CATALOG_URL}/api/catalog/products/{product_id}", timeout=TIMEOUT)
    if resp.status_code == 404:
        return None
    resp.raise_for_status()
    return resp.json()


def reserve_stock(order_id: int, items: list[dict]) -> tuple[bool, dict]:
    """Returns (ok, body). ok is False when the stock is not available."""
    resp = httpx.post(
        f"{config.INVENTORY_URL}/api/inventory/reservations",
        json={"order_id": order_id, "items": items}, headers=INTERNAL, timeout=TIMEOUT,
    )
    if resp.status_code == 409:
        return False, resp.json()
    resp.raise_for_status()
    return True, resp.json()


def release_stock(order_id: int) -> None:
    try:
        httpx.post(f"{config.INVENTORY_URL}/api/inventory/reservations/{order_id}/release", headers=INTERNAL, timeout=TIMEOUT)
    except httpx.HTTPError as exc:
        log.error("could not release stock for order %s: %s", order_id, exc)


def notify(user_email: str, kind: str, title: str, message: str, order_id: int) -> None:
    """Best effort: a notification failure never fails the order."""
    try:
        httpx.post(
            f"{config.NOTIFICATION_URL}/api/notifications",
            json={"user_email": user_email, "type": kind, "title": title, "message": message, "order_id": order_id},
            headers=INTERNAL, timeout=TIMEOUT,
        )
    except httpx.HTTPError as exc:
        log.warning("notification not sent: %s", exc)
