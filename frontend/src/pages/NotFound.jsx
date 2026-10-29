import EmptyState from "../components/EmptyState";

export default function NotFound() {
  return (
    <div className="page">
      <EmptyState emoji="🧭" title="That page does not exist" text="The link may be old or mistyped." action="Go to the store" to="/" />
    </div>
  );
}
