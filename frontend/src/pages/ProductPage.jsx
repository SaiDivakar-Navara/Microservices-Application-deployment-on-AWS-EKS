import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, RotateCcw, ShoppingBag, Truck } from "lucide-react";
import { catalog, inventory } from "../api/services";
import { useAsync } from "../lib/useAsync";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { track } from "../lib/analytics";
import { discountPercent } from "../lib/format";
import ProductArt from "../components/ProductArt";
import Price from "../components/Price";
import Stars from "../components/Stars";
import QuantityStepper from "../components/QuantityStepper";
import ProductCard from "../components/ProductCard";
import { ErrorState } from "../components/EmptyState";

export default function ProductPage() {
  const { id } = useParams();
  const cart = useCart();
  const toast = useToast();
  const [quantity, setQuantity] = useState(1);

  const product = useAsync(() => catalog.product(id), [id]);
  const stock = useAsync(() => inventory.one(id).catch(() => null), [id]);
  const related = useAsync(
    () => (product.data ? catalog.products({ category: product.data.category, limit: 5 }) : Promise.resolve([])),
    [product.data?.category]
  );

  useEffect(() => {
    setQuantity(1);
    window.scrollTo({ top: 0 });
    track("product_view", Number(id));
  }, [id]);

  if (product.error) {
    return (
      <div className="page">
        {product.error.status === 404 ? (
          <ErrorState error={{ message: "This product is no longer available." }} />
        ) : (
          <ErrorState error={product.error} onRetry={product.reload} />
        )}
      </div>
    );
  }
  if (!product.data) return <div className="page"><div className="skeleton block tall" /></div>;

  const p = product.data;
  const s = stock.data;
  const available = s ? s.available : 20;
  const soldOut = s?.status === "OUT_OF_STOCK" || !p.active;
  const max = Math.max(1, Math.min(20, available));
  const off = discountPercent(p.price, p.compare_at_price);

  const add = () => {
    cart.add(p, quantity);
    toast.success(`${quantity > 1 ? quantity + " x " : ""}${p.name} added to your cart`);
  };

  return (
    <div className="page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/shop">Shop</Link>
        <span>/</span>
        <Link to={`/shop?category=${encodeURIComponent(p.category)}`}>{p.category}</Link>
        <span>/</span>
        <span aria-current="page">{p.name}</span>
      </nav>

      <div className="product">
        <ProductArt product={p} size="detail">
          {off > 0 && <span className="sticker sticker-sale sticker-big">-{off}%</span>}
        </ProductArt>

        <div className="product-info">
          <p className="card-brand">{p.brand}</p>
          <h1>{p.name}</h1>
          <Stars rating={p.rating} count={p.review_count} />
          <div className="product-price"><Price product={p} large /></div>
          <p className="product-desc">{p.description}</p>

          <div className="stock-line">
            {soldOut ? (
              <span className="stock stock-out">Sold out</span>
            ) : s?.status === "LOW_STOCK" ? (
              <span className="stock stock-low">Only {s.available} left, order soon</span>
            ) : (
              <span className="stock stock-in"><Check size={16} /> In stock</span>
            )}
          </div>

          <div className="buy-row">
            <QuantityStepper value={quantity} onChange={setQuantity} max={max} />
            <button className="btn btn-primary btn-lg grow" onClick={add} disabled={soldOut}>
              <ShoppingBag size={18} /> {soldOut ? "Sold out" : "Add to cart"}
            </button>
          </div>

          <ul className="assurances">
            <li><Truck size={18} /> Free shipping over $100, otherwise $7.99</li>
            <li><RotateCcw size={18} /> Free returns within 30 days</li>
          </ul>
        </div>
      </div>

      {related.data?.filter((r) => r.id !== p.id).length > 0 && (
        <section className="section">
          <div className="section-head"><h2>More in {p.category}</h2></div>
          <div className="grid">
            {related.data.filter((r) => r.id !== p.id).slice(0, 4).map((r) => (
              <ProductCard key={r.id} product={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
