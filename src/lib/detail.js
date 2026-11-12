// Contenu de la fiche d'un point (mode explore, maquette 5a) : lignes d'état, fermeture annoncée, alternative,
// réouverture. Pur : `now` est passé en paramètre (ms), aucun accès au navigateur.
import { ddmm, dedupeUpcoming, hhmm, km } from "../format.js";
import { ORDER, SECTION_TYPES, STATUS, detourOf, lowerFirst, reasonOf } from "./status.js";

const DAY_MS = 24 * 3600_000;
/** Fiche : fermetures annoncées dans les 7 jours seulement (l'OFROU publie des chantiers jusqu'à un an d'avance). */
const ANNOUNCE_HORIZON_MS = 7 * DAY_MS;
const longDay = new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", day: "numeric", month: "long" });
const yearFmt = new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", year: "numeric" });
const year = (t) => yearFmt.format(new Date(t));

const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Point à prendre quand celui-ci est fermé : le tunnel pour le col, le col pour le tunnel. */
const ALTERNATIVE = {
  "col-du-gothard": "gothard",
  gothard: "col-du-gothard",
  "col-du-grand-st-bernard": "grand-st-bernard",
  "grand-st-bernard": "col-du-grand-st-bernard",
};

/** « depuis 16:30 » le jour même, sinon « depuis le 19 octobre », avec l'année si ce n'est pas l'année en cours (heure suisse). */
export function sinceText(iso, now) {
  if (ddmm(iso) === ddmm(now) && year(iso) === year(now)) return `depuis ${hhmm(iso)}`;
  const day = longDay.format(new Date(iso)).replace(/^1 /, "1er ");
  return `depuis le ${day}${year(iso) === year(now) ? "" : ` ${year(iso)}`}`;
}

/** Début de l'alerte : `since` du sens, sinon le plus ancien début de message déjà passé. */
function startOf(dirs, messages, now) {
  const since = dirs.map((d) => d.since).filter(Boolean).sort()[0];
  if (since) return since;
  return messages.map((m) => m.start).filter((t) => t && Date.parse(t) <= now).sort()[0] ?? null;
}

/**
 * Nature de l'alerte en une phrase : « Fermeture hivernale dans les deux sens, depuis le 20 octobre »,
 * « Surcharge de trafic entre Lausanne-Blécherette et La Croix, depuis 16:30 ». null si rien à dire.
 */
function natureText(c, dirs, messages, both, now) {
  const section = SECTION_TYPES.has(c.type) ? (messages.find((m) => m.section_fr)?.section_fr ?? null) : null;
  const head = [reasonOf(messages), section, both ? "dans les deux sens" : null].filter(Boolean).join(" ");
  const detour = messages.map(detourOf).find(Boolean);
  const start = startOf(dirs, messages, now);
  const parts = [head, detour, start ? sinceText(start, now) : null].filter(Boolean);
  return parts.length ? capFirst(parts.join(", ")) : null;
}

/** Temps perdu et longueur, chacun seulement s'il est connu. */
function metricsOf(dirs) {
  const out = [];
  const announced = dirs.map((d) => d.delay_min).filter((x) => x != null);
  const estimated = dirs.map((d) => d.delay_estimate).filter(Boolean);
  if (announced.length) out.push({ value: `${Math.max(...announced)} min`, label: "de temps perdu" });
  else if (estimated.length) {
    const e = estimated.sort((a, b) => b.max - a.max)[0];
    out.push({ value: `${e.min}–${e.max} min`, label: "de temps perdu (estimation)" });
  }
  const queue = dirs.map((d) => d.queue_km).filter((x) => x != null);
  if (queue.length) out.push({ value: `${km(Math.max(...queue))} km`, label: "de bouchon" });
  return out;
}

/**
 * Lignes d'état : une seule si les deux sens ont le même statut, sinon une par sens, la plus grave d'abord.
 * @returns {{ key: string, level: string, barrier: boolean, title: string, text: string|null, metrics: {value: string, label: string}[] }[]}
 */
