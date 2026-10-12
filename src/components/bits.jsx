import { DIRS, LEVELS, cleanText, delayText, km } from "../format.js";
import { speedsText, styleOf } from "../lib/levels";

/** Niveau : pictogramme + texte (jamais la couleur seule). Fond plein sauf « clear ». */
export function LevelChip({ level, long = false, className = "" }) {
  const st = styleOf(level);
  const l = LEVELS[level] ?? LEVELS.clear;
  const clear = level === "clear";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2 py-[3px] text-[12px] leading-none font-bold whitespace-nowrap ${clear ? "bg-surface-weak text-ink" : ""} ${className}`}
      style={clear ? undefined : { background: st.color, color: st.ink }}
    >
      <i className={`fa-solid ${st.icon} text-[11px]`} style={clear ? { color: st.color } : undefined} aria-hidden="true" />
      {long ? l.label : l.short}
    </span>
  );
}

/** « ↓ Vers le Tessin · Fermé · 5 km · ≈ 50–60 min (estimation) » */
export function dirSummary(dir, d) {
  const parts = [`${DIRS[dir].arrow} ${d.label}`];
  if (d.level !== "clear" && d.level !== "jam") parts.push(LEVELS[d.level]?.label ?? d.level);
  if (d.queue_km != null) parts.push(`${km(d.queue_km)} km`);
  else if (d.level === "jam") parts.push(LEVELS.jam.label);
  const delay = delayText(d);
  if (delay) parts.push(delay);
  return parts.join(" · ");
}

/** Directions perturbées, ou « Aucune perturbation signalée » + vitesses mesurées. */
export function crossingLines(c) {
  const lines = ["S", "N"].filter((k) => c.directions[k].level !== "clear").map((k) => dirSummary(k, c.directions[k]));
  if (lines.length) return lines;
  const sp = speedsText(c);
  return [`${LEVELS.clear.label}${sp ? ` · ${sp.replace(" km/h", "")} km/h mesurés` : ""}`];
}

/** Mesure d'une minute : sans véhicule, pas de vitesse. */
export function counterSpeed(c) {
  if (!c) return { big: "–", note: "mesure indisponible" };
  const flow = c.flow_light == null && c.flow_heavy == null ? null : (c.flow_light ?? 0) + (c.flow_heavy ?? 0);
  if (c.speed_light != null) {
    const heavy = flow ? Math.round(((c.flow_heavy ?? 0) / flow) * 100) : null;
    const note = flow != null ? `${flow} véh./h${heavy != null ? ` · ${heavy} % poids lourds` : ""}` : null;
    return { big: `${c.speed_light} km/h`, note };
  }
  if (flow === 0) return { big: "–", note: "aucun véhicule à la dernière minute" };
  return { big: "–", note: "mesure indisponible" };
}

/** Messages en vigueur, texte FR nettoyé et dédoublonné. */
export function currentMessages(c) {
  const all = [...c.directions.S.messages, ...c.directions.N.messages, ...c.undirected, ...(c.pass?.messages ?? [])];
  const seen = new Set();
  const out = [];
  for (const m of all) {
    const t = cleanText(m.text_fr ?? m.text_de);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push({ key: m.situation_id + (m.dir ?? ""), text: t, level: m.level });
  }
  return out;
}
