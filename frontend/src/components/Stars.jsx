import { Star } from "lucide-react";

export default function Stars({ rating, count }) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span className="stars" aria-label={`${rating} out of 5 stars`}>
      <Star size={14} fill="currentColor" strokeWidth={0} />
      <strong>{Number(rating).toFixed(1)}</strong>
      {count !== undefined && <span className="muted">({count.toLocaleString("en-US")})</span>}
      <span className="sr-only">{rounded} stars</span>
    </span>
  );
}
