import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { catalog } from "../api/services";
import { useAsync } from "../lib/useAsync";
import { useInventory } from "../lib/useInventory";
import { track } from "../lib/analytics";
import ProductCard, { ProductGridSkeleton } from "../components/ProductCard";
import EmptyState, { ErrorState } from "../components/EmptyState";

const SORTS = [
  { value: "", label: "Featured" },
  { value: "popular", label: "Most reviewed" },
  { value: "rating", label: "Top rated" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "newest", label: "Newest" },
];

const PRICE_BANDS = [
  { label: "Any price", min: "", max: "" },
  { label: "Under $30", min: "", max: "30" },
  { label: "$30 to $60", min: "30", max: "60" },
  { label: "$60 to $120", min: "60", max: "120" },
  { label: "Over $120", min: "120", max: "" },
];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const stock = useInventory();
  const categories = useAsync(() => catalog.categories());

  const q = params.get("q") || "";
  const category = params.get("category") || "";
  const sort = params.get("sort") || "";
  const min = params.get("min") || "";
  const max = params.get("max") || "";
  const onSale = params.get("on_sale") === "true";

  const products = useAsync(
    () => catalog.products({ q, category, sort, min, max, on_sale: onSale ? "true" : "" }),
    [q, category, sort, min, max, onSale]
  );

  useEffect(() => {
    if (q) track("search");
  }, [q]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  };

  const activeBand = PRICE_BANDS.findIndex((b) => b.min === min && b.max === max);
  const title = q ? `Results for "${q}"` : onSale ? "Deals" : category || "All products";
  const hasFilters = q || category || min || max || onSale;

  const filters = (
    <div className="filters">
      <fieldset>
        <legend>Category</legend>
        <label className="radio">
          <input type="radio" name="category" checked={!category} onChange={() => update({ category: "" })} />
          All categories
        </label>
        {(categories.data || []).map((c) => (
          <label key={c.name} className="radio">
            <input type="radio" name="category" checked={category === c.name} onChange={() => update({ category: c.name })} />
            {c.name} <span className="muted">({c.count})</span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Price</legend>
        {PRICE_BANDS.map((band, i) => (
          <label key={band.label} className="radio">
            <input
              type="radio"
              name="price"
              checked={activeBand === i || (activeBand === -1 && i === 0 && !min && !max)}
              onChange={() => update({ min: band.min, max: band.max })}
            />
            {band.label}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Offers</legend>
        <label className="check">
          <input type="checkbox" checked={onSale} onChange={(e) => update({ on_sale: e.target.checked ? "true" : "" })} />
          On sale
        </label>
      </fieldset>

      {hasFilters && (
        <button className="btn btn-outline btn-sm" onClick={() => setParams({}, { replace: true })}>
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="page">
      <div className="shop-head">
        <div>
          <h1>{title}</h1>
          {products.data && <p className="muted">{products.data.length} {products.data.length === 1 ? "product" : "products"}</p>}
        </div>
        <div className="shop-tools">
          <button className="btn btn-outline btn-sm filter-toggle" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal size={16} /> Filters
          </button>
          <label className="select-wrap">
            <span className="sr-only">Sort by</span>
            <select value={sort} onChange={(e) => update({ sort: e.target.value })}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="shop-layout">
        <aside className="shop-filters">{filters}</aside>

        {filtersOpen && (
          <div className="drawer-backdrop" onClick={() => setFiltersOpen(false)}>
            <div className="drawer" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-head">
                <strong>Filters</strong>
                <button className="icon-btn" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={20} /></button>
              </div>
              {filters}
              <button className="btn btn-primary" onClick={() => setFiltersOpen(false)}>Show {products.data?.length ?? ""} products</button>
            </div>
          </div>
        )}

        <div className="shop-results">
          {products.error ? (
            <ErrorState error={products.error} onRetry={products.reload} />
          ) : products.loading && !products.data ? (
            <ProductGridSkeleton count={6} />
          ) : products.data.length === 0 ? (
            <EmptyState
              emoji="🔍"
              title="No products match"
              text="Try a different search or remove a filter."
              action="Show all products"
              to="/shop"
            />
          ) : (
            <div className={`grid ${products.loading ? "is-loading" : ""}`}>
              {products.data.map((p) => (
                <ProductCard key={p.id} product={p} stock={stock?.[p.id]} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
