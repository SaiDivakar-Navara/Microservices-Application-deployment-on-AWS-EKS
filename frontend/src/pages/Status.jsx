import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { SERVICES, checkHealth } from "../api/services";

/** Live health of every microservice, reached through the same /api/<service> routes the app uses. */
export default function Status() {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    const entries = await Promise.all(SERVICES.map(async (s) => [s.key, await checkHealth(s.key)]));
    setResults(Object.fromEntries(entries));
    setLoading(false);
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  const checked = Object.keys(results).length;
  const up = Object.values(results).filter((r) => r.up).length;

  return (
    <div className="page narrow">
      <div className="detail-head">
        <div>
          <h1>Service status</h1>
          <p className="muted">{checked ? `${up} of ${SERVICES.length} services are up.` : "Checking services"}</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={run} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} /> Check again
        </button>
      </div>

      <ul className="status-list">
        {SERVICES.map((s) => {
          const r = results[s.key];
          return (
            <li key={s.key} className="status-row">
              <span className={`dot ${r ? (r.up ? "dot-up" : "dot-down") : "dot-wait"}`} aria-hidden="true" />
              <div className="status-main">
                <strong>{s.name} service</strong>
                <span className="muted small">{s.language} · port {s.port} · {s.db}</span>
              </div>
              <span className="muted small">{r ? `${r.ms} ms` : ""}</span>
              <span className={`badge ${r ? (r.up ? "badge-good" : "badge-bad") : "badge-muted"}`}>
                {r ? (r.up ? "Up" : "Down") : "Checking"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
