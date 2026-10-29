import { Link, useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useCart, priceBreakdown, FREE_SHIPPING_FROM } from "../context/CartContext";
import { useInventory } from "../lib/useInventory";
import { useAuth } from "../context/AuthContext";
import { formatMoney } from "../lib/format";
import { track } from "../lib/analytics";
import ProductArt from "../components/ProductArt";
import QuantityStepper from "../components/QuantityStepper";
import EmptyState from "../components/EmptyState";
import OrderSummary from "../components/OrderSummary";

export default function Cart() {
  const cart = useCart();
  const stock = useInventory();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { subtotal } = priceBreakdown(cart.subtotal);

  if (cart.lines.length === 0) {
    return (
      <div className="page">
        <EmptyState emoji="🛍️" title="Your cart is empty" text="Add a few things you like and they will wait for you here." action="Start shopping" to="/shop" />
      </div>
    );
  }

  const problems = cart.lines.filter((l) => stock?.[l.product_id] && l.quantity > stock[l.product_id].available);
  const toFree = FREE_SHIPPING_FROM - subtotal;

  const checkout = () => {
    track("checkout_started");
    navigate(user ? "/checkout" : "/login", { state: { from: "/checkout" } });
  };

  return (
    <div className="page">
      <h1>Your cart</h1>
      <div className="two-col">
        <div>
          {toFree > 0 ? (
            <p className="free-ship">Add <strong>{formatMoney(toFree)}</strong> more for free shipping.</p>
          ) : (
            <p className="free-ship done">You get free shipping on this order.</p>
          )}

          <ul className="lines">
            {cart.lines.map((l) => {
              const available = stock?.[l.product_id]?.available;
              const tooMany = available !== undefined && l.quantity > available;
              return (
                <li key={l.product_id} className="line">
                  <Link to={`/product/${l.product_id}`}>
                    <ProductArt product={l} size="thumb" />
                  </Link>
                  <div className="line-info">
                    <Link to={`/product/${l.product_id}`} className="line-name">{l.name}</Link>
                    <span className="muted small">{l.category}</span>
                    {tooMany && (
                      <span className="field-error">
                        {available === 0 ? "This item just sold out." : `Only ${available} available.`}
                      </span>
                    )}
                    <div className="line-actions">
                      <QuantityStepper
                        value={l.quantity}
                        max={Math.max(1, Math.min(cart.maxPerLine, available ?? cart.maxPerLine))}
                        onChange={(q) => cart.setQuantity(l.product_id, q)}
                        label={`Quantity of ${l.name}`}
                      />
                      <button className="link-btn danger" onClick={() => cart.remove(l.product_id)}>
                        <Trash2 size={15} /> Remove
                      </button>
                    </div>
                  </div>
                  <strong className="line-total">{formatMoney(l.price * l.quantity)}</strong>
                </li>
              );
            })}
          </ul>
        </div>

        <OrderSummary
          lines={cart.lines}
          action={
            <button className="btn btn-primary btn-lg block" onClick={checkout} disabled={problems.length > 0}>
              {user ? "Go to checkout" : "Sign in to check out"}
            </button>
          }
          note={problems.length > 0 ? "Update the highlighted items to continue." : null}
        />
      </div>
    </div>
  );
}
