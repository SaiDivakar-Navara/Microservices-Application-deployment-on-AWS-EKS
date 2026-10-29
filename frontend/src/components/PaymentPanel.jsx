import { useState } from "react";
import { CreditCard, Landmark, Lock } from "lucide-react";
import { payments } from "../api/services";
import { formatMoney } from "../lib/format";
import { invalidateInventory } from "../lib/useInventory";

const digitsOnly = (v) => v.replace(/\D/g, "");
const groupCard = (v) => digitsOnly(v).slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
const formatExpiry = (v) => {
  const d = digitsOnly(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

/** Pays for a PENDING_PAYMENT order. Used by checkout and by the order page. */
export default function PaymentPanel({ order, onPaid }) {
  const [method, setMethod] = useState("CARD");
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [upi, setUpi] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const payment = await payments.pay({
        order_id: order.id,
        method,
        card_number: method === "CARD" ? digitsOnly(card.number) : undefined,
        upi_id: method === "UPI" ? upi.trim() : undefined,
      });
      invalidateInventory();
      onPaid(payment);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>Payment</h2>
      <p className="muted">Order #{order.id} is reserved for you. Pay {formatMoney(order.total)} to confirm it.</p>

      <div className="tabs" role="tablist" aria-label="Payment method">
        <button type="button" role="tab" aria-selected={method === "CARD"} className={method === "CARD" ? "tab active" : "tab"} onClick={() => setMethod("CARD")}>
          <CreditCard size={16} /> Card
        </button>
        <button type="button" role="tab" aria-selected={method === "UPI"} className={method === "UPI" ? "tab active" : "tab"} onClick={() => setMethod("UPI")}>
          <Landmark size={16} /> UPI
        </button>
      </div>

      {method === "CARD" ? (
        <div className="fields">
          <label className="field span-2">
            <span>Card number</span>
            <input inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={card.number} onChange={(e) => setCard({ ...card, number: groupCard(e.target.value) })} required />
          </label>
          <label className="field">
            <span>Expiry</span>
            <input inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })} required />
          </label>
          <label className="field">
            <span>CVV</span>
            <input inputMode="numeric" autoComplete="cc-csc" placeholder="123" maxLength={4} value={card.cvv} onChange={(e) => setCard({ ...card, cvv: digitsOnly(e.target.value) })} required />
          </label>
          <p className="hint span-2">Demo store: use 4242 4242 4242 4242. A card ending 0002 is declined and one ending 9995 has no funds.</p>
        </div>
      ) : (
        <div className="fields">
          <label className="field span-2">
            <span>UPI ID</span>
            <input placeholder="name@bank" autoComplete="off" value={upi} onChange={(e) => setUpi(e.target.value)} required />
          </label>
          <p className="hint span-2">Demo store: any ID like sam@upi works. An ID containing "fail" is declined.</p>
        </div>
      )}

      {error && <p className="alert alert-bad" role="alert">{error}</p>}

      <button className="btn btn-primary btn-lg block" disabled={busy}>
        <Lock size={16} /> {busy ? "Processing payment" : `Pay ${formatMoney(order.total)}`}
      </button>
    </form>
  );
}
