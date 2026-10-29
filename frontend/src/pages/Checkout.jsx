import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { orders } from "../api/services";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { invalidateInventory } from "../lib/useInventory";
import OrderSummary from "../components/OrderSummary";
import PaymentPanel from "../components/PaymentPanel";

const ADDRESS_KEY = "verve.address";
const EMPTY = { full_name: "", phone: "", line1: "", line2: "", city: "", state: "", postal_code: "" };

function savedAddress(name) {
  try {
    return { ...EMPTY, full_name: name, ...JSON.parse(localStorage.getItem(ADDRESS_KEY) || "{}") };
  } catch {
    return { ...EMPTY, full_name: name };
  }
}

export default function Checkout() {
  const cart = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [address, setAddress] = useState(() => savedAddress(user?.name || ""));
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!order && cart.lines.length === 0) return <Navigate to="/cart" replace />;

  const set = (field) => (e) => setAddress({ ...address, [field]: e.target.value });

  const placeOrder = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const created = await orders.create(
        cart.lines.map((l) => ({ product_id: l.product_id, quantity: l.quantity })),
        address
      );
      try {
        localStorage.setItem(ADDRESS_KEY, JSON.stringify(address));
      } catch {
        /* ignore */
      }
      invalidateInventory();
      cart.clear();
      setOrder(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const paid = () => {
    toast.success(`Payment received for order #${order.id}`);
    navigate(`/orders/${order.id}`, { replace: true, state: { justPaid: true } });
  };

  const summaryLines = order
    ? order.items.map((i) => ({ product_id: i.product_id, name: i.name, price: i.unit_price, quantity: i.quantity, emoji: i.emoji, color: i.color }))
    : cart.lines;

  return (
    <div className="page">
      <h1>Checkout</h1>
      <ol className="steps" aria-label="Checkout steps">
        <li className={order ? "done" : "current"}>Shipping</li>
        <li className={order ? "current" : ""}>Payment</li>
        <li>Confirmation</li>
      </ol>

      <div className="two-col">
        <div>
          {!order ? (
            <form className="panel" onSubmit={placeOrder}>
              <h2>Shipping address</h2>
              <div className="fields">
                <label className="field span-2">
                  <span>Full name</span>
                  <input value={address.full_name} onChange={set("full_name")} autoComplete="name" required minLength={2} />
                </label>
                <label className="field span-2">
                  <span>Phone <em className="muted">(optional)</em></span>
                  <input value={address.phone} onChange={set("phone")} autoComplete="tel" inputMode="tel" />
                </label>
                <label className="field span-2">
                  <span>Address</span>
                  <input value={address.line1} onChange={set("line1")} autoComplete="address-line1" required minLength={3} />
                </label>
                <label className="field span-2">
                  <span>Apartment, suite, landmark <em className="muted">(optional)</em></span>
                  <input value={address.line2} onChange={set("line2")} autoComplete="address-line2" />
                </label>
                <label className="field">
                  <span>City</span>
                  <input value={address.city} onChange={set("city")} autoComplete="address-level2" required />
                </label>
                <label className="field">
                  <span>State</span>
                  <input value={address.state} onChange={set("state")} autoComplete="address-level1" required />
                </label>
                <label className="field">
                  <span>Postal code</span>
                  <input value={address.postal_code} onChange={set("postal_code")} autoComplete="postal-code" required minLength={3} />
                </label>
              </div>
              {error && <p className="alert alert-bad" role="alert">{error}</p>}
              <button className="btn btn-primary btn-lg" disabled={busy}>
                {busy ? "Reserving your items" : "Continue to payment"}
              </button>
              <p className="hint">We reserve your items when you continue, so nobody else can buy them while you pay.</p>
            </form>
          ) : (
            <>
              <div className="panel panel-flat">
                <h2>Shipping to</h2>
                <p>
                  {order.shipping_address.full_name}<br />
                  {order.shipping_address.line1}{order.shipping_address.line2 ? `, ${order.shipping_address.line2}` : ""}<br />
                  {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.postal_code}
                </p>
              </div>
              <PaymentPanel order={order} onPaid={paid} />
            </>
          )}
        </div>
        <OrderSummary lines={summaryLines} showItems />
      </div>
    </div>
  );
}
