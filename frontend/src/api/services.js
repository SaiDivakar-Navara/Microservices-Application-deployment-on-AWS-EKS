import { api } from "./client";

export const auth = {
  login: (email, password) => api("auth", "/login", { method: "POST", body: { email, password } }),
  register: (name, email, password) => api("auth", "/register", { method: "POST", body: { name, email, password } }),
  me: () => api("auth", "/me", { quiet: true }),
  logout: () => api("auth", "/logout", { method: "POST", quiet: true }),
};

export const catalog = {
  products: (params) => api("catalog", "/products", { params }),
  product: (id) => api("catalog", `/products/${id}`),
  categories: () => api("catalog", "/categories"),
  create: (product) => api("catalog", "/products", { method: "POST", body: product }),
  update: (id, product) => api("catalog", `/products/${id}`, { method: "PUT", body: product }),
  remove: (id) => api("catalog", `/products/${id}`, { method: "DELETE" }),
};

export const inventory = {
  all: () => api("inventory", ""),
  one: (productId) => api("inventory", `/${productId}`),
  setStock: (productId, quantity, reorderLevel) =>
    api("inventory", `/${productId}`, { method: "PUT", body: { quantity, reorder_level: reorderLevel } }),
};

export const orders = {
  mine: () => api("orders", ""),
  all: (params) => api("orders", "", { params: { all: true, ...params } }),
  one: (id) => api("orders", `/${id}`),
  create: (items, shippingAddress) =>
    api("orders", "", { method: "POST", body: { items, shipping_address: shippingAddress } }),
  cancel: (id) => api("orders", `/${id}/cancel`, { method: "POST" }),
  setStatus: (id, status) => api("orders", `/${id}/status`, { method: "PATCH", body: { status } }),
};

export const payments = {
  pay: (payment) => api("payments", "", { method: "POST", body: payment }),
};

export const notifications = {
  list: () => api("notifications", "", { quiet: true }),
  markRead: (id) => api("notifications", `/${id}/read`, { method: "POST" }),
  markAllRead: () => api("notifications", "/read-all", { method: "POST" }),
};

export const analytics = {
  summary: () => api("analytics", "/summary"),
};

export const SERVICES = [
  { key: "auth", name: "Auth", language: "Java", port: 8081, db: "auth_db" },
  { key: "catalog", name: "Catalog", language: "Go", port: 8082, db: "catalog_db" },
  { key: "inventory", name: "Inventory", language: "Node.js", port: 8083, db: "inventory_db" },
  { key: "orders", name: "Orders", language: "Python", port: 8084, db: "order_db" },
  { key: "payments", name: "Payments", language: "C#", port: 8085, db: "payment_db" },
  { key: "notifications", name: "Notifications", language: "Ruby", port: 8086, db: "notification_db" },
  { key: "analytics", name: "Analytics", language: "PHP", port: 8087, db: "analytics_db" },
];

/** Health check for one service; resolves with how long it took. */
export async function checkHealth(key) {
  const started = performance.now();
  try {
    const data = await api(key, "/health", { quiet: true });
    return { up: data?.status === "UP", ms: Math.round(performance.now() - started) };
  } catch {
    return { up: false, ms: Math.round(performance.now() - started) };
  }
}
