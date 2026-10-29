import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { track } from "../lib/analytics";

const CART_KEY = "verve.cart";
const MAX_PER_LINE = 20;

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

/** Each line keeps a snapshot of the product so the cart renders without extra requests. */
const snapshot = (p) => ({
  product_id: p.id,
  name: p.name,
  category: p.category,
  price: p.price,
  emoji: p.emoji,
  color: p.color,
});

export function CartProvider({ children }) {
  const [lines, setLines] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(lines));
    } catch {
      /* ignore */
    }
  }, [lines]);

  const add = useCallback((product, quantity = 1) => {
    track("add_to_cart", product.id);
    setLines((current) => {
      const existing = current.find((l) => l.product_id === product.id);
      if (existing) {
        return current.map((l) =>
          l.product_id === product.id
            ? { ...snapshot(product), quantity: Math.min(MAX_PER_LINE, l.quantity + quantity) }
            : l
        );
      }
      return [...current, { ...snapshot(product), quantity: Math.min(MAX_PER_LINE, quantity) }];
    });
  }, []);

  const setQuantity = useCallback((productId, quantity) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((l) => l.product_id !== productId)
        : current.map((l) => (l.product_id === productId ? { ...l, quantity: Math.min(MAX_PER_LINE, quantity) } : l))
    );
  }, []);

  const remove = useCallback((productId) => setLines((c) => c.filter((l) => l.product_id !== productId)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo(() => {
    const count = lines.reduce((n, l) => n + l.quantity, 0);
    const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.price, 0);
    return { lines, count, subtotal, add, setQuantity, remove, clear, maxPerLine: MAX_PER_LINE };
  }, [lines, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// Shipping and tax rules mirror order-service so the totals shown here match the order.
export const FREE_SHIPPING_FROM = 100;
export const FLAT_SHIPPING = 7.99;
export const TAX_RATE = 0.08;

export function priceBreakdown(subtotal) {
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_FROM ? 0 : FLAT_SHIPPING;
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  return { subtotal, shipping, tax, total: Math.round((subtotal + shipping + tax) * 100) / 100 };
}
