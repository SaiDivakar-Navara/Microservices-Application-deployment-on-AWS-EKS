import { Link } from "react-router-dom";

export default function EmptyState({ emoji = "🫙", title, text, action, to }) {
  return (
    <div className="empty">
      <div className="empty-emoji" aria-hidden="true">{emoji}</div>
      <h2>{title}</h2>
      {text && <p className="muted">{text}</p>}
      {action && to && (
        <Link className="btn btn-primary" to={to}>
          {action}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="empty">
      <div className="empty-emoji" aria-hidden="true">🔌</div>
      <h2>We could not load this</h2>
      <p className="muted">{error?.message || "Something went wrong."}</p>
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
