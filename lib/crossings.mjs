/**
 * Points du réseau suivis par le widget (tunnels, cols, axes autoroutiers, douanes), et résumé par point et
 * par sens. Module PUR.
 *
 * Un point = un ou plusieurs tronçons (route + lieux) testés sur l'en-tête des messages OFROU,
 * jamais sur tout le texte : "Gotthard" est aussi l'extrémité d'itinéraire de toute l'A2.
 * Sens : deux sens par point, "a" et "b", chacun avec son libellé (« Vers Genève ») et sa flèche.
 * "a" = sens où le rang `order` des extrémités d'itinéraire croît. Déduit de la flèche du texte et de cet
 * ordre ; à défaut, de alertCDirectionCoded, dont le signe dépend de la route (vérifié point par point).
 *
 * Compteurs : identifiants et sens de chaque détecteur d'après la couche publique ASTRA
 * « SVZ_2022 » (Standort, Fahrtrichtung), vérifiés dans la table des points de mesure OTD V25.
 * `at` : position de la pastille sur la carte [lon, lat] (lue par scripts/build-geo.mjs).
 */
import { isInEffect } from "./datex.mjs";

export const DIRECTIONS = ["a", "b"];

// Signes alertC par route (vérifiés sur l'archive du 08 au 26.10.2026, concordance flèche du texte / alertC
// exhaustive sur chaque point) : A2, A13, H2, H21, A1 negative = sens a ; A9 et A21 positive = sens a.
const NEG_A = { negative: "a", positive: "b" };
const POS_A = { positive: "a", negative: "b" };

/**
 * Points suivis, dans l'ordre éditorial (ordre de l'API à gravité égale).
 * segments : { roads, location? (regex sur le lieu de l'en-tête DE), endpoints? (regex sur une extrémité), alertc }.
 * type : tunnel | col | axe | douane. section : tronçon suivi, affiché dans la fiche.
 */
