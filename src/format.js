const TZ = "Europe/Zurich";
const timeFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dayFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: TZ, day: "2-digit", month: "2-digit" });

export const hhmm = (iso) => timeFmt.format(new Date(iso));
export const ddmm = (iso) => dayFmt.format(new Date(iso));

/** "15:16", ou "07.10 15:16" si ce n'est pas aujourd'hui (heure suisse). */
export function when(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  return ddmm(d) === ddmm(new Date()) ? hhmm(d) : `${ddmm(d)} ${hhmm(d)}`;
}

/** Texte FR affichable : sans le statut éditorial en tête. */
export function cleanText(t) {
  return (t ?? "")
    .replace(/^(Libéré|Révoqué|Freigegeben|Liberato)\s*:\s*/, "")
    .replace(/''/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export const km = (x) => x.toLocaleString("fr-CH", { maximumFractionDigits: 1 });

/** Les deux sens d'un point (libellé et flèche fournis par l'API pour chaque point). */
export const DIR_KEYS = ["a", "b"];

/** Retire les doublons (tronçons adjacents pour la même nuit). */
export function dedupeUpcoming(list) {
  const seen = new Set();
  return (list ?? []).filter((m) => {
    const k = `${m.next_start}|${m.level}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function within24h(m) {
  const dt = Date.parse(m.next_start) - Date.now();
  return dt >= 0 && dt < 24 * 3600_000;
}
