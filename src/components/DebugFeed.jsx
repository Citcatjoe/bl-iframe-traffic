import { useState } from "react";
import { cleanText, when } from "../format.js";

/** Flux complet (GET /api/now?all=1), chargé à la demande. */
export default function DebugFeed() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [onlyJams, setOnlyJams] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/now?all=1");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
      setData(body);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!data) {
    return (
      <div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          {loading ? "Chargement…" : "Voir le flux complet"}
        </button>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  const needle = q.trim().toLowerCase();
  const list = data.situations.filter(
    (s) =>
      (!onlyJams || s.jam) &&
      (!needle || [s.text_fr, s.text_de, s.situation_id].some((t) => t?.toLowerCase().includes(needle))),
  );

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          Flux complet : {list.length} / {data.situations.length} situations
        </p>
        <button type="button" onClick={() => setData(null)} className="text-xs text-stone-500 underline">
          Fermer
        </button>
      </div>
      <p className="mb-2 text-xs text-stone-500">
        Relevé {when(data.fetched_at)} · publication OFROU {when(data.publication_time)}
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrer (A2, Airolo, bouchon…)"
          className="min-w-0 flex-1 rounded-md border border-stone-300 px-2 py-1.5 text-sm"
        />
        <label className="flex items-center gap-1.5 text-xs text-stone-700">
          <input type="checkbox" checked={onlyJams} onChange={(e) => setOnlyJams(e.target.checked)} />
          bouchons seulement
        </label>
      </div>
      <ul className="max-h-[60vh] divide-y divide-stone-100 overflow-y-auto">
        {list.map((s) => (
          <li key={s.situation_id} className="py-2 text-xs">
            <div className="mb-0.5 flex flex-wrap gap-1.5 font-mono text-[11px] text-stone-500">
              {s.is_gothard && <span className="rounded bg-amber-100 px-1 text-amber-800">gothard</span>}
              {s.status === "cancelled" && <span className="rounded bg-stone-200 px-1">levé</span>}
              {s.jam && <span className="rounded bg-red-100 px-1 text-red-800">{s.jam}</span>}
              <span>{s.types.join("+")}</span>
              {s.direction && <span>{s.direction}</span>}
              {s.queue_km != null && <span>{s.queue_km} km</span>}
              {s.delay_min != null && <span>{s.delay_min} min</span>}
            </div>
            <p className="text-stone-800">{cleanText(s.text_fr ?? s.text_de) || "(pas de texte)"}</p>
            <details className="mt-1">
              <summary className="cursor-pointer text-stone-400">{s.situation_id} v{s.version}</summary>
              <pre className="mt-1 overflow-x-auto rounded bg-stone-50 p-2 text-[10px]">{JSON.stringify(s, null, 2)}</pre>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
