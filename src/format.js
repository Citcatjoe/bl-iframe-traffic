const TZ = "Europe/Zurich";
const timeFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: TZ, day: "2-digit", month: "2-digit" });

/** "15:16", ou "07.10 15:16" si ce n'est pas aujourd'hui (heure suisse). */
export function when(iso) {
  if (!iso) return "–";
  const d = new Date(iso);
  const sameDay = dayFmt.format(d) === dayFmt.format(new Date());
  return sameDay ? timeFmt.format(d) : `${dayFmt.format(d)} ${timeFmt.format(d)}`;
}

export const hhmm = (iso) => timeFmt.format(new Date(iso));

/** Texte FR affichable : sans le statut éditorial en tête, apostrophes doublées corrigées (telles quelles dans le flux). */
export function cleanText(t) {
  return (t ?? "")
    .replace(/^(Libéré|Révoqué)\s*:\s*/, "")
    .replace(/''/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export const km = (x) => x.toLocaleString("fr-CH", { maximumFractionDigits: 1 });

export function duration(min) {
  if (min < 60) return `${min} min`;
  const m = min % 60;
  return m ? `${Math.floor(min / 60)} h ${String(m).padStart(2, "0")}` : `${min / 60} h`;
}

export const DIRECTIONS = {
  "N-S": { label: "Nord → Sud", sub: "Uri → Tessin" },
  "S-N": { label: "Sud → Nord", sub: "Tessin → Uri" },
};
