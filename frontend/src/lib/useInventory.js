import { useEffect, useState } from "react";
import { inventory } from "../api/services";

let cache = { at: 0, map: null };

/** Stock levels keyed by product id. Cached briefly so browsing does not re-fetch on every page. */
export function useInventory() {
  const [map, setMap] = useState(cache.map);

  useEffect(() => {
    if (cache.map && Date.now() - cache.at < 30000) return;
    inventory
      .all()
      .then((rows) => {
        cache = { at: Date.now(), map: Object.fromEntries(rows.map((r) => [r.product_id, r])) };
        setMap(cache.map);
      })
      .catch(() => {});
  }, []);

  return map;
}

export const invalidateInventory = () => {
  cache = { at: 0, map: null };
};
