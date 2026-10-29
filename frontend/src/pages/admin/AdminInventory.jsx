import { useState } from "react";
import { catalog, inventory } from "../../api/services";
import { useAsync } from "../../lib/useAsync";
import { useToast } from "../../context/ToastContext";
import { invalidateInventory } from "../../lib/useInventory";
import ProductArt from "../../components/ProductArt";
import { ErrorState } from "../../components/EmptyState";

const TONE = { IN_STOCK: ["badge-good", "In stock"], LOW_STOCK: ["badge-warn", "Low"], OUT_OF_STOCK: ["badge-bad", "Sold out"] };

function Row({ product, stock, onSaved }) {
  const [value, setValue] = useState(String(stock?.quantity ?? 0));
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const changed = Number(value) !== (stock?.quantity ?? 0);
  const [tone, label] = TONE[stock?.status] || ["badge-muted", "No stock record"];

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await inventory.setStock(product.id, Number(value));
      invalidateInventory();
      toast.success(`Stock for ${product.name} set to ${value}`);
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr>
      <td>
        <div className="cell-product">
          <ProductArt product={product} size="tiny" />
          <div><strong>{product.name}</strong><div className="muted small">#{product.id}</div></div>
        </div>
      </td>
      <td className="num">{stock?.reserved ?? 0}</td>
      <td className="num">{stock?.available ?? 0}</td>
      <td><span className={`badge ${tone}`}>{label}</span></td>
      <td className="num">
        <form className="inline-form" onSubmit={save}>
          <label className="sr-only" htmlFor={`qty-${product.id}`}>On hand for {product.name}</label>
          <input id={`qty-${product.id}`} type="number" min="0" value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="btn btn-outline btn-sm" disabled={!changed || busy}>Save</button>
        </form>
      </td>
    </tr>
  );
}

export default function AdminInventory() {
  const data = useAsync(async () => {
    const [products, stock] = await Promise.all([catalog.products({ all: "true" }), inventory.all()]);
    return { products: products.sort((a, b) => a.id - b.id), stock: Object.fromEntries(stock.map((s) => [s.product_id, s])) };
  });

  if (data.error) return <ErrorState error={data.error} onRetry={data.reload} />;
  if (!data.data) return <div className="skeleton block" />;

  return (
    <>
      <div className="detail-head"><h1>Inventory</h1></div>
      <p className="muted">On hand is what is in the warehouse. Reserved units are held by orders waiting for payment.</p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th className="num">Reserved</th><th className="num">Available</th><th>Status</th><th className="num">On hand</th></tr></thead>
          <tbody>
            {data.data.products.map((p) => (
              <Row key={`${p.id}-${data.data.stock[p.id]?.updated_at}`} product={p} stock={data.data.stock[p.id]} onSaved={data.reload} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
