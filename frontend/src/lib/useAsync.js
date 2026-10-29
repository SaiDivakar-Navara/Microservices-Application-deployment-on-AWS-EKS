import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Runs an async loader when the component mounts (and whenever `deps` change).
 * Returns { data, error, loading, reload }.
 */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const latest = useRef(0);

  const run = useCallback(() => {
    const ticket = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    loader()
      .then((data) => ticket === latest.current && setState({ data, error: null, loading: false }))
      .catch((error) => ticket === latest.current && setState({ data: null, error, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { ...state, reload: run };
}
