// Statut d'un point tel qu'affiché dans les listes (mode compact, liste du mode explore) et dans la fiche.
import { DIR_KEYS, ddmm, dedupeUpcoming, hhmm, km, within24h } from "../format.js";

/**
 * Mot (en gras) et couleur de la pastille et du mot, par niveau.
 * Ordre d'affichage : bouchons d'abord, puis fermetures, puis le reste.
 */
export const STATUS = {
  jam: { word: "Bouchon", color: "var(--color-red-500)" },
  slow: { word: "Ralenti", color: "#F07800" },
  closed: { word: "Fermé", color: "var(--status-closed)" },
  detour: { word: "Déviation", color: "#F07800" },
  expected: { word: "Risque de bouchon", color: "#E0A800" },
  access: { word: "Jonction fermée", color: "#E0A800" },
  clear: { word: "Pas d'alerte", color: "var(--color-success)" },
};
export const ORDER = ["jam", "slow", "closed", "detour", "expected", "access", "clear"];

/** Motif court d'une fermeture : « Raison: » du message, sinon « travaux » pour un chantier. */
const SHORT_REASON = [
  [/^travaux/, "travaux"],
  [/poids lourd en panne/, "poids lourd en panne"],
  [/^accident/, "accident"],
];
export function reasonOf(messages) {
  const m = messages.find((x) => x.reason_fr) ?? messages.find((x) => x.roadworks);
  if (!m) return null;
  if (!m.reason_fr) return "travaux";
  return SHORT_REASON.find(([re]) => re.test(m.reason_fr))?.[1] ?? m.reason_fr;
}

/** Déviation annoncée dans le texte FR du message, ou null. */
export function detourOf(m) {
  const t = m.text_fr ?? "";
  if (/déviation locale/i.test(t)) return "déviation locale en place";
  if (/déviation en place|panneaux de déviation/i.test(t)) return "déviation en place";
  return null;
}

/** Temps perdu : annoncé par l'OFROU, sinon estimation (Gothard, « ≈ 10–20 min perdues »). */
export const delayMax = (d) => d.delay_min ?? d.delay_estimate?.max ?? -1;
export function delayText(d) {
  if (d.delay_min != null) return `${d.delay_min} min perdues`;
  if (d.delay_estimate) return `≈ ${d.delay_estimate.min}–${d.delay_estimate.max} min perdues`;
  return null;
}

export const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/** « ce soir », « aujourd'hui », « cette nuit », « demain » (heure suisse) ; `tonight` : avant 06:00 le lendemain. */
function dayWord(iso) {
  const hour = Number(hhmm(iso).slice(0, 2));
  if (ddmm(new Date(iso)) === ddmm(new Date())) return { word: hour >= 17 ? "ce soir" : "aujourd'hui", tonight: true };
  return hour < 6 ? { word: "cette nuit", tonight: true } : { word: "demain", tonight: false };
}

/**
 * Annonce d'une fermeture à venir, selon sa nature : « ferme ce soir à 22:00 », « …, déviation ». Les messages FR ne
 * décrivent qu'une déviation locale (ou « en place ») : « locale » n'apprend rien dans une ligne, la fiche le précise.
 */
const announce = (level, when) =>
  level === "access" ? `jonction fermée ${when}` : level === "detour" ? `ferme ${when}, déviation` : `ferme ${when}`;

/** Le tronçon touché compte sur un axe ou une douane (plusieurs jonctions) ; sur un tunnel ou un col, le nom suffit. */
export const SECTION_TYPES = new Set(["axe", "douane"]);

/**
 * Ligne d'un point : nom, statut, détail (tronçon, longueur, temps perdu, motif ou annonce), sens.
 * Aucune vitesse ni mesure de compteur. `closedPass` : col fermé (fermeture au long cours).
 */
export function rowOf(c) {
  const level = STATUS[c.level] ? c.level : "clear";
  const dirs = DIR_KEYS.map((k) => c.directions[k]).filter((d) => d.level === level);
  const sens = dirs.length === 2 ? "deux sens" : dirs.length === 1 ? lowerFirst(dirs[0].label) : null;
  const messages = [...dirs.flatMap((d) => d.messages), ...c.undirected].filter((m) => m.level === level);
  const section = SECTION_TYPES.has(c.type) ? (messages[0]?.section_fr ?? null) : null;
  const queue = Math.max(-1, ...dirs.map((d) => d.queue_km ?? -1));
  const delay = Math.max(-1, ...dirs.map(delayMax));
  const row = { id: c.id, c, name: c.name, level, closedPass: level === "closed" && c.type === "col", delay, queue, next: null, tonight: false };

  if (level === "jam" || level === "slow" || level === "expected") {
    const worst = dirs.filter((d) => delayMax(d) >= 0).sort((a, b) => delayMax(b) - delayMax(a))[0];
    row.parts = [queue >= 0 ? `${km(queue)} km` : null, worst ? delayText(worst) : null, section, sens];
  } else if (level !== "clear") {
    row.parts = [section, reasonOf(messages), sens];
  } else {
    const next = dedupeUpcoming(c.upcoming).find(within24h);
    if (next) {
      const day = dayWord(next.next_start);
      row.next = next.next_start;
      row.tonight = day.tonight;
      row.parts = [announce(next.level, `${day.word} à ${hhmm(next.next_start)}`)];
    } else {
      // Absence de message, pas trafic mesuré fluide : on n'en dit pas plus.
      row.parts = ["deux sens"];
    }
  }
  row.parts = row.parts.filter(Boolean);
  return row;
}

/**
 * Lignes triées : cols fermés en dernier (fermeture au long cours, pas une info « coup d'œil ») ; sinon statut
 * (ORDER), bouchons par temps perdu puis longueur, « Pas d'alerte » avec fermeture annoncée d'abord.
 */
export function sortedRows(crossings) {
  return crossings
    .map((c, i) => ({ ...rowOf(c), i }))
    .sort(
      (a, b) =>
        a.closedPass - b.closedPass ||
        ORDER.indexOf(a.level) - ORDER.indexOf(b.level) ||
        b.delay - a.delay ||
        b.queue - a.queue ||
        (a.next ? (b.next ? a.next.localeCompare(b.next) : -1) : b.next ? 1 : 0) ||
        a.i - b.i,
    );
}
