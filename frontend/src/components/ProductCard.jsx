import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import ProductArt from "./ProductArt";
import Price from "./Price";
import Stars from "./Stars";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { discountPercent } from "../lib/format";

export function stockLabel(stock) {
  if (!stock) return null;
  if (stock.status === "OUT_OF_STOCK") return { text: "Sold out", tone: "out" };
  if (stock.status === "LOW_STOCK") return { text: `Only ${stock.available} left`, tone: "low" };
  return null;
}

export default function ProductCard({ product, stock }) {
  const cart = useCart();
  const toast = useToast();
  const off = discountPercent(product.price, product.compare_at_price);
  const label = stockLabel(stock);
  const soldOut = stock?.status === "OUT_OF_STOCK";

  const addToCart = () => {
    cart.add(product, 1);
    toast.success(`${product.name} added to your cart`);
  };

  return (
    <article className="card">
      <Link to={`/product/${product.id}`} className="card-link" aria-label={product.name}>
        <ProductArt product={product}>
          {off > 0 && <span className="sticker sticker-sale">-{off}%</span>}
          {label && <span className={`sticker sticker-${label.tone}`}>{label.text}</span>}
        </ProductArt>
      </Link>
      <div className="card-body">
        <p className="card-brand">{product.brand}</p>
        <h3 className="card-title">
          <Link to={`/product/${product.id}`}>{product.name}</Link>
        </h3>
        <Stars rating={product.rating} count={product.review_count} />
        <div className="card-foot">
          <Price product={product} />
          <button className="btn btn-round" onClick={addToCart} disabled={soldOut} aria-label={`Add ${product.name} to cart`}>
            <Plus size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card skeleton-card" aria-hidden="true">
          <div className="art art-card skeleton" />
          <div className="card-body">
            <div className="skeleton line short" />
            <div className="skeleton line" />
            <div className="skeleton line short" />
          </div>
        </div>
      ))}
    </div>
  );
}
