import { useEffect, useState } from "react";

async function getJson(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Serveur injoignable.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(body?.error?.message ?? `Erreur HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

/** Interroge `url` toutes les `intervalMs` ; en cas d'erreur, garde les dernières données. */
export function usePolling(url, intervalMs) {
  const [state, setState] = useState({ data: null, error: null, status: null });
  useEffect(() => {
    if (!url) return;
    let alive = true;
    const run = () =>
      getJson(url).then(
        (data) => alive && setState({ data, error: null, status: 200 }),
        (e) => alive && setState((s) => ({ data: s.data, error: e.message, status: e.status ?? null })),
      );
    run();
    const id = setInterval(run, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url, intervalMs]);
  return state;
}
