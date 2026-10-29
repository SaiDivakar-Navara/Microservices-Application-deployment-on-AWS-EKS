import { discountPercent, formatMoney } from "../lib/format";

export default function Price({ product, large = false }) {
  const off = discountPercent(product.price, product.compare_at_price);
  return (
    <span className={`price ${large ? "price-large" : ""}`}>
      <strong className={off ? "price-now sale" : "price-now"}>{formatMoney(product.price)}</strong>
      {off > 0 && <s className="price-was">{formatMoney(product.compare_at_price)}</s>}
    </span>
  );
}
