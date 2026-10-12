import { DIRS, LEVELS, closureText, delayText, hhmm, km, mainCounter } from "../format.js";

export function LevelChip({ level, short = false }) {
  const l = LEVELS[level] ?? LEVELS.clear;
  return (
    <span className={`inline-block whitespace-nowrap rounded px-1.5 py-px text-xs font-semibold ${l.chip}`}>
      {short ? l.short : l.label}
    </span>
  );
}

/** Chiffres clés d'un sens : km, retard (annoncé ou estimé). */
export function keyFigures(d) {
  return [d.queue_km != null ? `${km(d.queue_km)} km` : null, delayText(d)].filter(Boolean);
}

export function DirHeading({ dir, d }) {
  return (
    <span className="font-medium text-stone-800">
      <span aria-hidden="true">{DIRS[dir].arrow} </span>
      {d.label}
    </span>
  );
}

/** Détail d'un sens (vue standard / large / focus). */
export function DirectionDetail({ dir, d, showCounters, allCounters = false }) {
  const figs = keyFigures(d);
  const main = showCounters ? mainCounter(d) : null;
  const others = showCounters && allCounters ? (d.counters ?? []).filter((c) => !c.main) : [];
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <DirHeading dir={dir} d={d} />
        <LevelChip level={d.level} />
      </div>
      {(figs.length > 0 || d.since) && (
        <p className="mt-1 text-sm text-stone-800">
          {figs.join(" · ")}
          {d.since && d.level !== "clear" && <span className="text-stone-500">{figs.length ? " · " : ""}depuis {hhmm(d.since)}</span>}
        </p>
      )}
      {main && <p className="mt-0.5 text-xs text-stone-600">{main.name} : {counterText(main)}</p>}
      {others.length > 0 && (
        <p className="mt-0.5 text-xs text-stone-500">
          {others.map((c) => `${c.name} ${c.speed_light != null ? `${c.speed_light} km/h` : "–"}`).join(" · ")}
        </p>
      )}
    </div>
  );
}

/** Mesure d'une minute : sans véhicule, pas de vitesse. */
function counterText(c) {
  const flow = c.flow_light == null && c.flow_heavy == null ? null : (c.flow_light ?? 0) + (c.flow_heavy ?? 0);
  if (c.speed_light != null) return `${c.speed_light} km/h mesurés${flow != null ? ` · ${flow} véh./h` : ""}`;
  if (flow === 0) return "aucun véhicule à la dernière minute";
  return "mesure indisponible";
}

export function PassStatus({ pass, showCounters }) {
  if (!pass) return null;
  const sp = showCounters && pass.counters
    ? [["↓", pass.counters.S], ["↑", pass.counters.N]].filter(([, r]) => r?.speed_light != null).map(([a, r]) => `${a} ${r.speed_light}`)
    : [];
  return (
    <p className="text-sm text-stone-700">
      <span className="font-medium">{pass.label} :</span> {pass.closed ? <LevelChip level="closed" /> : "aucune fermeture signalée"}
      {sp.length > 0 && <span className="text-xs text-stone-500"> · {sp.join(" · ")} km/h mesurés</span>}
    </p>
  );
}

export function Closures({ list, title = "Prochaines fermetures" }) {
  if (!list.length) return null;
  return (
    <div className="text-sm">
      <p className="font-medium text-stone-800">{title}</p>
      <ul className="mt-0.5 space-y-0.5 text-stone-700">
        {list.map((m) => (
          <li key={m.situation_id + m.next_start}>{closureText(m)}</li>
        ))}
      </ul>
    </div>
  );
}
