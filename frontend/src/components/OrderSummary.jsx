import ProductArt from "./ProductArt";
import { priceBreakdown } from "../context/CartContext";
import { formatMoney } from "../lib/format";

/** Price breakdown card used by the cart and checkout. */
export default function OrderSummary({ lines, action, note, showItems = false }) {
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const { shipping, tax, total } = priceBreakdown(subtotal);

  return (
    <aside className="summary">
      <h2>Order summary</h2>
      {showItems && (
        <ul className="summary-items">
          {lines.map((l) => (
            <li key={l.product_id}>
              <ProductArt product={l} size="tiny" />
              <span>{l.name} <span className="muted">x {l.quantity}</span></span>
              <span>{formatMoney(l.price * l.quantity)}</span>
            </li>
          ))}
        </ul>
      )}
      <dl>
        <div><dt>Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div>
        <div><dt>Shipping</dt><dd>{shipping === 0 ? "Free" : formatMoney(shipping)}</dd></div>
        <div><dt>Estimated tax</dt><dd>{formatMoney(tax)}</dd></div>
        <div className="summary-total"><dt>Total</dt><dd>{formatMoney(total)}</dd></div>
      </dl>
      {note && <p className="field-error">{note}</p>}
      {action}
    </aside>
  );
}
