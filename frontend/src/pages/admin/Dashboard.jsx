import { analytics } from "../../api/services";
import { useAsync } from "../../lib/useAsync";
import { formatMoney, ORDER_STATUS } from "../../lib/format";
import { ErrorState } from "../../components/EmptyState";

function Kpi({ label, value, sub }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
}

function SalesChart({ days }) {
  const W = 640;
  const H = 200;
  const pad = { l: 8, r: 8, t: 12, b: 26 };
  const max = Math.max(1, ...days.map((d) => d.revenue));
  const slot = (W - pad.l - pad.r) / days.length;
  const bar = slot * 0.62;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Revenue per day for the last 14 days">
      {[0.5, 1].map((f) => (
        <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + (H - pad.t - pad.b) * (1 - f)} y2={pad.t + (H - pad.t - pad.b) * (1 - f)} className="chart-grid" />
      ))}
      {days.map((d, i) => {
        const h = ((H - pad.t - pad.b) * d.revenue) / max;
        const x = pad.l + i * slot + (slot - bar) / 2;
        return (
          <g key={d.date}>
            <rect x={x} y={H - pad.b - h} width={bar} height={Math.max(h, d.revenue > 0 ? 2 : 0)} rx="3" className="chart-bar">
              <title>{`${d.date}: ${formatMoney(d.revenue)} from ${d.orders} orders`}</title>
            </rect>
            {(days.length - 1 - i) % 2 === 0 && (
              <text x={x + bar / 2} y={H - 8} textAnchor="middle" className="chart-label">
                {d.date.slice(8)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function BarList({ rows, valueOf, labelOf, format = (v) => v }) {
  const max = Math.max(1, ...rows.map(valueOf));
  return (
    <ul className="bar-list">
      {rows.map((r, i) => (
        <li key={i}>
          <span className="bar-label">{labelOf(r)}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${(valueOf(r) / max) * 100}%` }} /></span>
          <span className="bar-value">{format(valueOf(r))}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const summary = useAsync(() => analytics.summary());

  if (summary.error) return <ErrorState error={summary.error} onRetry={summary.reload} />;
  if (!summary.data) return <div className="skeleton block tall" />;

  const s = summary.data;
  const f = s.funnel;
  const funnel = [
    { label: "Product views", value: f.product_views },
    { label: "Added to cart", value: f.add_to_cart },
    { label: "Started checkout", value: f.checkout_started },
    { label: "Orders placed", value: f.orders_placed },
    { label: "Orders paid", value: f.orders_paid },
  ];

  return (
    <>
      <div className="detail-head">
        <h1>Dashboard</h1>
        <button className="btn btn-outline btn-sm" onClick={summary.reload}>Refresh</button>
      </div>

      <div className="kpis">
        <Kpi label="Revenue" value={formatMoney(s.totals.revenue)} sub={`${s.totals.paid_orders} paid orders`} />
        <Kpi label="Average order" value={formatMoney(s.totals.average_order_value)} />
        <Kpi label="Units sold" value={s.totals.units_sold} sub={`${s.totals.customers} ${s.totals.customers === 1 ? "customer" : "customers"}`} />
        <Kpi label="Payment success" value={`${s.payments.success_rate}%`} sub={`${s.payments.failed} failed attempts`} />
      </div>

      <div className="admin-grid">
        <section className="panel wide">
          <h2>Revenue, last 14 days</h2>
          <SalesChart days={s.sales_by_day} />
        </section>

        <section className="panel">
          <h2>Orders by status</h2>
          <BarList
            rows={Object.entries(s.orders_by_status)}
            labelOf={([status]) => ORDER_STATUS[status]?.label || status}
            valueOf={([, n]) => n}
          />
        </section>

        <section className="panel">
          <h2>Shopper funnel, 30 days</h2>
          <BarList rows={funnel} labelOf={(r) => r.label} valueOf={(r) => r.value} />
        </section>

        <section className="panel">
          <h2>Top products by revenue</h2>
          {s.top_products.length === 0 ? <p className="muted">No paid orders yet.</p> : (
            <BarList rows={s.top_products} labelOf={(r) => `${r.emoji} ${r.name}`} valueOf={(r) => r.revenue} format={formatMoney} />
          )}
        </section>

        <section className="panel">
          <h2>Revenue by category</h2>
          {s.category_revenue.length === 0 ? <p className="muted">No paid orders yet.</p> : (
            <BarList rows={s.category_revenue} labelOf={(r) => r.category} valueOf={(r) => r.revenue} format={formatMoney} />
          )}
        </section>

        <section className="panel">
          <h2>Most viewed</h2>
          {s.top_viewed.length === 0 ? <p className="muted">No product views yet.</p> : (
            <BarList rows={s.top_viewed} labelOf={(r) => `${r.emoji} ${r.name}`} valueOf={(r) => r.views} />
          )}
        </section>

        <section className="panel">
          <h2>Needs restocking</h2>
          {s.low_stock.length === 0 ? <p className="muted">Everything is well stocked.</p> : (
            <ul className="plain-list">
              {s.low_stock.map((p) => (
                <li key={p.product_id}>
                  <span>{p.emoji} {p.name}</span>
                  <span className={`badge ${p.status === "OUT_OF_STOCK" ? "badge-bad" : "badge-warn"}`}>
                    {p.status === "OUT_OF_STOCK" ? "Sold out" : `${p.available} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
