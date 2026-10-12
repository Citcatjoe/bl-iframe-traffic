import { useState } from "react";
import { cleanText, dedupeUpcoming, when } from "../format.js";
import { Closures, DirectionDetail, LevelChip, PassStatus } from "./bits.jsx";
import HistoryChart from "./HistoryChart.jsx";
import { usePolling } from "../usePolling.js";

const RANGES = [6, 12, 24];
const HISTORY_REFRESH_MS = 3 * 60_000;

function currentMessages(c) {
  const seen = new Set();
  const all = [...c.directions.S.messages, ...c.directions.N.messages, ...(c.undirected ?? []), ...(c.pass?.messages ?? [])];
  return all.filter((m) => !seen.has(m.situation_id) && seen.add(m.situation_id));
}

export default function Focus({ c, size, showCounters, countersKnown }) {
  const [range, setRange] = useState(12);
  const hours = size === "compact" ? 12 : range;
  const history = usePolling(`/api/history?point=${encodeURIComponent(c.id)}&hours=${hours}`, HISTORY_REFRESH_MS);
  const msgs = currentMessages(c);
  const upcoming = dedupeUpcoming(c.upcoming);

  return (
    <article>
      <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-bold leading-tight">{c.name}</h1>
        <span className="text-sm text-stone-500">{c.kind}</span>
        <LevelChip level={c.level} />
      </header>

      <div className={`grid gap-3 ${size === "compact" ? "" : "grid-cols-2"}`}>
        {["S", "N"].map((k) => (
          <div key={k} className="rounded-lg border border-stone-200 p-3">
            <DirectionDetail dir={k} d={c.directions[k]} showCounters={showCounters} allCounters />
          </div>
        ))}
      </div>
      {!countersKnown && <p className="mt-1.5 text-xs text-stone-500">Mesures des compteurs indisponibles</p>}

      {c.pass && (
        <div className="mt-3">
          <PassStatus pass={c.pass} showCounters={showCounters} />
        </div>
      )}

      {msgs.length > 0 && (
        <section className="mt-3">
          <h2 className="text-sm font-semibold">Messages en cours</h2>
          <ul className="mt-1 space-y-1.5">
            {msgs.map((m) => (
              <li key={m.situation_id} className="text-sm leading-snug text-stone-800">
                <LevelChip level={m.level} short /> {cleanText(m.text_fr ?? m.text_de)}
                <span className="ml-1 text-xs text-stone-500">({when(m.created_time)})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mt-3">
          <Closures list={upcoming} />
        </section>
      )}

      <section className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Évolution sur {hours} h</h2>
          {size !== "compact" && (
            <div className="flex gap-1">
              {RANGES.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setRange(h)}
                  aria-pressed={range === h}
                  className={`rounded px-2 py-0.5 text-xs ${range === h ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700"}`}
                >
                  {h} h
                </button>
              ))}
            </div>
          )}
        </div>
        {history.data ? (
          <HistoryChart data={history.data} small={size === "compact"} directions={c.directions} />
        ) : (
          <p className="py-6 text-center text-sm text-stone-500">{history.error ?? "Chargement…"}</p>
        )}
        {history.data && history.error && <p className="text-xs text-red-700">{history.error}</p>}
      </section>
    </article>
  );
}
