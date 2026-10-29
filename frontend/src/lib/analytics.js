import { api } from "../api/client";

function sessionId() {
  try {
    let id = sessionStorage.getItem("verve.session");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("verve.session", id);
    }
    return id;
  } catch {
    return "anonymous";
  }
}

/** Sends a storefront event to analytics-service. Never blocks or throws. */
export function track(type, productId) {
  api("analytics", "/events", {
    method: "POST",
    body: { type, product_id: productId ?? null, session_id: sessionId() },
    quiet: true,
  }).catch(() => {});
}
