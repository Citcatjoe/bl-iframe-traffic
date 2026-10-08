/**
 * Parsing DATEX II (v2.3, profil OFROU/FEDRO) du flux « Traffic Situations ».
 *
 * Module PUR : pas de réseau, pas de fichier, pas d'horloge implicite (l'heure est passée
 * en argument). Réutilisable tel quel dans un nœud Code n8n ou une Cloud Function.
 *
 * Unité de sortie = une *situation* (pas un situationRecord) : constaté sur le flux réel,
 * le texte public (commentType=description) n'est porté que par le premier record ; les
 * records suivants décrivent la cause, la gestion du trafic, etc. de la même situation.
 */
import { XMLParser } from "fast-xml-parser";

export class DatexParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "DatexParseError";
  }
}

const ARRAY_TAGS = new Set([
  "situation",
  "situationRecord",
  "value",
  "generalPublicComment",
  "nonGeneralPublicComment",
  "validPeriod",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true, // "dx223:situation" → "situation", "xsi:type" → "@type"
  parseTagValue: false, // garde les chaînes ; conversion explicite plus bas
  parseAttributeValue: false,
  isArray: (name, _jpath, _leaf, isAttribute) => !isAttribute && ARRAY_TAGS.has(name),
});

const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

/** Toutes les feuilles ont un xsi:type → fast-xml-parser produit { "#text", "@type" }. */
const text = (x) => {
  if (x == null) return null;
  if (typeof x === "object") return x["#text"] != null ? String(x["#text"]) : null;
  return String(x);
};

const num = (x) => {
  const t = text(x);
  if (t == null || t.trim() === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Collecte récursivement toutes les valeurs d'une clé. */
function collect(obj, key, out = []) {
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (k === key) out.push(...arr(v));
      collect(v, key, out);
    }
  }
  return out;
}

/** Textes de la description publique : { de, fr, it } (lang réel : "de-CH", "fr-CH", "it-CH"). */
function descriptionTexts(records) {
  for (const rec of records) {
    for (const gpc of arr(rec.generalPublicComment)) {
      // commentType "internalNote" existe aussi (souvent DE seul, ton interne) : ignoré.
      if (text(gpc.commentType) !== "description") continue;
      const out = {};
      for (const v of arr(gpc.comment?.values?.value)) {
        const lang = String(v?.["@lang"] ?? "").slice(0, 2);
        const t = text(v)?.trim();
        if (lang && t) out[lang] = t;
      }
      if (Object.keys(out).length) return out;
    }
  }
  return {};
}

// ---------------------------------------------------------------------------
// Axe A2 / H2 (Bâle – Chiasso). En-tête DE réel : "<Statut>: A2 Luzern -> Gotthard <lieu> Sachlage: …"
// Les extrémités d'itinéraire de l'axe sont un petit ensemble fermé (relevé sur le flux).
// Rang = position du nord au sud.
const AXIS_ORDER = {
  Basel: 0,
  Birsfelden: 0,
  "Verzweigung Hagnau": 0,
  Olten: 1,
  Luzern: 2,
  Flüelen: 3,
  Göschenen: 4,
  Gotthard: 5,
  Airolo: 6,
  Bellinzona: 7,
  Chiasso: 8,
};
const AXIS_EP = Object.keys(AXIS_ORDER)
  .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
const AXIS_HEADER_RE = new RegExp(`^(A2|H2) (${AXIS_EP}) (<->|->) (${AXIS_EP})(?: (.*))?$`);

/**
 * Corridor du Gothard, testé sur la partie « lieu » de l'en-tête uniquement : "Gotthard" seul
 * apparaît aussi comme *extrémité* d'itinéraire ("A2 Basel -> Gotthard") sur tout l'axe A2,
 * d'où des faux positifs massifs si on cherche dans tout le texte.
 * Couvre le tunnel A2, les rampes Erstfeld–Göschenen et Airolo–Faido, et la route du col (H2).
 */
const CORRIDOR_RE =
  /Gotthard|Erstfeld|Amsteg|Gurtnellen|Wassen|Göschenen|Andermatt|Hospental|Motto Bartola|Airolo|Quinto|Ambrì|Piotta|Faido/i;

/** Statut éditorial en tête de description ("Freigegeben" = publié, "Aufgehoben" = levé). */
const CANCELLED_PREFIX_RE = /^(Aufgehoben|Révoqué|Revocato)\s*:/;

const JAM_RANK = { stationaryTraffic: 3, queuingTraffic: 2, slowTraffic: 1 };
const JAM_KIND = { stationaryTraffic: "stationary", queuingTraffic: "queuing", slowTraffic: "slow" };

const ALERTC_TO_AXIS_DIR = { negative: "N-S", positive: "S-N", both: "both" };

function parseHeader(de) {
  if (!de) return null;
  const m = de.match(/^[^:]+:\s*(.*?)\s+Sachlage:/s);
  return m ? m[1].trim() : null;
}

