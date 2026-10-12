/**
 * Traversées alpines suivies par le widget, et résumé par traversée et par sens. Module PUR.
 *
 * Une traversée = un ou plusieurs tronçons (route + lieux) testés sur l'en-tête des messages OFROU,
 * jamais sur tout le texte : "Gotthard" est aussi l'extrémité d'itinéraire de toute l'A2.
 * Sens : "S" = vers le sud, "N" = vers le nord. Déduit de la flèche du texte et de l'ordre nord→sud
 * des extrémités d'itinéraire ; à défaut, de alertCDirectionCoded, dont le signe dépend de la route
 * (relevé 10.2026 : A2, A13, H21 negative = sud ; A9 positive = sud ; concordance texte/alertC 171/171).
 *
 * Compteurs : identifiants et sens de chaque détecteur d'après la couche publique ASTRA
 * « SVZ_2022 » (Standort, Fahrtrichtung), vérifiés dans la table des points de mesure OTD V25.
 */
import { isInEffect } from "./datex.mjs";

export const DIRECTIONS = ["S", "N"];

export const CROSSINGS = [
  {
    id: "gothard",
    name: "Gothard",
    kind: "Tunnel routier A2",
    dirs: { S: "Vers le Tessin", N: "Vers Lucerne" },
    // Ordre nord → sud des extrémités d'itinéraire A2/H2 (relevé sur le flux).
    order: {
      Basel: 0, Birsfelden: 0, "Verzweigung Hagnau": 0, Olten: 1, Luzern: 2, Flüelen: 3,
      Göschenen: 4, Gotthard: 5, Airolo: 6, Bellinzona: 7, Chiasso: 8,
    },
    alertc: { negative: "S", positive: "N" },
    // Rampes Erstfeld–Göschenen et Airolo–Faido + tunnel. Le col (H2) est suivi à part.
    segments: [
      { id: "main", roads: ["A2"], location: /Gotthard|Erstfeld|Amsteg|Gurtnellen|Wassen|Göschenen|Airolo|Quinto|Ambrì|Piotta|Faido/ },
      // Route du col : lieu entre Göschenen et Airolo (le H2 de la vallée, Flüelen–Göschenen, est exclu).
      { id: "pass", label: "Col du Gothard (H2)", roads: ["H2"], location: /Andermatt|Hospental|Gotthard|Motto Bartola|Göschenen und .*Airolo|Airolo.* und .*Göschenen/ },
    ],
    // Règle empirique relayée par la presse pour le Gothard (dosage au portail) : 10 à 12 min par km.
    waitPerKm: [10, 12],
    counters: [
      { site: "CH:0150", name: "Tunnel", main: true, S: ["CH:0150.01"], N: ["CH:0150.02"] },
      { site: "CH:0195", name: "Erstfeld", S: ["CH:0195.01", "CH:0195.02"], N: ["CH:0195.03", "CH:0195.04"] },
      { site: "CH:0293", name: "Quinto", S: ["CH:0293.01", "CH:0293.02"], N: ["CH:0293.03", "CH:0293.04"] },
      { site: "CH:0010", name: "Col (Hospental)", segment: "pass", S: ["CH:0010.01"], N: ["CH:0010.02"] },
    ],
  },
  {
    id: "san-bernardino",
    name: "San Bernardino",
    kind: "Tunnel routier A13",
    dirs: { S: "Vers Bellinzone", N: "Vers Coire" },
    order: { "St. Margrethen": 0, Sargans: 1, Chur: 2, "S. Bernardino": 3, Bellinzona: 4 },
    alertc: { negative: "S", positive: "N" },
    // Splügen – Mesocco : rampe nord, tunnel, rampe sud.
    segments: [{ id: "main", roads: ["A13"], location: /San Bernardino|Hinterrhein|Nufenen|Medels|Splügen|Sufers|Passstrasse|Pian San Giacomo|Mesocco/ }],
    counters: [
      { site: "CH:0044", name: "Tunnel", main: true, S: ["CH:0044.01"], N: ["CH:0044.02"] },
      { site: "CH:0539", name: "Hinterrhein", S: ["CH:0539.01"], N: ["CH:0539.02"] },
      { site: "CH:0203", name: "Roveredo", S: ["CH:0203.01"], N: ["CH:0203.02"] },
    ],
  },
  {
    id: "simplon",
    name: "Simplon",
    kind: "Col routier A9",
    dirs: { S: "Vers l'Italie", N: "Vers Brigue" },
    order: { Lausanne: 0, Vevey: 1, Martigny: 2, Sion: 3, Brig: 4, Domodossola: 5 },
    alertc: { positive: "S", negative: "N" },
    // Brigue – Gondo : tout message de l'A9 vers Domodossola, ou nommant un lieu du col.
    segments: [
      { id: "main", roads: ["A9"], endpoints: /^Domodossola$/ },
      { id: "main", roads: ["A9"], location: /Simplon|Berisal|Rothwald|Gabi|Gondo/ },
    ],
    counters: [
      { site: "CH:0110", name: "Col (Josefgalerie)", main: true, S: ["CH:0110.01"], N: ["CH:0110.02"] },
      { site: "CH:0527", name: "Gondo", S: ["CH:0527.01"], N: ["CH:0527.02"] },
    ],
  },
  {
    id: "grand-st-bernard",
    name: "Grand-Saint-Bernard",
    kind: "Tunnel routier H21",
    dirs: { S: "Vers l'Italie", N: "Vers Martigny" },
    order: { Martigny: 0, "Verzweigung Gd-St-Bernard": 0, "Martigny-Croix": 1, "Grosser St. Bernhard": 2 },
    alertc: { negative: "S", positive: "N" },
    // Martigny – tunnel : H21 et son contournement autoroutier A21.
    segments: [{ id: "main", roads: ["H21", "A21"] }],
    counters: [
      { site: "CH:0041", name: "Tunnel", main: true, S: ["CH:0041.01"], N: ["CH:0041.02"] },
      { site: "CH:0209", name: "Martigny", S: ["CH:0209.01", "CH:0209.02"], N: ["CH:0209.03"] },
    ],
  },
];

