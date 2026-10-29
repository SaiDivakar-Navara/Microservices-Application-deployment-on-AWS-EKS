import { useNavigate } from "react-router-dom";
import { notifications } from "../api/services";
import { useAsync } from "../lib/useAsync";
import { timeAgo } from "../lib/format";
import EmptyState, { ErrorState } from "../components/EmptyState";

export default function Notifications() {
  const list = useAsync(() => notifications.list());
  const navigate = useNavigate();

  const open = async (n) => {
    if (!n.is_read) await notifications.markRead(n.id).catch(() => {});
    if (n.order_id) navigate(`/orders/${n.order_id}`);
    else list.reload();
  };

  const readAll = async () => {
    await notifications.markAllRead().catch(() => {});
    list.reload();
  };

  return (
    <div className="page narrow">
      <div className="detail-head">
        <h1>Notifications</h1>
        {list.data?.some((n) => !n.is_read) && <button className="btn btn-outline btn-sm" onClick={readAll}>Mark all as read</button>}
      </div>
      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : !list.data ? (
        <div className="skeleton block" />
      ) : list.data.length === 0 ? (
        <EmptyState emoji="🔔" title="Nothing here yet" text="Order, payment and shipping updates will appear here." action="Browse products" to="/shop" />
      ) : (
        <ul className="note-list">
          {list.data.map((n) => (
            <li key={n.id}>
              <button className={`note ${n.is_read ? "" : "note-unread"}`} onClick={() => open(n)}>
                <span className="note-title">{n.title}</span>
                <span className="note-text">{n.message}</span>
                <span className="note-time">{timeAgo(n.created_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