function axisInfo(header) {
  const m = header?.match(AXIS_HEADER_RE);
  if (!m) return null;
  const [, road, from, arrow, to, location = ""] = m;
  const direction =
    arrow === "<->" ? "both" : AXIS_ORDER[to] > AXIS_ORDER[from] ? "N-S" : AXIS_ORDER[to] < AXIS_ORDER[from] ? "S-N" : null;
  return { road, from, to, location: location.trim(), direction };
}

/** Longueur de bouchon (km). Seulement pour un bouchon : "Länge [km]" désigne sinon la longueur du chantier. */
function queueLength(jamRecord, t) {
  const m = num(collect(jamRecord, "lengthAffected")[0]);
  if (m != null && m > 0) return { km: Math.round(m / 100) / 10, src: "lengthAffected" };
  // Formulation réelle : "Sachlage: Stau Länge [km] 4.0" / "bouchon longueur [km] 4.0" / "colonna lunghezza [km] 4.0"
  const mt =
    t.de?.match(/Länge \[km\] (\d+(?:[.,]\d+)?)/) ||
    t.fr?.match(/longueur \[km\] (\d+(?:[.,]\d+)?)/) ||
    t.it?.match(/lunghezza \[km\] (\d+(?:[.,]\d+)?)/) ||
    // Forme libre (non observée sur le flux, gardée par prudence) : "8 km Stau"
    t.de?.match(/(\d+(?:[.,]\d+)?)\s*km\s*Stau/);
  if (mt) return { km: parseFloat(mt[1].replace(",", ".")), src: "text" };
  return { km: null, src: null };
}

