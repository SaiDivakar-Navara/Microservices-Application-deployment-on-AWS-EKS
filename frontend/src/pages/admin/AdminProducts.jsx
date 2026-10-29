import { useState } from "react";
import { catalog } from "../../api/services";
import { useAsync } from "../../lib/useAsync";
import { useToast } from "../../context/ToastContext";
import { formatMoney } from "../../lib/format";
import { invalidateInventory } from "../../lib/useInventory";
import ProductArt from "../../components/ProductArt";
import { ErrorState } from "../../components/EmptyState";

const BLANK = {
  name: "", brand: "", category: "Home", description: "", price: "", compare_at_price: "",
  emoji: "📦", color: "#E8ECF5", rating: 4.5, review_count: 0, featured: false, active: true,
};

function ProductForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...BLANK, ...initial, compare_at_price: initial?.compare_at_price ?? "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({
        ...form,
        price: Number(form.price),
        compare_at_price: form.compare_at_price === "" ? null : Number(form.compare_at_price),
        rating: Number(form.rating),
        review_count: Number(form.review_count),
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{initial?.id ? "Edit product" : "New product"}</h2>
        <div className="fields">
          <label className="field span-2"><span>Name</span><input value={form.name} onChange={set("name")} required /></label>
          <label className="field"><span>Brand</span><input value={form.brand} onChange={set("brand")} /></label>
          <label className="field"><span>Category</span><input value={form.category} onChange={set("category")} required list="categories" /></label>
          <datalist id="categories">{["Home", "Kitchen", "Tech", "Fashion", "Beauty", "Fitness"].map((c) => <option key={c} value={c} />)}</datalist>
          <label className="field span-2"><span>Description</span><textarea rows={3} value={form.description} onChange={set("description")} /></label>
          <label className="field"><span>Price (USD)</span><input type="number" min="0" step="0.01" value={form.price} onChange={set("price")} required /></label>
          <label className="field"><span>Original price <em className="muted">(for sales)</em></span><input type="number" min="0" step="0.01" value={form.compare_at_price} onChange={set("compare_at_price")} /></label>
          <label className="field"><span>Emoji</span><input value={form.emoji} onChange={set("emoji")} maxLength={4} /></label>
          <label className="field"><span>Tile colour</span><input type="color" value={form.color} onChange={set("color")} /></label>
          <label className="field span-2"><span>Image URL <em className="muted">(optional, replaces the emoji)</em></span><input value={form.image_url || ""} onChange={set("image_url")} placeholder="https://" /></label>
          <label className="check"><input type="checkbox" checked={form.featured} onChange={set("featured")} /> Featured on the home page</label>
          <label className="check"><input type="checkbox" checked={form.active} onChange={set("active")} /> Visible in the store</label>
        </div>
        {error && <p className="alert alert-bad" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Saving" : "Save product"}</button>
        </div>
      </form>
    </div>
  );
}

export default function AdminProducts() {
  const list = useAsync(() => catalog.products({ all: "true", sort: "newest" }).then((rows) => rows.sort((a, b) => a.id - b.id)));
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  const save = async (product) => {
    if (editing.id) await catalog.update(editing.id, product);
    else await catalog.create(product);
    toast.success(editing.id ? "Product updated" : "Product created. Set its stock on the Inventory page.");
    invalidateInventory();
    setEditing(null);
    list.reload();
  };

  const toggle = async (p) => {
    try {
      await catalog.update(p.id, { ...p, active: !p.active });
      toast.success(p.active ? `${p.name} hidden from the store` : `${p.name} is visible again`);
      list.reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div className="detail-head">
        <h1>Products</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({})}>Add product</button>
      </div>

      {list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : !list.data ? <div className="skeleton block" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Product</th><th>Category</th><th className="num">Price</th><th>Status</th><th /></tr></thead>
            <tbody>
              {list.data.map((p) => (
                <tr key={p.id} className={p.active ? "" : "row-muted"}>
                  <td>
                    <div className="cell-product">
                      <ProductArt product={p} size="tiny" />
                      <div><strong>{p.name}</strong><div className="muted small">#{p.id} · {p.brand}</div></div>
                    </div>
                  </td>
                  <td>{p.category}</td>
                  <td className="num">{formatMoney(p.price)}{p.compare_at_price && <div className="muted small"><s>{formatMoney(p.compare_at_price)}</s></div>}</td>
                  <td><span className={`badge ${p.active ? "badge-good" : "badge-muted"}`}>{p.active ? "Visible" : "Hidden"}</span></td>
                  <td className="num actions">
                    <button className="btn btn-outline btn-sm" onClick={() => setEditing(p)}>Edit</button>
                    <button className="btn btn-outline btn-sm" onClick={() => toggle(p)}>{p.active ? "Hide" : "Show"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <ProductForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />}
    </>
  );
}