export const CROSSINGS = [
  {
    id: "gothard",
    name: "Tunnel du Gothard",
    kind: "Tunnel routier A2",
    type: "tunnel",
    section: "Erstfeld – Faido, tunnel compris",
    dirs: { a: { label: "Vers le Tessin", arrow: "↓" }, b: { label: "Vers Lucerne", arrow: "↑" } },
    // Ordre nord → sud des extrémités d'itinéraire A2 (relevé sur le flux).
    order: {
      Basel: 0, Birsfelden: 0, "Verzweigung Hagnau": 0, Olten: 1, Luzern: 2, Flüelen: 3,
      Göschenen: 4, Gotthard: 5, Airolo: 6, Bellinzona: 7, Chiasso: 8,
    },
    // Rampes Erstfeld–Göschenen et Airolo–Faido + tunnel. « Gotthard-Tunnel » et non « Gotthard » : la
    // « Raststätte Gotthard » est avant Altdorf.
    segments: [{ roads: ["A2"], location: /Gotthard-Tunnel|Erstfeld|Amsteg|Gurtnellen|Wassen|Göschenen|Airolo|Quinto|Ambrì|Piotta|Faido/, alertc: NEG_A }],
    // Règle empirique relayée par la presse pour le Gothard (dosage au portail) : 10 à 12 min par km.
    waitPerKm: [10, 12],
    counters: [
      { site: "CH:0150", name: "Tunnel", main: true, a: ["CH:0150.01"], b: ["CH:0150.02"] },
      { site: "CH:0195", name: "Erstfeld", a: ["CH:0195.01", "CH:0195.02"], b: ["CH:0195.03", "CH:0195.04"] },
      { site: "CH:0293", name: "Quinto", a: ["CH:0293.01", "CH:0293.02"], b: ["CH:0293.03", "CH:0293.04"] },
    ],
    at: [8.5921, 46.6637], // portail nord (Göschenen)
  },
  {
    id: "col-du-gothard",
    name: "Col du Gothard",
    kind: "Col routier H2",
    type: "col",
    section: "Airolo – Hospental",
    dirs: { a: { label: "Vers le Tessin", arrow: "↓" }, b: { label: "Vers Andermatt", arrow: "↑" } },
    order: { Olten: 0, Luzern: 1, Flüelen: 2, Göschenen: 3, Airolo: 4, Bellinzona: 5, Chiasso: 6 },
    // Route du col : lieu entre Göschenen et Airolo (le H2 de la vallée, Flüelen–Göschenen, est exclu).
    segments: [{ roads: ["H2"], location: /Andermatt|Hospental|Gotthard|Motto Bartola|Göschenen und .*Airolo|Airolo.* und .*Göschenen/, alertc: NEG_A }],
    counters: [{ site: "CH:0010", name: "Hospental", main: true, a: ["CH:0010.01"], b: ["CH:0010.02"] }],
    at: [8.5616, 46.5591], // col (hospice)
  },
  {
    id: "lausanne-geneve",
    name: "Lausanne – Genève",
    kind: "Axe autoroutier A1",
    type: "axe",
    section: "Lausanne-Crissier – Le Vengeron",
    dirs: { a: { label: "Vers Genève", arrow: "↙" }, b: { label: "Vers Lausanne", arrow: "↗" } },
    order: { Lausanne: 0, Genf: 1 },
    // Crissier / Ecublens → Le Vengeron. Le contournement de Genève est exclu ; Perly–Bardonnex est la douane.
    segments: [{
      roads: ["A1"],
      endpoints: /^Genf$/,
      location: /Vengeron|Versoix|Coppet|Pierre Féline|Nyon|Gland|La Côte|Rolle|Aubonne|St-Prex|Morges|Ecublens|Crissier/,
      alertc: NEG_A,
    }],
    counters: [
      { site: "CH:0511", name: "Morges", main: true, a: ["CH:0511.03", "CH:0511.04"], b: ["CH:0511.01", "CH:0511.02"] },
      { site: "CH:0509", name: "Rolle", a: ["CH:0509.03", "CH:0509.04"], b: ["CH:0509.01", "CH:0509.02"] },
      { site: "CH:0249", name: "Coppet", a: ["CH:0249.03", "CH:0249.04"], b: ["CH:0249.01", "CH:0249.02"] },
    ],
    at: [6.2833, 46.4396], // milieu du tracé (entre Gland et Rolle)
  },
  {
    id: "lausanne-valais",
    name: "Lausanne – Valais",
    kind: "Axe autoroutier A9",
    type: "axe",
    section: "Lausanne-Vennes – Martigny",
    dirs: { a: { label: "Vers le Valais", arrow: "↘" }, b: { label: "Vers Lausanne", arrow: "↖" } },
    order: { Lausanne: 0, Vevey: 1, Martigny: 2, Sion: 3, Brig: 4, Domodossola: 5 },
    // Vennes / Belmont → Martigny (le flux coupe l'itinéraire A9 à Martigny ; bouchons observés jusqu'à Aigle).
    segments: [{
      roads: ["A9"],
      location: /Vennes|Belmont|La Croix|Corsy|Criblette|Flonzaley|Chexbres|La Veyre|Vevey|Pertit|Montreux|Glion|Villeneuve|Yvorne|Aigle|St-Triphon|Bex|St-Maurice|Cime de l'Est|Evionnaz/,
      alertc: POS_A,
    }],
    counters: [
      { site: "CH:0370", name: "Chexbres", main: true, a: ["CH:0370.01", "CH:0370.02"], b: ["CH:0370.03", "CH:0370.04"] },
      { site: "CH:0536", name: "La Croix", a: ["CH:0536.01", "CH:0536.02"], b: ["CH:0536.03", "CH:0536.04"] },
      { site: "CH:0250", name: "Aigle", a: ["CH:0250.01", "CH:0250.02"], b: ["CH:0250.03", "CH:0250.04"] },
      { site: "CH:0268", name: "St-Maurice", a: ["CH:0268.01", "CH:0268.02"], b: ["CH:0268.03", "CH:0268.04"] },
    ],
    at: [6.9224, 46.3756], // milieu du tracé (Villeneuve / Rennaz)
  },
  {
    id: "grand-st-bernard",
    name: "Tunnel du Grand-Saint-Bernard",
    kind: "Tunnel routier H21",
    type: "tunnel",
    section: "Martigny – tunnel, route couverte comprise",
    dirs: { a: { label: "Vers l'Italie", arrow: "↓" }, b: { label: "Vers Martigny", arrow: "↑" } },
    order: { Martigny: 0, "Verzweigung Gd-St-Bernard": 0, "Martigny-Croix": 1, "Grosser St. Bernhard": 2 },
    // Martigny – tunnel : A21 et H21 de la vallée. Sans « Bourg-St-Bernard » seul ni « Pass » : le col est à part.
    segments: [
      { roads: ["A21"], alertc: POS_A },
      { roads: ["H21"], location: /Martigny|Bovernier|Valettes|Sembrancher|Orsières|Liddes|Rive Haute|Bourg-St-Pierre|Tunnel/, alertc: NEG_A },
    ],
    counters: [
      { site: "CH:0041", name: "Tunnel", main: true, a: ["CH:0041.01"], b: ["CH:0041.02"] },
      { site: "CH:0209", name: "Martigny", a: ["CH:0209.01", "CH:0209.02"], b: ["CH:0209.03"] },
    ],
    at: [7.1932, 45.8985], // portail suisse
  },
  {
    id: "col-du-grand-st-bernard",
    name: "Col du Grand-Saint-Bernard",
    kind: "Col routier H21",
    type: "col",
    section: "Bourg-Saint-Bernard – col",
    dirs: { a: { label: "Vers l'Italie", arrow: "↓" }, b: { label: "Vers Martigny", arrow: "↑" } },
    order: { Martigny: 0, "Bourg-St-Bernard": 1, "Grosser St. Bernhard": 2, "St-Oyen": 3 },
    // La fermeture hivernale arrive parfois sans numéro de route (« Bourg-St-Bernard -> St-Oyen zwischen Pass … »).
    segments: [{ roads: [null, "H21"], location: /Grosser St\. Bernhard Pass/, alertc: NEG_A }],
    counters: [],
    at: [7.1708, 45.8689], // col (hospice)
  },
  {
    id: "san-bernardino",
    name: "Tunnel du San Bernardino",
    kind: "Tunnel routier A13",
    type: "tunnel",
    section: "Splügen – Mesocco, tunnel compris",
    dirs: { a: { label: "Vers Bellinzone", arrow: "↓" }, b: { label: "Vers Coire", arrow: "↑" } },
    order: { "St. Margrethen": 0, Sargans: 1, Chur: 2, "S. Bernardino": 3, Bellinzona: 4 },
    // Splügen – Mesocco : rampe nord, tunnel, rampe sud. « Passstrasse » et « San Bernardino-Pass » sont des
    // jonctions de l'A13. Le col (route cantonale H13) n'est pas suivi : aucun col grison n'apparaît dans le flux.
    segments: [{ roads: ["A13"], location: /San Bernardino|Hinterrhein|Nufenen|Medels|Splügen|Sufers|Passstrasse|Pian San Giacomo|Mesocco/, alertc: NEG_A }],
    counters: [
      { site: "CH:0044", name: "Tunnel", main: true, a: ["CH:0044.01"], b: ["CH:0044.02"] },
      { site: "CH:0539", name: "Hinterrhein", a: ["CH:0539.01"], b: ["CH:0539.02"] },
      { site: "CH:0203", name: "Roveredo", a: ["CH:0203.01"], b: ["CH:0203.02"] },
    ],
    at: [9.1832, 46.5116], // portail nord
  },
  {
    id: "simplon",
    name: "Col du Simplon",
    // Pas de tunnel routier au Simplon (le tunnel est ferroviaire) : la route nationale franchit le col.
    kind: "Col routier A9",
    type: "col",
    section: "Brigue – Gondo",
    dirs: { a: { label: "Vers l'Italie", arrow: "↓" }, b: { label: "Vers Brigue", arrow: "↑" } },
    order: { Lausanne: 0, Vevey: 1, Martigny: 2, Sion: 3, Brig: 4, Domodossola: 5 },
    // Brigue – Gondo : tout message de l'A9 vers Domodossola, ou nommant un lieu du col.
    segments: [
      { roads: ["A9"], endpoints: /^Domodossola$/, alertc: POS_A },
      { roads: ["A9"], location: /Simplon|Berisal|Rothwald|Gabi|Gondo/, alertc: POS_A },
    ],
    counters: [
      { site: "CH:0110", name: "Col (Josefgalerie)", main: true, a: ["CH:0110.01"], b: ["CH:0110.02"] },
      { site: "CH:0527", name: "Gondo", a: ["CH:0527.01"], b: ["CH:0527.02"] },
    ],
    at: [8.0319, 46.2504], // col (hospice)
  },
  {
    id: "douane-bardonnex",
    name: "Douane de Bardonnex",
    kind: "Douane autoroutière A1",
    type: "douane",
    section: "Douane et jonctions de Perly",
    dirs: { a: { label: "Vers la France", arrow: "↓" }, b: { label: "Vers Genève", arrow: "↑" } },
    // « Genf » est l'extrémité côté douane : Lausanne -> Genf = vers la France.
    order: { Lausanne: 0, Genf: 1 },
    segments: [{ roads: ["A1"], endpoints: /^Genf$/, location: /Bardonnex|Perly/, alertc: NEG_A }],
    counters: [{ site: "CH:0200", name: "Bardonnex", main: true, a: ["CH:0200.04", "CH:0200.05", "CH:0200.06"], b: ["CH:0200.01", "CH:0200.02", "CH:0200.03"] }],
    at: [6.096, 46.1495], // poste de douane
  },
  {
    id: "douane-vallorbe",
    name: "Douane de Vallorbe",
    kind: "Douane autoroutière A9",
    type: "douane",
    section: "Douane et jonction de Ballaigues",
    dirs: { a: { label: "Vers la France", arrow: "←" }, b: { label: "Vers Lausanne", arrow: "→" } },
    order: { Lausanne: 0, Pontarlier: 1 },
    // Douane et première jonction (Ballaigues). Pas de compteur : CH:0779 (douane) n'est pas servi par l'API,
    // CH:0127 (Orbe) est à 12 km, avant deux jonctions.
    segments: [{ roads: ["A9"], location: /Vallorbe|Ballaigues/, alertc: NEG_A }],
    counters: [],
    at: [6.3855, 46.7312], // poste de douane
  },
];

