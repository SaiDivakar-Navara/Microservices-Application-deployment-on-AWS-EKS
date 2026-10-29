import { useState } from "react";
import { Link } from "react-router-dom";
import { orders } from "../../api/services";
import { useAsync } from "../../lib/useAsync";
import { useToast } from "../../context/ToastContext";
import { formatDate, formatMoney, ORDER_STATUS } from "../../lib/format";
import StatusBadge from "../../components/StatusBadge";
import { ErrorState } from "../../components/EmptyState";

const NEXT = { PAID: ["SHIPPED", "Mark as shipped"], SHIPPED: ["DELIVERED", "Mark as delivered"] };

export default function AdminOrders() {
  const [status, setStatus] = useState("");
  const list = useAsync(() => orders.all({ status }), [status]);
  const toast = useToast();

  const advance = async (order) => {
    try {
      await orders.setStatus(order.id, NEXT[order.status][0]);
      toast.success(`Order #${order.id} updated`);
      list.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div className="detail-head">
        <h1>Orders</h1>
        <label className="select-wrap">
          <span className="sr-only">Filter by status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {Object.entries(ORDER_STATUS).map(([value, info]) => (
              <option key={value} value={value}>{info.label}</option>
            ))}
          </select>
        </label>
      </div>

      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <div className="skeleton block" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th className="num">Total</th><th /></tr>
            </thead>
            <tbody>
              {list.data.length === 0 && <tr><td colSpan={6} className="muted center">No orders with this status.</td></tr>}
              {list.data.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/orders/${o.id}`}>#{o.id}</Link></td>
                  <td>{o.user_name || o.user_email}<div className="muted small">{o.user_email}</div></td>
                  <td>{formatDate(o.created_at)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td className="num">{formatMoney(o.total)}</td>
                  <td className="num">
                    {NEXT[o.status] && <button className="btn btn-outline btn-sm" onClick={() => advance(o)}>{NEXT[o.status][1]}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