export function statusLines(c, now) {
  const [a, b] = [c.directions.a, c.directions.b];
  const line = (key, level, dirs, both) => {
    const messages = [...dirs.flatMap((d) => d.messages), ...c.undirected].filter((m) => m.level === level);
    const clear = level === "clear";
    return {
      key,
      level,
      barrier: level === "closed" && c.type === "col",
      title: both ? STATUS[level].word : `${STATUS[level].word} ${lowerFirst(dirs[0].label)}`,
      // Aucun message n'est pas un trafic mesuré fluide (ni une route vérifiée ouverte) : on dit seulement ce qu'on sait.
      text: clear ? "Aucun message de l'OFROU" : natureText(c, dirs, messages, both, now),
      metrics: clear ? [] : metricsOf(dirs),
    };
  };
  if (a.level === b.level) {
    // Message sans sens identifiable : il vaut pour les deux sens.
    const level = a.level === "clear" && STATUS[c.level] ? c.level : a.level;
    return [line("both", STATUS[level] ? level : "clear", [a, b], true)];
  }
  return [
    ["a", a],
    ["b", b],
  ]
    .sort(([, x], [, y]) => ORDER.indexOf(x.level) - ORDER.indexOf(y.level))
    .map(([k, d]) => line(k, STATUS[d.level] ? d.level : "clear", [d], false));
}

/** « ce soir », « aujourd'hui », « cette nuit » (avant 06:00 le lendemain), sinon « le 30.10 ». */
function dayPhrase(iso, now) {
  const hour = Number(hhmm(iso).slice(0, 2));
  if (ddmm(iso) === ddmm(now)) return hour >= 17 ? "ce soir" : "aujourd'hui";
  if (ddmm(iso) === ddmm(now + DAY_MS) && hour < 6) return "cette nuit";
  return `le ${ddmm(iso)}`;
}

/** « jusqu'à 05:00, chaque nuit jusqu'au 06.11 », « jusqu'au 30.10 à 07:00 », ou null. */
function untilText(m) {
  const start = Date.parse(m.next_start);
  const end = m.end ? Date.parse(m.end) : null;
  if (m.schedule) {
    const each = m.schedule.kind === "night" ? "chaque nuit" : "chaque jour";
    return end != null && end - start > DAY_MS ? `jusqu'à ${m.schedule.to}, ${each} jusqu'au ${ddmm(m.end)}` : `jusqu'à ${m.schedule.to}`;
  }
  if (end == null) return null;
  return end - start <= DAY_MS ? `jusqu'à ${hhmm(m.end)}` : `jusqu'au ${ddmm(m.end)} à ${hhmm(m.end)}`;
}

/**
 * Prochaine fermeture annoncée dans les 7 jours : « Ferme ce soir à 20:00 » / « Jusqu'à 05:00 · travaux · déviation
 * locale ». Une jonction fermée s'annonce comme telle (la route reste ouverte). null s'il n'y en a pas.
 */
export function nextClosure(c, now) {
  const m = dedupeUpcoming(c.upcoming)
    .filter((x) => Date.parse(x.next_start) > now && Date.parse(x.next_start) <= now + ANNOUNCE_HORIZON_MS)
    .sort((x, y) => x.next_start.localeCompare(y.next_start))[0];
  if (!m) return null;
  const verb = m.level === "access" ? "Jonction fermée" : "Ferme";
  const detour = m.level === "detour" ? (detourOf(m) ?? "déviation locale").replace(/ en place$/, "") : null;
  const parts = [
    untilText(m),
    SECTION_TYPES.has(c.type) ? m.section_fr : null,
    reasonOf([m]) ?? (m.level === "closed" ? "fermeture totale" : null),
    detour,
  ].filter(Boolean);
  return {
    title: `${verb} ${dayPhrase(m.next_start, now)} à ${hhmm(m.next_start)}`,
    text: parts.length ? capFirst(parts.join(" · ")) : null,
  };
}

/** Point fermé : l'itinéraire de remplacement suivi, s'il n'est pas fermé lui aussi. */
export function alternativeOf(c, crossings) {
  if (c.level !== "closed") return null;
  const alt = crossings.find((x) => x.id === ALTERNATIVE[c.id]);
  if (!alt || alt.level === "closed") return null;
  return { title: `Passez par le ${lowerFirst(alt.name)}`, text: `${alt.name} · ${(STATUS[alt.level] ?? STATUS.clear).word}` };
}

/** Point fermé dont la fin est annoncée : « Réouverture prévue le 30.10 à 07:00 », sinon null. */
export function reopeningText(c, now) {
  if (c.level !== "closed") return null;
  const ends = [...Object.values(c.directions).flatMap((d) => d.messages), ...c.undirected]
    .filter((m) => m.level === "closed")
    .map((m) => m.end);
  if (!ends.length || ends.some((e) => !e)) return null; // une fermeture sans fin connue l'emporte
  const last = ends.sort().at(-1);
  if (Date.parse(last) <= now) return null;
  return `Réouverture prévue ${dayPhrase(last, now)} à ${hhmm(last)}`;
}
