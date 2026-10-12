import { DIRS, closureText, dedupeUpcoming, levelRank, within24h } from "../format.js";
import { Closures, DirectionDetail, LevelChip, PassStatus, keyFigures } from "./bits.jsx";

const SIDES = ["S", "N"];

export default function Overview({ crossings, size, showCounters }) {
  const sorted = crossings
    .map((c, i) => ({ c, i }))
    .sort((a, b) => levelRank(a.c.level) - levelRank(b.c.level) || a.i - b.i)
    .map((x) => x.c);

  if (size === "large") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {sorted.map((c) => (
          <LargeCard key={c.id} c={c} showCounters={showCounters} />
        ))}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-stone-200 border-y border-stone-200">
      {sorted.map((c) =>
        size === "compact" ? <CompactRow key={c.id} c={c} /> : <StandardRow key={c.id} c={c} showCounters={showCounters} />,
      )}
    </ul>
  );
}

function Title({ c, small }) {
  return (
    <p className="leading-tight">
      <span className={`font-bold ${small ? "text-base" : "text-lg"}`}>{c.name}</span>
      {!small && <span className="ml-2 text-xs text-stone-500">{c.kind}</span>}
    </p>
  );
}

function nextSoon(c) {
  const next = dedupeUpcoming(c.upcoming)[0];
  return next && within24h(next) ? next : null;
}

function CompactRow({ c }) {
  const next = nextSoon(c);
  const allClear = SIDES.every((k) => c.directions[k].level === "clear");
  return (
    <li className="py-2">
      <Title c={c} small />
      {allClear ? (
        <p className="mt-0.5 text-sm text-stone-600">
          <span aria-hidden="true">↓↑ </span>
          <LevelChip level="clear" />
        </p>
      ) : (
        SIDES.map((k) => {
          const d = c.directions[k];
          return (
            <p key={k} className="mt-0.5 text-sm leading-snug">
              <span className="inline-block w-14 text-stone-700">
                {DIRS[k].arrow} {DIRS[k].short}
              </span>
              <LevelChip level={d.level} short />
              {keyFigures(d).length > 0 && <span className="ml-1.5 text-stone-800">{keyFigures(d).join(" · ")}</span>}
            </p>
          );
        })
      )}
      {next && <p className="mt-0.5 text-xs text-stone-700">Prochaine fermeture : {closureText(next)}</p>}
    </li>
  );
}

function StandardRow({ c, showCounters }) {
  const next = dedupeUpcoming(c.upcoming)[0];
  return (
    <li className="py-3">
      <Title c={c} />
      <div className="mt-1.5 grid grid-cols-2 gap-3">
        {SIDES.map((k) => (
          <DirectionDetail key={k} dir={k} d={c.directions[k]} showCounters={showCounters} />
        ))}
      </div>
      {c.pass?.closed && (
        <div className="mt-1.5">
          <PassStatus pass={c.pass} />
        </div>
      )}
      {next && <p className="mt-1.5 text-xs text-stone-700">Prochaine fermeture : {closureText(next)}</p>}
    </li>
  );
}

function LargeCard({ c, showCounters }) {
  return (
    <section className="rounded-lg border border-stone-200 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <Title c={c} />
      </div>
      <div className="mt-2 space-y-2.5">
        {SIDES.map((k) => (
          <DirectionDetail key={k} dir={k} d={c.directions[k]} showCounters={showCounters} allCounters />
        ))}
      </div>
      {c.pass && (
        <div className="mt-2.5 border-t border-stone-100 pt-2">
          <PassStatus pass={c.pass} showCounters={showCounters} />
        </div>
      )}
      {c.upcoming?.length > 0 && (
        <div className="mt-2.5 border-t border-stone-100 pt-2">
          <Closures list={dedupeUpcoming(c.upcoming).slice(0, 2)} />
        </div>
      )}
    </section>
  );
}
