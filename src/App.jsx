import { useEffect, useState } from "react";
import Overview from "./components/Overview.jsx";
import Focus from "./components/Focus.jsx";
import DebugFeed from "./components/DebugFeed.jsx";
import { usePolling } from "./usePolling.js";
import { when } from "./format.js";

const NOW_REFRESH_MS = 60_000; // lit le cache du serveur, n'appelle jamais l'API OFROU
const params = new URLSearchParams(window.location.search);
const POINT = params.get("point");
const DEBUG = params.get("debug") === "1";

const QUERIES = { large: "(min-width: 900px)", standard: "(min-width: 480px)" };
const currentSize = () =>
  window.matchMedia(QUERIES.large).matches ? "large" : window.matchMedia(QUERIES.standard).matches ? "standard" : "compact";

/** Largeur de l'iframe : compact < 480 ≤ standard < 900 ≤ large. */
function useSize() {
  const [size, setSize] = useState(currentSize);
  useEffect(() => {
    const mqs = Object.values(QUERIES).map((q) => window.matchMedia(q));
    const on = () => setSize(currentSize());
    mqs.forEach((m) => m.addEventListener("change", on));
    return () => mqs.forEach((m) => m.removeEventListener("change", on));
  }, []);
  return size;
}

/** Auto-hauteur de l'iframe : signale la hauteur du document à la page hôte. */
function usePostHeight() {
  useEffect(() => {
    if (window.parent === window) return;
    let last = -1;
    const send = () => {
      const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
      if (height === last) return;
      last = height;
      window.parent.postMessage({ type: "bl-traffic:height", height, point: POINT }, "*");
    };
    const ro = new ResizeObserver(send);
    ro.observe(document.documentElement);
    send();
    return () => ro.disconnect();
  }, []);
}

export default function App() {
  const size = useSize();
  usePostHeight();
  const now = usePolling("/api/now", NOW_REFRESH_MS);
  const d = now.data;
  const countersKnown = !!d?.counters_at;
  const crossing = POINT && d ? d.crossings.find((c) => c.id === POINT) : null;

  return (
    <main className="mx-auto max-w-[964px] px-3 py-3 font-sans text-stone-900">
      {!POINT && (
        <header className="mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Trafic en direct</p>
          <h1 className={`font-bold leading-tight ${size === "compact" ? "text-lg" : "text-xl"}`}>Traversées alpines</h1>
        </header>
      )}

      {now.error && (
        <p role="alert" className="mb-2 text-xs text-red-700">
          {now.status === 503 ? "Données pas encore disponibles." : now.error}
          {d && ` Dernières données affichées (${when(d.fetched_at)}).`}
        </p>
      )}

      {!d && !now.error && <p className="py-8 text-center text-sm text-stone-500">Chargement…</p>}

      {d && POINT && !crossing && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Traversée inconnue : « {POINT} ». Valeurs possibles : {d.crossings.map((c) => c.id).join(", ")}.
        </p>
      )}
      {crossing && <Focus c={crossing} size={size} showCounters={countersKnown} countersKnown={countersKnown} />}
      {d && !POINT && <Overview crossings={d.crossings} size={size} showCounters={countersKnown} />}

      <footer className="mt-3 text-xs text-stone-500">
        Source : OFROU / opentransportdata.swiss
        {d && <> · mis à jour {when(d.fetched_at)}</>}
        {d && !POINT && !countersKnown && size !== "compact" && <> · mesures des compteurs indisponibles</>}
      </footer>

      {DEBUG && (
        <section className="mt-4">
          <DebugFeed point={POINT} />
        </section>
      )}
    </main>
  );
}
