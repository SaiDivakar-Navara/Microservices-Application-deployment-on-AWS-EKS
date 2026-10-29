const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const formatMoney = (value) => money.format(Number(value || 0));

export function formatDate(iso, withTime = false) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function timeAgo(iso) {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatDate(iso);
}

export const discountPercent = (price, compareAt) =>
  compareAt && compareAt > price ? Math.round((1 - price / compareAt) * 100) : 0;

export const ORDER_STATUS = {
  PENDING_PAYMENT: { label: "Awaiting payment", tone: "warn" },
  PAID: { label: "Paid", tone: "info" },
  SHIPPED: { label: "Shipped", tone: "info" },
  DELIVERED: { label: "Delivered", tone: "good" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
};