/** Temps perdu (min). */
function delay(situationRecords, t) {
  const s = num(collect(situationRecords, "delayTimeValue")[0]);
  if (s != null && s >= 0) return { min: Math.round(s / 60), src: "delayTimeValue" };
  // Formulation réelle : "Zeitverlust Anz. [min] 45" / "retards Nbre. [min] 45" / "ritardi No. [min] 45"
  const mt = (t.de || "").match(/Zeitverlust[^:[]{0,12}\[min\] (\d+)/) || (t.fr || "").match(/retards[^:[]{0,12}\[min\] (\d+)/);
  if (mt) return { min: Number(mt[1]), src: "text" };
  // Formes libres (non observées, gardées par prudence) : "Zeitverlust bis zu 1 Stunde 30 Minuten"
  const mh = (t.de || "").match(/(?:Zeitverlust|Wartezeit)\D{0,15}(\d+(?:[.,]\d+)?)\s*(?:Std|Stunde)\w*\.?(?:\s*(?:und\s*)?(\d+)\s*Min)?/i);
  if (mh) return { min: Math.round(parseFloat(mh[1].replace(",", ".")) * 60 + (mh[2] ? Number(mh[2]) : 0)), src: "text" };
  const mm = (t.de || "").match(/(?:Zeitverlust|Wartezeit)\D{0,15}(\d+)\s*Min/i);
  if (mm) return { min: Number(mm[1]), src: "text" };
  return { min: null, src: null };
}

function maxIso(values) {
  return values.filter(Boolean).sort().at(-1) ?? null;
}

function minIso(values) {
  return values.filter(Boolean).sort()[0] ?? null;
}

/** "2026-10-08T16:00:00.000000Z" (microsecondes) → ISO 8601 en ms, comparable lexicalement. */
function iso(x) {
  const t = text(x);
  if (!t) return null;
  const d = new Date(t.replace(/(\.\d{3})\d+/, "$1"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseSituation(sit) {
  const records = arr(sit.situationRecord);
  const t = descriptionTexts(records);
  const header = parseHeader(t.de);
  const axis = axisInfo(header);

  const types = [...new Set(records.map((r) => String(r["@type"] ?? "").split(":").pop()).filter(Boolean))];

  // Bouchon : record AbnormalTraffic le plus sévère (stationary > queuing > slow)
  let jamRecord = null;
  for (const r of records) {
    const att = text(r.abnormalTrafficType);
    if (JAM_RANK[att] && (!jamRecord || JAM_RANK[att] > JAM_RANK[text(jamRecord.abnormalTrafficType)])) jamRecord = r;
  }
  const jamType = jamRecord ? text(jamRecord.abnormalTrafficType) : null;
  const probability = jamRecord ? text(jamRecord.probabilityOfOccurrence) : null;
  const q = jamRecord ? queueLength(jamRecord, t) : { km: null, src: null };
  const d = delay(records, t);

  const alertc = text(collect(records, "alertCDirectionCoded")[0]);
  let direction = null;
  let directionSrc = null;
  if (axis?.direction) {
    direction = axis.direction;
    directionSrc = "text";
  } else if (/^(A2|H2)\b/.test(header ?? "") && ALERTC_TO_AXIS_DIR[alertc]) {
    direction = ALERTC_TO_AXIS_DIR[alertc];
    directionSrc = "alertc";
  }

  const cancelled =
    collect(records, "cancel").some((c) => text(c) === "true") || CANCELLED_PREFIX_RE.test(t.de ?? t.fr ?? "");

  // overallStartTime ≈ heure de saisie ; la fenêtre effective est dans validPeriod
  // (ex. fermeture nocturne saisie à 11:44 pour 18:00 → 08:00).
  const specs = records.map((r) => r.validity?.validityTimeSpecification ?? {});
  const starts = specs.map((s) => minIso(arr(s.validPeriod).map((p) => iso(p.startOfPeriod))) ?? iso(s.overallStartTime));
  const ends = specs.flatMap((s) => [iso(s.overallEndTime), ...arr(s.validPeriod).map((p) => iso(p.endOfPeriod))]);

  return {
    situation_id: sit["@id"],
    version: Number(sit["@version"]) || 0,
    version_time: maxIso(records.map((r) => iso(r.situationRecordVersionTime))),
    created_time: iso(records[0]?.situationRecordCreationTime),
    status: cancelled ? "cancelled" : "active",
    types,
    causes: [...new Set(collect(records, "causeType").map(text).filter(Boolean))],
    jam: jamType ? JAM_KIND[jamType] : null,
    jam_probability: probability,
    road: axis?.road ?? header?.match(/^([AH]\d+[A-Z]?|\d{2,3})\s/)?.[1] ?? null,
    route_from: axis?.from ?? null,
    route_to: axis?.to ?? null,
    location_de: axis?.location ?? null,
    direction, // "N-S" | "S-N" | "both" | null (axe A2/H2 seulement)
    direction_src: directionSrc, // "text" | "alertc" | null
    alertc_direction: alertc, // brut : "positive" | "negative" | "both"
    queue_km: q.km,
    queue_km_src: q.src,
    delay_min: d.min,
    delay_min_src: d.src,
    start: minIso(starts),
    end: maxIso(ends),
    text_de: t.de ?? null,
    text_fr: t.fr ?? null,
    text_it: t.it ?? null,
    is_gothard: Boolean(axis && CORRIDOR_RE.test(axis.location)),
  };
}

/**
 * @param {string} xml  Réponse SOAP brute
 * @param {{ fetchedAt?: string }} [opts]
 * @returns {{ fetched_at: string|null, publication_time: string|null, supplier: string|null, situations: object[] }}
 */
export function parseTrafficXml(xml, { fetchedAt = null } = {}) {
  if (typeof xml !== "string" || !xml.trim().startsWith("<")) throw new DatexParseError("Réponse vide ou non XML.");
  let doc;
  try {
    doc = parser.parse(xml);
  } catch (e) {
    throw new DatexParseError(`XML illisible : ${e.message}`);
  }
  const fault = collect(doc, "Fault")[0];
  if (fault) throw new DatexParseError(`SOAP Fault : ${text(fault.faultstring) ?? JSON.stringify(fault).slice(0, 300)}`);
  const pub = collect(doc, "payloadPublication")[0];
  if (!pub) throw new DatexParseError("payloadPublication introuvable (structure DATEX II inattendue).");

  return {
    fetched_at: fetchedAt,
    publication_time: iso(pub.publicationTime),
    supplier: text(collect(doc, "nationalIdentifier")[0]),
    situations: arr(pub.situation).map(parseSituation),
  };
}

const ROADWORKS_TYPES = new Set(["MaintenanceWorks", "ConstructionWorks"]);

/** Bouchon/colonne Gothard confirmé et en cours ("slow" et "Stau zu erwarten" = probable exclus). */
export function isActiveGothardJam(s) {
  return s.is_gothard && s.status === "active" && (s.jam === "stationary" || s.jam === "queuing") && s.jam_probability === "certain";
}

/**
 * Agrégat d'un sens : plus long bouchon (0 si aucun) et plus grand temps perdu annoncé (null si non annoncé).
 * Un message "both" compte pour les deux sens.
 */
export function directionStats(situations, direction) {
  const jams = situations
    .filter((s) => isActiveGothardJam(s) && (s.direction === direction || s.direction === "both"))
    .sort((a, b) => (b.queue_km ?? -1) - (a.queue_km ?? -1));
  const delays = jams.map((s) => s.delay_min).filter((x) => x != null);
  return {
    jams,
    queue_km: jams.length ? Math.max(...jams.map((s) => s.queue_km ?? 0)) : 0,
    delay_min: delays.length ? Math.max(...delays) : null,
  };
}

/**
 * Résumé pour le widget : bouchons actifs par sens + autres messages Gothard en vigueur (hors chantiers).
 * @param {object[]} situations  sortie de parseTrafficXml().situations
 * @param {string} nowIso        ISO 8601 (toISOString)
 */
export function gothardSummary(situations, nowIso) {
  const alerts = situations.filter(
    (s) =>
      s.is_gothard &&
      s.status === "active" &&
      !isActiveGothardJam(s) &&
      !s.types.some((t) => ROADWORKS_TYPES.has(t)) &&
      (!s.start || s.start <= nowIso) &&
      (!s.end || s.end >= nowIso),
  );
  return { "N-S": directionStats(situations, "N-S"), "S-N": directionStats(situations, "S-N"), alerts };
}
