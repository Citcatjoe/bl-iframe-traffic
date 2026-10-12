import { useLayoutEffect, useRef, useState } from "react";
import { DIRS, LEVELS, hhmm } from "../format.js";

const COLORS = { S: "#b91c1c", N: "#1d4ed8" };
const STROKE = { S: 3.5, N: 2 }; // S dessiné en premier et plus épais : reste visible si les deux sens se superposent
const PAD = { l: 30, r: 34, t: 8, b: 20 };
const BAND = 7; // hauteur d'une bande de niveau
const GAP_MS = 10 * 60_000; // au-delà : relevés manquants, on coupe la ligne
const V_MAX = 120;

/** Longueur de bouchon (km) en escalier + bandes de niveau par sens, + vitesse mesurée (compteur principal). */
export default function HistoryChart({ data, small, directions }) {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const { situations, counters, hours } = data;
  const polls = new Set(situations.map((p) => p.t)).size;
  const hasSpeed = counters.length > 0;
  const H = small ? 120 : 170;
  const bandsH = 2 * BAND + 6;
  const now = Date.now();
  const x0 = now - hours * 3600_000;
  const yMax = Math.max(5, Math.ceil(Math.max(0, ...situations.map((p) => p.queue_km ?? 0))));
  const iw = Math.max(0, w - PAD.l - PAD.r);
  const ih = H - PAD.t - PAD.b - bandsH;
  const x = (t) => PAD.l + ((t - x0) / (now - x0)) * iw;
  const y = (v) => PAD.t + ih - (v / yMax) * ih;
  const yv = (v) => PAD.t + ih - (Math.min(v, V_MAX) / V_MAX) * ih;

  const series = (list, dir, key) =>
    list.filter((p) => p.dir === dir && Date.parse(p.t) >= x0).map((p) => [Date.parse(p.t), p[key]]);

  const stepPath = (pts, fy) => {
    let d = "";
    pts.forEach(([t, v], i) => {
      const prev = pts[i - 1];
      if (!prev || t - prev[0] > GAP_MS) d += `M${x(t)},${fy(v)}`;
      else d += `H${x(t)}V${fy(v)}`;
    });
    return d;
  };
  const linePath = (pts) =>
    pts
      .filter(([, v]) => v != null)
      .map(([t, v], i, a) => `${!i || t - a[i - 1][0] > GAP_MS ? "M" : "L"}${x(t)},${yv(v)}`)
      .join("");
  const bands = (dir, top) => {
    const pts = series(situations, dir, "level");
    const runs = [];
    pts.forEach(([t, l], i) => {
      const t1 = pts[i + 1] && pts[i + 1][0] - t <= GAP_MS ? pts[i + 1][0] : Math.min(now, t + 3 * 60_000);
      const last = runs.at(-1);
      if (last && last.l === l && last.t1 === t) last.t1 = t1;
      else runs.push({ t, t1, l });
    });
    return runs.map(({ t, t1, l }) => (
      <rect key={t} x={x(t)} y={top} width={Math.max(1, x(t1) - x(t))} height={BAND} fill={LEVELS[l]?.color ?? "#ddd"} />
    ));
  };

  const stepH = hours <= 6 ? 1 : hours <= 12 ? (small ? 4 : 2) : small ? 6 : 4;
  const ticks = [];
  for (let t = Math.ceil(x0 / 3600_000) * 3600_000; t <= now; t += 3600_000) {
    if (new Date(t).getUTCHours() % stepH === 0) ticks.push(t);
  }
  const levelsSeen = [...new Set(situations.map((p) => p.level))];
  const bandTop = PAD.t + ih + 6;

  return (
    <div ref={ref}>
      {polls < 2 ? (
        <p className="py-6 text-center text-sm text-stone-500">
          L'historique se construit : un relevé toutes les 3 minutes ({polls} pour l'instant).
        </p>
      ) : (
        w > 0 && (
          <svg width={w} height={H} role="img" aria-label={`Longueur des bouchons, ${hours} dernières heures`}>
            {[0, yMax / 2, yMax].map((v) => (
              <g key={v}>
                <line x1={PAD.l} x2={w - PAD.r} y1={y(v)} y2={y(v)} stroke="#e7e5e4" />
                <text x={PAD.l - 4} y={y(v) + 4} textAnchor="end" className="fill-stone-500 text-[10px]">
                  {v}
                </text>
              </g>
            ))}
            {hasSpeed &&
              [0, 60, 120].map((v) => (
                <text key={v} x={w - PAD.r + 4} y={yv(v) + 4} className="fill-stone-400 text-[10px]">
                  {v}
                </text>
              ))}
            {ticks.map((t) => (
              <text key={t} x={x(t)} y={H - 5} textAnchor="middle" className="fill-stone-500 text-[10px]">
                {hhmm(new Date(t).toISOString())}
              </text>
            ))}
            {["S", "N"].map((dir) => (
              <path key={dir} d={stepPath(series(situations, dir, "queue_km").map(([t, v]) => [t, v ?? 0]), y)} fill="none" stroke={COLORS[dir]} strokeWidth={STROKE[dir]} strokeLinejoin="round" />
            ))}
            {hasSpeed &&
              ["S", "N"].map((dir) => (
                <path key={dir} d={linePath(series(counters, dir, "speed_light"))} fill="none" stroke={COLORS[dir]} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.8} />
              ))}
            {["S", "N"].map((dir, i) => (
              <g key={dir}>
                <text x={PAD.l - 4} y={bandTop + i * (BAND + 1) + BAND - 0.5} textAnchor="end" className="fill-stone-500 text-[9px]">
                  {DIRS[dir].arrow}
                </text>
                {bands(dir, bandTop + i * (BAND + 1))}
              </g>
            ))}
          </svg>
        )
      )}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-stone-600">
        {["S", "N"].map((dir) => (
          <span key={dir} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: COLORS[dir] }} />
            {DIRS[dir].arrow} {directions?.[dir]?.label ?? DIRS[dir].short}
          </span>
        ))}
        <span>Trait plein : km de bouchon{hasSpeed ? " · pointillé : vitesse mesurée (km/h, axe droit)" : ""}</span>
      </div>
      {polls >= 2 && (
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-stone-600">
          <span>Bandes ↓↑ : niveau signalé</span>
          {levelsSeen.map((l) => (
            <span key={l} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2" style={{ background: LEVELS[l]?.color }} />
              {LEVELS[l]?.label ?? l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
