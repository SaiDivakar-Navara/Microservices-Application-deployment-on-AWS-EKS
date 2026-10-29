import { Link } from "react-router-dom";
import { orders } from "../api/services";
import { useAsync } from "../lib/useAsync";
import { formatDate, formatMoney } from "../lib/format";
import StatusBadge from "../components/StatusBadge";
import EmptyState, { ErrorState } from "../components/EmptyState";

export default function Orders() {
  const list = useAsync(() => orders.mine());

  return (
    <div className="page">
      <h1>My orders</h1>
      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <div className="skeleton block" />
      ) : list.data.length === 0 ? (
        <EmptyState emoji="📦" title="No orders yet" text="Your orders will appear here once you place one." action="Start shopping" to="/shop" />
      ) : (
        <ul className="order-list">
          {list.data.map((o) => (
            <li key={o.id}>
              <Link to={`/orders/${o.id}`} className="order-row">
                <div className="order-thumbs" aria-hidden="true">
                  {o.items.slice(0, 3).map((i) => (
                    <span key={i.id} style={{ "--art-bg": i.color }}>{i.emoji}</span>
                  ))}
                </div>
                <div className="order-main">
                  <strong>Order #{o.id}</strong>
                  <span className="muted small">
                    {formatDate(o.created_at)} · {o.items.reduce((n, i) => n + i.quantity, 0)} items
                  </span>
                </div>
                <StatusBadge status={o.status} />
                <strong className="order-total">{formatMoney(o.total)}</strong>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
