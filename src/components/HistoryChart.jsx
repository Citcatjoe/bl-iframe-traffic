import { useLayoutEffect, useRef, useState } from "react";
import { DIRECTIONS, hhmm } from "../format.js";

const COLORS = { "N-S": "#b91c1c", "S-N": "#1d4ed8" };
const H = 170;
const PAD = { l: 30, r: 8, t: 10, b: 22 };
const GAP_MS = 10 * 60_000; // au-delà : relevés manquants (serveur arrêté), on coupe la ligne

/** Longueur de bouchon (km) par sens, en escalier : un état constant entre deux relevés. */
export default function HistoryChart({ series, hours }) {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const polls = new Set(series.map((p) => p.t)).size;
  const now = Date.now();
  const x0 = now - hours * 3600_000;
  const yMax = Math.max(5, Math.ceil(Math.max(0, ...series.map((p) => p.queue_km))));
  const iw = Math.max(0, w - PAD.l - PAD.r);
  const ih = H - PAD.t - PAD.b;
  const x = (t) => PAD.l + ((t - x0) / (now - x0)) * iw;
  const y = (v) => PAD.t + ih - (v / yMax) * ih;

  const path = (dir) => {
    const pts = series.filter((p) => p.direction === dir).map((p) => [Date.parse(p.t), p.queue_km]);
    let d = "";
    pts.forEach(([t, v], i) => {
      const prev = pts[i - 1];
      if (!prev || t - prev[0] > GAP_MS) d += `M${x(t)},${y(v)}`;
      else d += `H${x(t)}V${y(v)}`;
    });
    return d;
  };

  const stepH = hours <= 6 ? 1 : hours <= 12 ? 2 : 4;
  const ticks = [];
  for (let t = Math.ceil(x0 / 3600_000) * 3600_000; t <= now; t += 3600_000) {
    if (new Date(t).getUTCHours() % stepH === 0) ticks.push(t);
  }

  return (
    <div ref={ref}>
      {polls < 2 ? (
        <p className="py-6 text-center text-sm text-stone-500">
          L'historique se construit : un relevé toutes les 3 minutes ({polls} pour l'instant).
        </p>
      ) : (
        w > 0 && (
          <svg width={w} height={H} role="img" aria-label={`Longueur des bouchons au Gothard, ${hours} dernières heures`}>
            {[0, yMax / 2, yMax].map((v) => (
              <g key={v}>
                <line x1={PAD.l} x2={w - PAD.r} y1={y(v)} y2={y(v)} stroke="#e7e5e4" />
                <text x={PAD.l - 4} y={y(v) + 4} textAnchor="end" className="fill-stone-500 text-[11px]">
                  {v}
                </text>
              </g>
            ))}
            {ticks.map((t) => (
              <text key={t} x={x(t)} y={H - 6} textAnchor="middle" className="fill-stone-500 text-[11px]">
                {hhmm(new Date(t).toISOString())}
              </text>
            ))}
            {Object.keys(COLORS).map((dir) => (
              <path key={dir} d={path(dir)} fill="none" stroke={COLORS[dir]} strokeWidth="2" strokeLinejoin="round" />
            ))}
          </svg>
        )
      )}
      <div className="mt-1 flex gap-4 text-xs text-stone-600">
        {Object.entries(COLORS).map(([dir, c]) => (
          <span key={dir} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: c }} />
            {DIRECTIONS[dir].label}
          </span>
        ))}
        <span className="ml-auto">km de bouchon</span>
      </div>
    </div>
  );
}
