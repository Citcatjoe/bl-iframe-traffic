import { useEffect, useState } from "react";
import { apiUrl } from "../config/api.js";
import { cleanText, when } from "../format.js";

/** Debug (?debug=1) : situations analysées des points suivis (GET /api/messages[?all=1]). */
export default function DebugFeed({ point }) {
  const [all, setAll] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(apiUrl(`/api/messages${all ? "?all=1" : ""}`))
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error?.message ?? `HTTP ${res.status}`);
        if (alive) setData(body);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [all]);

  if (!data) return <p className="text-sm text-ink-weak">{error ?? "Chargement des messages…"}</p>;

  const needle = q.trim().toLowerCase();
  const list = data.situations.filter(
    (s) =>
      (all || !point || s.crossings?.some((c) => c.id === point)) &&
      (!needle || [s.text_fr, s.text_de, s.situation_id].some((t) => t?.toLowerCase().includes(needle))),
  );

  return (
    <div className="rounded-xl border border-dashed border-line bg-surface-weak p-3">
      <p className="text-sm font-semibold">
        Debug : {list.length} / {data.situations.length} situations
      </p>
      <p className="mb-2 text-xs text-ink-weak">Relevé {when(data.fetched_at)}</p>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer…" className="min-w-0 flex-1 rounded-md border border-line px-2 py-1 text-sm" />
        <label className="flex items-center gap-1.5 text-xs text-ink-weak">
          <input type="checkbox" checked={all} onChange={(e) => (setData(null), setAll(e.target.checked))} />
          flux complet
        </label>
      </div>
      <ul className="divide-y divide-line">
        {list.map((s) => (
          <li key={s.situation_id} className="py-2 text-xs">
            <div className="mb-0.5 flex flex-wrap gap-1.5 font-mono text-[11px] text-ink-weak">
              {s.crossings?.map((c) => (
                <span key={c.id + c.dir} className="rounded bg-surface-strong px-1">
                  {c.id}/{c.dir}
                </span>
              ))}
              {s.status !== "active" && <span className="rounded bg-surface-strong px-1">{s.status}</span>}
              <span>{s.condition}</span>
              {s.jam && <span className="rounded bg-brand px-1 text-ink-inverse">{s.jam}</span>}
              {s.queue_km != null && <span>{s.queue_km} km</span>}
              {s.delay_min != null && <span>{s.delay_min} min</span>}
              {s.schedule && <span>{s.schedule.kind} {s.schedule.from}–{s.schedule.to}</span>}
            </div>
            <p className="text-ink">{cleanText(s.text_fr ?? s.text_de) || "(pas de texte)"}</p>
            <details className="mt-1">
              <summary className="cursor-pointer text-ink-weak">{s.situation_id} v{s.version}</summary>
              <pre className="mt-1 overflow-x-auto rounded bg-surface p-2 text-[10px]">{JSON.stringify(s, null, 2)}</pre>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
