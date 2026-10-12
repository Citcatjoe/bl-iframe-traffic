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

export const LEVELS = {
  closed: { label: "Fermé", short: "Fermé", chip: "bg-red-700 text-white", color: "#b91c1c" },
  jam: { label: "Bouchon", short: "Bouchon", chip: "bg-red-100 text-red-900 ring-1 ring-red-300", color: "#ef4444" },
  slow: { label: "Ralenti", short: "Ralenti", chip: "bg-orange-100 text-orange-900 ring-1 ring-orange-300", color: "#f97316" },
  detour: { label: "Fermé · déviation locale", short: "Fermé · déviation locale", chip: "bg-amber-100 text-amber-900 ring-1 ring-amber-300", color: "#d97706" },
  expected: { label: "Risque de bouchon", short: "Risque de bouchon", chip: "bg-yellow-50 text-yellow-900 ring-1 ring-yellow-300", color: "#ca8a04" },
  access: { label: "Jonction fermée", short: "Jonction fermée", chip: "bg-sky-50 text-sky-900 ring-1 ring-sky-200", color: "#0284c7" },
  clear: { label: "Aucune perturbation signalée", short: "Aucune perturbation signalée", chip: "bg-stone-100 text-stone-600", color: "#a8a29e" },
};
const ORDER = ["closed", "jam", "slow", "detour", "expected", "access", "clear"];
export const levelRank = (l) => {
  const i = ORDER.indexOf(l);
  return i < 0 ? ORDER.length : i;
};

export const DIRS = {
  S: { arrow: "↓", short: "Sud" },
  N: { arrow: "↑", short: "Nord" },
};

/** Retard : annoncé par l'OFROU, sinon estimation (Gothard). */
export function delayText(d) {
  if (d.delay_min != null) return `${d.delay_min} min annoncées`;
  if (d.delay_estimate) return `≈ ${d.delay_estimate.min}–${d.delay_estimate.max} min (estimation)`;
  return null;
}

export const mainCounter = (d) => d.counters?.find((c) => c.main) ?? null;

const LEVEL_SUFFIX = { detour: "déviation locale", closed: "fermeture totale", access: "jonction fermée" };

/** « Nuits du 12.10 au 16.10, 22:00–05:00 · déviation locale » */
export function closureText(m) {
  const s = m.schedule;
  let txt;
  if (s) {
    const first = ddmm(m.next_start ?? m.start);
    const last = m.end ? ddmm(m.end) : null;
    const plural = s.kind === "night" ? "Nuits" : "Journées";
    const single = s.kind === "night" ? "Nuit du" : "Journée du";
    txt = !last || last === first ? `${single} ${first}` : `${plural} du ${first} au ${last}`;
    txt += `, ${s.from}–${s.to}`;
  } else {
    txt = `Dès le ${ddmm(m.next_start)} ${hhmm(m.next_start)}`;
    if (m.end) txt += ` jusqu'au ${ddmm(m.end)} ${hhmm(m.end)}`;
  }
  if (m.segment === "pass") txt = `Col : ${txt}`;
  const sfx = LEVEL_SUFFIX[m.level];
  return sfx ? `${txt} · ${sfx}` : txt;
}

/** Retire les doublons (tronçons adjacents pour la même nuit). */
export function dedupeUpcoming(list) {
  const seen = new Set();
  return (list ?? []).filter((m) => {
    const k = `${m.next_start}|${m.level}|${m.segment}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function within24h(m) {
  const dt = Date.parse(m.next_start) - Date.now();
  return dt >= 0 && dt < 24 * 3600_000;
}
