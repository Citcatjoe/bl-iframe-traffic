import { useEffect, useState } from "react";

// Entre deux relectures : jamais moins (relevé en retard : on réessaie sans marteler le serveur), jamais plus que
// l'intervalle de repli.
const MIN_DELAY_MS = 20_000;

async function getJson(url) {
  let res;
  try {
    // no-cache : le navigateur revalide toujours (ETag → 304 si rien n'a changé) au lieu de servir une copie
    // gardée jusqu'à une minute ; le serveur répond depuis sa mémoire, sans rappeler l'API OFROU.
    res = await fetch(url, { cache: "no-cache" });
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

/**
 * Interroge `url` toutes les `intervalMs`, ou à l'heure donnée par `nextAt(data)` (ms epoch, null = intervalle)
 * pour relire juste après le prochain relevé du serveur. En pause tant que l'onglet est caché ; relit dès qu'il
 * redevient visible. En cas d'erreur, garde les dernières données et réessaie après `intervalMs`.
 * `nextAt` doit être une référence stable (fonction définie hors du composant).
 */
export function usePolling(url, intervalMs, nextAt) {
  const [state, setState] = useState({ data: null, error: null, status: null });
  useEffect(() => {
    if (!url) return;
    let alive = true;
    let timer = null;
    const schedule = (ms) => {
      clearTimeout(timer);
      timer = document.hidden ? null : setTimeout(run, ms);
    };
    const run = () =>
      getJson(url).then(
        (data) => {
          if (!alive) return;
          setState({ data, error: null, status: 200 });
          const at = nextAt?.(data);
          schedule(at == null ? intervalMs : Math.min(intervalMs * 5, Math.max(MIN_DELAY_MS, at - Date.now())));
        },
        (e) => {
          if (!alive) return;
          setState((s) => ({ data: s.data, error: e.message, status: e.status ?? null }));
          schedule(intervalMs);
        },
      );
    const onVisibility = () => {
      if (document.hidden) {
        clearTimeout(timer);
        timer = null;
      } else {
        run();
      }
    };
    run();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [url, intervalMs, nextAt]);
  return state;
}