export const CROSSING_BY_ID = Object.fromEntries(CROSSINGS.map((c) => [c.id, c]));

/** Tous les détecteurs à demander à l'API compteurs. */
export const COUNTER_DETECTORS = CROSSINGS.flatMap((c) => c.counters.flatMap((k) => DIRECTIONS.flatMap((d) => k[d])));

function segmentMatches(seg, s) {
  if (!seg.roads.includes(s.road)) return false;
  if (seg.location && !seg.location.test(s.location_de ?? "")) return false;
  if (seg.endpoints && !(seg.endpoints.test(s.route_from ?? "") || seg.endpoints.test(s.route_to ?? ""))) return false;
  return true;
}

function direction(c, seg, s) {
  if (s.route_arrow === "<->") return "both";
  if (s.route_arrow === "->") {
    const a = c.order[s.route_from];
    const b = c.order[s.route_to];
    if (a != null && b != null && a !== b) return b > a ? "a" : "b";
  }
  if (s.alertc_direction === "both") return "both";
  return seg.alertc[s.alertc_direction] ?? null;
}

/**
 * Fermeture hivernale : celle d'un col, jamais d'un tunnel, d'un axe ni d'une douane. L'OFROU en rattache pourtant
 * parfois une à la route d'accès (05.11.2026 : « H21 Grosser St. Bernhard <-> Martigny zwischen Bourg-St-Bernard und
 * Martigny, Wintersperre », tunnel du Grand-Saint-Bernard ouvert). Elle n'est donc rattachée qu'aux cols.
 */
