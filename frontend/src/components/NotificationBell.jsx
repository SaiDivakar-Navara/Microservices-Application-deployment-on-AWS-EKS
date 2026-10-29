import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { notifications } from "../api/services";
import { timeAgo } from "../lib/format";

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);
  const navigate = useNavigate();

  const refresh = useCallback(() => {
    notifications.list().then(setItems).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 20000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => wrapper.current && !wrapper.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const unread = items.filter((n) => !n.is_read).length;

  const openItem = async (n) => {
    setOpen(false);
    if (!n.is_read) {
      await notifications.markRead(n.id).catch(() => {});
      refresh();
    }
    if (n.order_id) navigate(`/orders/${n.order_id}`);
  };

  const readAll = async () => {
    await notifications.markAllRead().catch(() => {});
    refresh();
  };

  return (
    <div className="bell" ref={wrapper}>
      <button
        className="icon-btn header-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
      >
        <Bell size={20} />
        {unread > 0 && <span className="count-dot">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="popover">
          <div className="popover-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button className="link-btn" onClick={readAll}>
                Mark all as read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="popover-empty muted">Order and payment updates will show up here.</p>
          ) : (
            <ul className="popover-list">
              {items.slice(0, 6).map((n) => (
                <li key={n.id}>
                  <button className={`note ${n.is_read ? "" : "note-unread"}`} onClick={() => openItem(n)}>
                    <span className="note-title">{n.title}</span>
                    <span className="note-text">{n.message}</span>
                    <span className="note-time">{timeAgo(n.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link className="popover-foot" to="/notifications" onClick={() => setOpen(false)}>
            See all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
