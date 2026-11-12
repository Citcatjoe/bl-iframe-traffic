// Journal des événements d'un point : changements d'état par sens, d'après /api/history (un état par relevé et par
// sens). Pur, sans dépendance au navigateur.

const key = (e) => `${e.level}|${e.queue_km ?? ""}|${e.section_fr ?? ""}|${e.prev ?? ""}`;

/**
 * @param {{ t: string, dir: string, level: string, queue_km: number|null, delay_min: number|null,
 *   section_fr: string|null, reason_fr: string|null, roadworks: boolean }[]} situations
 * @returns {{ t: string, dirs: string[], level: string, queue_km: number|null, delay_min: number|null,
 *   section_fr: string|null, reason_fr: string|null, roadworks: boolean, initial: boolean,
 *   prev: string|null, lasted_ms: number|null }[]}
 *   du plus récent au plus ancien ; `initial` : état déjà en cours au premier relevé de la période ; `prev` : niveau
 *   quitté et `lasted_ms` sa durée (null si cet état était déjà en cours au premier relevé) ; un changement identique
 *   et simultané dans les deux sens est regroupé.
 */
export function journalEvents(situations) {
  const byDir = new Map();
  for (const p of situations) {
    if (!byDir.has(p.dir)) byDir.set(p.dir, []);
    byDir.get(p.dir).push(p);
  }
  const changes = [];
  for (const [dir, list] of byDir) {
    list.sort((a, b) => a.t.localeCompare(b.t));
    let prev = null;
    let since = null; // début de l'état en cours, inconnu s'il l'était déjà au premier relevé
    for (const p of list) {
      if (prev == null) {
        if (p.level !== "clear") changes.push({ ...p, dir, initial: true, prev: null, lasted_ms: null });
      } else if (p.level !== prev.level) {
        const lasted_ms = since == null ? null : Date.parse(p.t) - Date.parse(since);
        changes.push({ ...p, dir, initial: false, prev: prev.level, lasted_ms });
        since = p.t;
      }
      prev = p;
    }
  }
  const merged = new Map();
  for (const c of changes) {
    const k = `${c.t}|${c.initial}|${key(c)}`;
    if (merged.has(k)) merged.get(k).dirs.push(c.dir);
    else {
      const { dir, ...e } = c;
      merged.set(k, { ...e, dirs: [dir] });
    }
  }
  return [...merged.values()].sort((a, b) => b.t.localeCompare(a.t));
}

/** « 27 min », « 2 h 05 », « 3 jours ». */
export function durationText(ms) {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  if (min < 48 * 60) return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
  return `${Math.round(min / 1440)} jours`;
}