const isWinterClosure = (s) => /Ursache:\s*Wintersperre/.test(s.text_de ?? "");

/**
 * Points concernés par un message.
 * @returns {{ id: string, dir: "a"|"b"|"both"|null }[]}
 */
export function crossingRefs(s) {
  const out = [];
  const winter = isWinterClosure(s);
  for (const c of CROSSINGS) {
    if (winter && c.type !== "col") continue;
    const seg = c.segments.find((g) => segmentMatches(g, s));
    if (seg) out.push({ id: c.id, dir: direction(c, seg, s) });
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

// ---------------------------------------------------------------------------
// Tronçon touché, en français, d'après le lieu de l'en-tête DE (« zwischen Anschluss Montreux und Anschluss
// Villeneuve » → « entre Montreux et Villeneuve »). Un axe de 60 km n'est jamais fermé en entier : c'est l'info utile.
const PLACE_TYPE = /^(?:null )?(?:Autobahndreieck Verzweigung|Autobahndreieck|Verzweigung|Anschluss|Ortschaft|Raststätte|Rastplatz|Parkplatz Dosierstelle|Parkplatz|Zollstation|Brücke|Tunnel Galerie|Tunnel|Galerie|Pass)\s+/;
const PLACE_FR = [
  [/^Gotthard-Tunnel$/, "tunnel du Gothard"],
  [/^(.+)-Tunnel$/, "tunnel de $1"],
  [/^Gotthard-Pass$/, "col du Gothard"],
  [/^Grosser St\. Bernhard Pass$/, "col du Grand-Saint-Bernard"],
  [/ Brücke$/, ""],
  [/^Flughafen Genf$/, "Genève-Aéroport"],
  [/\bGenf\b/, "Genève"],
  [/^le Vengeron$/, "Le Vengeron"],
  [/\bSüd\b/, "Sud"],
  [/\bOst\b/, "Est"],
  [/\bWest\b/, "Ouest"],
];
function placeFr(raw) {
  const dosage = /^Parkplatz Dosierstelle /.test(raw);
  let name = raw.replace(PLACE_TYPE, "").trim();
  for (const [re, fr] of PLACE_FR) name = name.replace(re, fr);
  return dosage ? `${name} (aire de dosage)` : name;
}

/** « entre Montreux et Villeneuve », « à Perly Nord », « dans le tunnel du Gothard », ou null. */
export function sectionFr(location) {
  const loc = location?.replace(/,\s*bei Kilometer.*$/, "").trim();
  if (!loc) return null;
  const m = loc.match(/^zwischen (.+?) und (.+)$/);
  const withArticle = (p) => (/^(tunnel|col) /.test(p) ? `le ${p}` : p);
  if (m) return `entre ${withArticle(placeFr(m[1]))} et ${withArticle(placeFr(m[2]))}`;
  const place = placeFr(loc);
  if (place.startsWith("tunnel ")) return `dans le ${place}`;
  if (place.startsWith("col ")) return `au ${place}`;
  return `à ${place}`;
}

/** Compact pour le front : pas de champs de debug. */
function brief(s, ref) {
  return {
    situation_id: s.situation_id,
    dir: ref.dir,
    level: levelOf(s),
    section_fr: sectionFr(s.location_de),
    condition: s.condition,
    reason_fr: s.reason_fr,
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

/** Lissage : chaque relevé compteurs ne rapporte qu'une minute de mesure (≈ 4 minutes mesurées sur 10 min à un relevé / 3 min). */
export const COUNTER_WINDOW_MIN = 10;
/** Sans véhicule compté depuis ce délai, observé sans interruption des relevés, le compteur est signalé muet. */
export const COUNTER_SILENT_H = 6;

/**
 * @typedef {object} CounterWindow  mesures récentes, construites par le store
 * @property {number} window_min                     durée de la fenêtre de lissage
 * @property {Record<string, object[]>} samples       par détecteur : minutes mesurées de la fenêtre (lignes parseMeasuredDataXml)
 * @property {Record<string, string|null>} last_vehicle  par détecteur : dernière minute avec au moins un véhicule
 * @property {string|null} silent_before             seuil « muet » si les relevés sont continus depuis, sinon null
 */

/**
 * Fenêtre de mesures à partir de lignes { detector_id, measured_at, … } ; une minute relue deux fois ne compte qu'une fois.
 * `since` : début de la fenêtre. Une mesure plus ancienne (ou sans heure) est écartée, même lue au dernier relevé :
 * le flux peut renvoyer pendant des heures la même minute figée d'un détecteur (Bardonnex, 05.11.2026 : mesure de
 * 01:18 encore servie à 12:14), qui passerait sinon pour actuelle.
 * @param {object[]} rows
 * @param {{ last_vehicle?: Record<string, string|null>, silent_before?: string|null, since?: string|null }} [extra]
 * @returns {CounterWindow}
 */
export function counterWindow(rows, { last_vehicle = {}, silent_before = null, since = null } = {}) {
  const samples = {};
  const seen = new Set();
  for (const { detector_id: id, poll_id: _p, ...r } of rows) {
    if (since && !(r.measured_at >= since)) continue;
    const key = `${id}|${r.measured_at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    (samples[id] ??= []).push(r);
  }
  return { window_min: COUNTER_WINDOW_MIN, samples, last_vehicle, silent_before };
}

/**
 * Agrégat de mesures d'un compteur dans un sens, sur la fenêtre : débit moyen de chaque voie, additionné
 * (véh./h) ; vitesse « véhicules légers » moyenne pondérée par le débit de chaque voie et minute.
 * @param {string[]} ids  détecteurs (voies) du compteur dans ce sens
 * @param {CounterWindow|null} win
 */
export function counterReading(ids, win) {
  const lanes = ids.map((id) => win?.samples[id]).filter((rows) => rows?.length);
  if (!lanes.length) return null;
  const rows = lanes.flat();
  const mean = (xs) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null);
  const flow = (k) => {
    const perLane = lanes.map((lane) => mean(lane.map((r) => r[k]).filter((x) => x != null))).filter((x) => x != null);
    return perLane.length ? Math.round(perLane.reduce((a, x) => a + x, 0)) : null;
  };
  const weighted = rows.filter((r) => r.speed_light != null && r.flow_light > 0);
  const wFlow = weighted.reduce((a, r) => a + r.flow_light, 0);
  const lastVehicle = ids.map((id) => win.last_vehicle[id]).filter(Boolean).sort().at(-1) ?? null;
  return {
    measured_at: rows.map((r) => r.measured_at).filter(Boolean).sort().at(-1) ?? null,
    window_min: win.window_min,
    flow_light: flow("flow_light"),
    flow_heavy: flow("flow_heavy"),
    speed_light: wFlow ? Math.round(weighted.reduce((a, r) => a + r.speed_light * r.flow_light, 0) / wFlow) : null,
    last_vehicle_at: lastVehicle,
    silent: win.silent_before != null && (lastVehicle == null || lastVehicle < win.silent_before),
  };
}

/**
 * Résumé d'un point pour le widget.
 * @param {object} c              entrée de CROSSINGS
 * @param {object[]} situations   sortie de parseTrafficXml().situations
 * @param {string} nowIso
 * @param {CounterWindow|null} counters  mesures compteurs récentes (null si indisponibles)
 */
export function summarizeCrossing(c, situations, nowIso, counters = null) {
  const mine = [];
  for (const s of situations) {
    const ref = crossingRefs(s).find((r) => r.id === c.id);
    if (ref) mine.push({ s, ref });
  }
  const inEffect = mine.filter(({ s }) => isInEffect(s, nowIso));

  const directions = {};
  for (const d of DIRECTIONS) {
    const here = inEffect.filter(({ ref }) => ref.dir === d || ref.dir === "both");
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
    const readings = c.counters.map((k) => ({
      site: k.site,
      name: k.name,
      main: Boolean(k.main),
      ...(counterReading(k[d], counters) ?? { measured_at: null, flow_light: null, flow_heavy: null, speed_light: null }),
    }));
    directions[d] = {
      label: c.dirs[d].label,
      arrow: c.dirs[d].arrow,
      level,
      queue_km,
      delay_min, // annoncé par l'OFROU
      delay_estimate: estimate, // { min, max } : règle empirique, à afficher comme estimation
      since: jams.map((x) => x.s.created_time).filter(Boolean).sort()[0] ?? null,
      messages: ranked.map(({ s, ref }) => brief(s, ref)),
      counters: counters ? readings : null,
    };
  }

  // Messages en vigueur sans sens identifiable : affichés au niveau du point.
  const undirected = inEffect.filter(({ ref, s }) => ref.dir == null && levelOf(s) !== "clear").map(({ s, ref }) => brief(s, ref));

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
    type: c.type,
    section: c.section,
    level: levels.sort((a, b) => rank(b) - rank(a))[0],
    directions,
    undirected,
    upcoming,
  };
}

export function summarizeAll(situations, nowIso, counters = null) {
  return CROSSINGS.map((c) => summarizeCrossing(c, situations, nowIso, counters));
}
