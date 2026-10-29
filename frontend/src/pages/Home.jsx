import { Link } from "react-router-dom";
import { Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { catalog } from "../api/services";
import { useAsync } from "../lib/useAsync";
import { useInventory } from "../lib/useInventory";
import ProductCard, { ProductGridSkeleton } from "../components/ProductCard";
import ProductArt from "../components/ProductArt";
import { ErrorState } from "../components/EmptyState";
import { discountPercent } from "../lib/format";

const CATEGORY_ART = {
  Home: { emoji: "🛋️", color: "#F3D9C4" },
  Kitchen: { emoji: "🍳", color: "#D5E8E0" },
  Tech: { emoji: "🎧", color: "#CFE0FA" },
  Fashion: { emoji: "🧶", color: "#F5D0DC" },
  Beauty: { emoji: "🧴", color: "#FCE0B8" },
  Fitness: { emoji: "🧘", color: "#D6E5F7" },
};

export default function Home() {
  const featured = useAsync(() => catalog.products({ featured: "true", limit: 8 }));
  const sale = useAsync(() => catalog.products({ on_sale: "true", sort: "price_desc", limit: 4 }));
  const categories = useAsync(() => catalog.categories());
  const stock = useInventory();

  const heroTiles = (featured.data || []).slice(0, 6);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <h1>Everyday things, well made.</h1>
          <p className="hero-sub">
            Home, kitchen, tech, style and fitness picks we would use ourselves. Free shipping on orders over $100.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" to="/shop">Shop all products</Link>
            <Link className="btn btn-outline btn-lg" to="/shop?on_sale=true">See deals</Link>
          </div>
        </div>

        <div className="hero-tiles" aria-hidden={heroTiles.length === 0}>
          {heroTiles.map((p, i) => (
            <Link key={p.id} to={`/product/${p.id}`} className={`hero-tile hero-tile-${i + 1}`} style={{ "--i": i }}>
              <ProductArt product={p} size="hero" />
              <span className="hero-tile-name">{p.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="perks" aria-label="Why shop with us">
        <div><Truck size={22} /><span><strong>Free shipping</strong> on orders over $100</span></div>
        <div><RotateCcw size={22} /><span><strong>30-day returns</strong> on everything</span></div>
        <div><ShieldCheck size={22} /><span><strong>Secure checkout</strong> with card or UPI</span></div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Shop by category</h2>
        </div>
        <div className="category-grid">
          {(categories.data || []).map((c) => {
            const art = CATEGORY_ART[c.name] || { emoji: "📦", color: "#E8ECF5" };
            return (
              <Link key={c.name} to={`/shop?category=${encodeURIComponent(c.name)}`} className="category-tile" style={{ "--art-bg": art.color }}>
                <span className="category-emoji" aria-hidden="true">{art.emoji}</span>
                <span className="category-name">{c.name}</span>
                <span className="category-count">{c.count} products</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Customer favourites</h2>
          <Link className="link" to="/shop?sort=popular">View all</Link>
        </div>
        {featured.error ? (
          <ErrorState error={featured.error} onRetry={featured.reload} />
        ) : featured.loading ? (
          <ProductGridSkeleton />
        ) : (
          <div className="grid">
            {featured.data.map((p) => (
              <ProductCard key={p.id} product={p} stock={stock?.[p.id]} />
            ))}
          </div>
        )}
      </section>

      {sale.data?.length > 0 && (
        <section className="sale-band">
          <div className="sale-band-inner">
            <div className="sale-copy">
              <h2>Marked down this week</h2>
              <p>Up to {Math.max(...sale.data.map((p) => discountPercent(p.price, p.compare_at_price)))}% off while stock lasts.</p>
              <Link className="btn btn-dark" to="/shop?on_sale=true">Shop deals</Link>
            </div>
            <div className="sale-items">
              {sale.data.map((p) => (
                <Link key={p.id} to={`/product/${p.id}`} className="sale-item">
                  <ProductArt product={p} size="mini" />
                  <span className="sale-item-name">{p.name}</span>
                  <span className="sticker sticker-sale sticker-inline">-{discountPercent(p.price, p.compare_at_price)}%</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
