import { useEffect, useState } from "react";
import DirectionCard from "./components/DirectionCard.jsx";
import HistoryChart from "./components/HistoryChart.jsx";
import DebugFeed from "./components/DebugFeed.jsx";
import { cleanText, when } from "./format.js";

const NOW_REFRESH_MS = 60_000; // lit le cache du serveur, n'appelle pas l'API OFROU
const HISTORY_REFRESH_MS = 3 * 60_000;
const RANGES = [6, 12, 24];

async function getJson(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Serveur injoignable.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  return body;
}

function usePolling(url, intervalMs) {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    let alive = true;
    const run = () =>
      getJson(url).then(
        (data) => alive && setState({ data, error: null }),
        (e) => alive && setState((s) => ({ data: s.data, error: e.message })),
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

export default function App() {
  const [hours, setHours] = useState(12);
  const now = usePolling("/api/now", NOW_REFRESH_MS);
  const history = usePolling(`/api/history?hours=${hours}`, HISTORY_REFRESH_MS);
  const d = now.data;

  return (
    <main className="mx-auto max-w-[632px] px-3 py-5 font-sans text-stone-900 sm:px-0">
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Trafic en direct</p>
        <h1 className="text-2xl font-bold leading-tight">État actuel au Gothard</h1>
        <p className="mt-1 text-sm text-stone-600">A2, tunnel routier et rampes d'accès (Erstfeld – Göschenen, Airolo – Faido).</p>
      </header>

      {now.error && (
        <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {now.error}
          {d && " Données affichées : dernier relevé réussi."}
        </p>
      )}

      {!d && !now.error && <p className="py-8 text-center text-sm text-stone-500">Chargement…</p>}

      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <DirectionCard direction="N-S" stats={d.summary["N-S"]} />
            <DirectionCard direction="S-N" stats={d.summary["S-N"]} />
          </div>

          {d.summary.alerts.length > 0 && (
            <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h2 className="mb-2 text-sm font-semibold text-amber-900">Autres messages en cours</h2>
              <ul className="space-y-2">
                {d.summary.alerts.map((a) => (
                  <li key={a.situation_id} className="text-sm leading-snug text-stone-800">
                    {cleanText(a.text_fr ?? a.text_de)}
                    <span className="ml-1 text-xs text-stone-500">({when(a.version_time)})</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">Évolution</h2>
          <div className="flex gap-1">
            {RANGES.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHours(h)}
                aria-pressed={hours === h}
                className={`rounded px-2 py-0.5 text-xs ${hours === h ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"}`}
              >
                {h} h
              </button>
            ))}
          </div>
        </div>
        {history.data ? (
          <HistoryChart series={history.data.series} hours={history.data.hours} />
        ) : (
          <p className="py-6 text-center text-sm text-stone-500">{history.error ?? "Chargement…"}</p>
        )}
      </section>

      <section className="mt-6">
        <DebugFeed />
      </section>

      <footer className="mt-6 border-t border-stone-200 pt-3 text-xs text-stone-500">
        <p>Source : OFROU / opentransportdata.swiss</p>
        {d && (
          <p>
            Dernier relevé : {when(d.fetched_at)} · actualisé toutes les {Math.round(d.poller.interval_s / 60)} min
          </p>
        )}
      </footer>
    </main>
  );
}