export const CROSSING_BY_ID = Object.fromEntries(CROSSINGS.map((c) => [c.id, c]));

/** Tous les détecteurs à demander à l'API compteurs. */
export const COUNTER_DETECTORS = CROSSINGS.flatMap((c) => c.counters.flatMap((k) => [...k.S, ...k.N]));

function segmentMatches(seg, s) {
  if (!seg.roads.includes(s.road)) return false;
  if (seg.location && !seg.location.test(s.location_de ?? "")) return false;
  if (seg.endpoints && !(seg.endpoints.test(s.route_from ?? "") || seg.endpoints.test(s.route_to ?? ""))) return false;
  return true;
}

function direction(c, s) {
  if (s.route_arrow === "<->") return "both";
  if (s.route_arrow === "->") {
    const a = c.order[s.route_from];
    const b = c.order[s.route_to];
    if (a != null && b != null && a !== b) return b > a ? "S" : "N";
  }
  if (s.alertc_direction === "both") return "both";
  return c.alertc[s.alertc_direction] ?? null;
}

/**
 * Traversées concernées par un message.
 * @returns {{ id: string, segment: string, dir: "S"|"N"|"both"|null }[]}
 */
export function crossingRefs(s) {
  const out = [];
  for (const c of CROSSINGS) {
    const seg = c.segments.find((g) => segmentMatches(g, s));
    if (seg) out.push({ id: c.id, segment: seg.id, dir: direction(c, s) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Niveau d'un sens : pire message en vigueur sur le tronçon principal.
// "detour" = fermeture avec déviation annoncée (franchissable) ; "expected" = "Stau zu erwarten".
const LEVEL_OF_CONDITION = {
  closed: "closed",
  jam: "jam",
  slow: "slow",
  closed_detour: "detour",
  jam_expected: "expected",
  access_closed: "access",
};
export const LEVELS = ["clear", "access", "expected", "detour", "slow", "jam", "closed"];
const rank = (level) => LEVELS.indexOf(level);

const CLOSURE_CONDITIONS = new Set(["closed", "closed_detour", "access_closed"]);

function levelOf(s) {
  // Bouchon déclaré par le record AbnormalTraffic même si la phrase "Sachlage" diffère.
  if ((s.jam === "stationary" || s.jam === "queuing") && s.jam_probability === "certain" && s.condition !== "closed") return "jam";
  return LEVEL_OF_CONDITION[s.condition] ?? "clear";
}

/** Compact pour le front : pas de champs de debug. */
function brief(s, ref) {
  return {
    situation_id: s.situation_id,
    dir: ref.dir,
    segment: ref.segment,
    level: levelOf(s),
    condition: s.condition,
    roadworks: s.roadworks,
    queue_km: s.queue_km,
    delay_min: s.delay_min,
    created_time: s.created_time,
    start: s.start,
    end: s.end,
    schedule: s.schedule,
    text_fr: s.text_fr,
    text_de: s.text_de,
    text_it: s.text_it,
  };
}

/**
 * Prochaine occurrence d'une fermeture pas encore en vigueur, ISO ou null.
 * Plage récurrente : prochain début de plage (heure suisse) à partir de max(now, start).
 */
function nextStart(s, nowIso) {
  if (s.end && s.end < nowIso) return null;
  if (!s.schedule) return s.start && s.start > nowIso ? s.start : null;
  const from = Date.parse(s.start && s.start > nowIso ? s.start : nowIso);
  const QUARTER = 15 * 60_000;
  // Pas de 15 min alignés sur le quart d'heure sur 8 jours, puis recul à la minute près.
  for (let t = Math.ceil(from / QUARTER) * QUARTER, stop = from + 8 * 86_400_000; t < stop; t += QUARTER) {
    const iso = new Date(t).toISOString();
    if (s.end && iso > s.end) return null;
    if (!isInEffect(s, iso)) continue;
    let start = t;
    while (start - 60_000 >= from && isInEffect(s, new Date(start - 60_000).toISOString())) start -= 60_000;
    return new Date(start).toISOString();
  }
  return null;
}

/**
 * Agrégat de mesures d'un compteur dans un sens : débits additionnés (véh./h), vitesse « véhicules
 * légers » moyenne pondérée par le débit des voies.
 * @param {Record<string, object>} detectors  sortie de parseMeasuredDataXml().detectors
 */
export function counterReading(ids, detectors) {
  const rows = ids.map((id) => detectors?.[id]).filter(Boolean);
  if (!rows.length) return null;
  const sum = (k) => (rows.some((r) => r[k] != null) ? rows.reduce((a, r) => a + (r[k] ?? 0), 0) : null);
  const weighted = rows.filter((r) => r.speed_light != null && r.flow_light > 0);
  const wFlow = weighted.reduce((a, r) => a + r.flow_light, 0);
  return {
    measured_at: rows.map((r) => r.measured_at).filter(Boolean).sort().at(-1) ?? null,
    flow_light: sum("flow_light"),
    flow_heavy: sum("flow_heavy"),
    speed_light: wFlow ? Math.round(weighted.reduce((a, r) => a + r.speed_light * r.flow_light, 0) / wFlow) : null,
  };
}

/**
 * Résumé d'une traversée pour le widget.
 * @param {object} c              entrée de CROSSINGS
 * @param {object[]} situations   sortie de parseTrafficXml().situations
 * @param {string} nowIso
 * @param {Record<string, object>|null} detectors  dernières mesures compteurs (null si indisponibles)
 */
export function summarizeCrossing(c, situations, nowIso, detectors = null) {
  const mine = [];
  for (const s of situations) {
    const ref = crossingRefs(s).find((r) => r.id === c.id);
    if (ref) mine.push({ s, ref });
  }
  const inEffect = mine.filter(({ s }) => isInEffect(s, nowIso));
  const main = inEffect.filter(({ ref }) => ref.segment === "main");

  const directions = {};
  for (const d of DIRECTIONS) {
    const here = main.filter(({ ref }) => ref.dir === d || ref.dir === "both");
    const ranked = here
      .map(({ s, ref }) => ({ s, ref, level: levelOf(s) }))
      .filter(({ level }) => level !== "clear")
      .sort((a, b) => rank(b.level) - rank(a.level) || (b.s.queue_km ?? -1) - (a.s.queue_km ?? -1));
    const level = ranked[0]?.level ?? "clear";
    const jams = ranked.filter((x) => x.level === "jam" || x.level === "slow");
    const queue = jams.map((x) => x.s.queue_km).filter((x) => x != null);
    const delays = jams.map((x) => x.s.delay_min).filter((x) => x != null);
    const queue_km = queue.length ? Math.max(...queue) : null;
    const delay_min = delays.length ? Math.max(...delays) : null;
    const estimate = delay_min == null && queue_km != null && c.waitPerKm
      ? { min: Math.round(queue_km * c.waitPerKm[0]), max: Math.round(queue_km * c.waitPerKm[1]) }
      : null;
    const counters = c.counters
      .filter((k) => (k.segment ?? "main") === "main")
      .map((k) => ({ site: k.site, name: k.name, main: Boolean(k.main), ...(counterReading(k[d], detectors) ?? { measured_at: null, flow_light: null, flow_heavy: null, speed_light: null }) }));
    directions[d] = {
      label: c.dirs[d],
      level,
      queue_km,
      delay_min, // annoncé par l'OFROU
      delay_estimate: estimate, // { min, max } : règle empirique, à afficher comme estimation
      since: jams.map((x) => x.s.created_time).filter(Boolean).sort()[0] ?? null,
      messages: ranked.map(({ s, ref }) => brief(s, ref)),
      counters: detectors ? counters : null,
    };
  }

  // Messages en vigueur sans sens identifiable : affichés au niveau de la traversée.
  const undirected = main.filter(({ ref, s }) => ref.dir == null && levelOf(s) !== "clear").map(({ s, ref }) => brief(s, ref));

  const passSeg = c.segments.find((g) => g.id === "pass");
  let pass = null;
  if (passSeg) {
    const closures = inEffect.filter(({ ref, s }) => ref.segment === "pass" && s.condition === "closed");
    const counter = c.counters.find((k) => k.segment === "pass");
    pass = {
      label: passSeg.label,
      closed: closures.length > 0,
      messages: closures.map(({ s, ref }) => brief(s, ref)),
      counters: detectors && counter
        ? Object.fromEntries(DIRECTIONS.map((d) => [d, counterReading(counter[d], detectors)]))
        : null,
    };
  }

  const upcoming = mine
    .filter(({ s }) => CLOSURE_CONDITIONS.has(s.condition))
    .map(({ s, ref }) => ({ ...brief(s, ref), next_start: isInEffect(s, nowIso) ? null : nextStart(s, nowIso) }))
    .filter((x) => x.next_start)
    .sort((a, b) => a.next_start.localeCompare(b.next_start))
    .slice(0, 5);

  const levels = [...DIRECTIONS.map((d) => directions[d].level), ...undirected.map((m) => m.level)];
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    level: levels.sort((a, b) => rank(b) - rank(a))[0],
    directions,
    undirected,
    pass,
    upcoming,
  };
}

export function summarizeAll(situations, nowIso, detectors = null) {
  return CROSSINGS.map((c) => summarizeCrossing(c, situations, nowIso, detectors));
}
