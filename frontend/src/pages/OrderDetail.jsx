import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { orders } from "../api/services";
import { useAsync } from "../lib/useAsync";
import { useToast } from "../context/ToastContext";
import { formatDate, formatMoney } from "../lib/format";
import { invalidateInventory } from "../lib/useInventory";
import StatusBadge from "../components/StatusBadge";
import PaymentPanel from "../components/PaymentPanel";
import ProductArt from "../components/ProductArt";
import { ErrorState } from "../components/EmptyState";

const TIMELINE = ["PENDING_PAYMENT", "PAID", "SHIPPED", "DELIVERED"];
const TIMELINE_LABEL = { PENDING_PAYMENT: "Placed", PAID: "Paid", SHIPPED: "Shipped", DELIVERED: "Delivered" };

export default function OrderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const toast = useToast();
  const result = useAsync(() => orders.one(id), [id]);
  const [busy, setBusy] = useState(false);

  if (result.error) return <div className="page"><ErrorState error={result.error.status === 404 ? { message: "We could not find that order." } : result.error} onRetry={result.reload} /></div>;
  if (!result.data) return <div className="page"><div className="skeleton block tall" /></div>;

  const o = result.data;
  const step = TIMELINE.indexOf(o.status);
  const a = o.shipping_address;

  const cancel = async () => {
    if (!window.confirm(`Cancel order #${o.id}? The reserved items go back on sale.`)) return;
    setBusy(true);
    try {
      await orders.cancel(o.id);
      invalidateInventory();
      toast.success(`Order #${o.id} cancelled`);
      result.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      {location.state?.justPaid && (
        <div className="alert alert-good">
          <CheckCircle2 size={20} />
          <div>
            <strong>Thank you, your order is confirmed.</strong>
            <div>We sent a confirmation to your notifications and will let you know when it ships.</div>
          </div>
        </div>
      )}

      <div className="detail-head">
        <div>
          <h1>Order #{o.id}</h1>
          <p className="muted">Placed {formatDate(o.created_at, true)}</p>
        </div>
        <StatusBadge status={o.status} />
      </div>

      {o.status !== "CANCELLED" && (
        <ol className="timeline" aria-label="Order progress">
          {TIMELINE.map((s, i) => (
            <li key={s} className={i < step ? "done" : i === step ? "current" : ""}>{TIMELINE_LABEL[s]}</li>
          ))}
        </ol>
      )}

      <div className="two-col">
        <div>
          {o.status === "PENDING_PAYMENT" && (
            <>
              <PaymentPanel order={o} onPaid={() => { toast.success("Payment received"); result.reload(); }} />
              <button className="btn btn-outline" onClick={cancel} disabled={busy}>Cancel this order</button>
            </>
          )}

          <section className="panel panel-flat">
            <h2>Items</h2>
            <ul className="lines compact">
              {o.items.map((i) => (
                <li key={i.id} className="line">
                  <Link to={`/product/${i.product_id}`}><ProductArt product={i} size="thumb" /></Link>
                  <div className="line-info">
                    <Link to={`/product/${i.product_id}`} className="line-name">{i.name}</Link>
                    <span className="muted small">{formatMoney(i.unit_price)} x {i.quantity}</span>
                  </div>
                  <strong className="line-total">{formatMoney(i.line_total)}</strong>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="summary">
          <h2>Summary</h2>
          <dl>
            <div><dt>Subtotal</dt><dd>{formatMoney(o.subtotal)}</dd></div>
            <div><dt>Shipping</dt><dd>{o.shipping === 0 ? "Free" : formatMoney(o.shipping)}</dd></div>
            <div><dt>Tax</dt><dd>{formatMoney(o.tax)}</dd></div>
            <div className="summary-total"><dt>Total</dt><dd>{formatMoney(o.total)}</dd></div>
          </dl>
          <h3>Shipping to</h3>
          <p className="small">
            {a.full_name}<br />
            {a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />
            {a.city}, {a.state} {a.postal_code}
          </p>
        </aside>
      </div>
    </div>
  );
}
