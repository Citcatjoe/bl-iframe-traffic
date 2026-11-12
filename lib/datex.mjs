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
// En-tête DE réel : "<Statut>: A2 Luzern -> Gotthard zwischen Anschluss Amsteg und … Sachlage: …"
// = route, extrémités d'itinéraire, flèche ("->" un sens, "<->" les deux), lieu.
// Le lieu commence par un type d'objet TMC ; "Verzweigung" seul est exclu car il sert aussi
// d'extrémité ("Verzweigung Gd-St-Bernard <-> Martigny-Croix").
const LOCATION_START =
  "zwischen|bei|Anschluss|Tunnel|Autobahndreieck|Autobahnkreuz|Ortschaft|Raststätte|Rastplatz|Parkplatz|Zollstation|Pass|Kreuzung|Brücke|Galerie|Autoverlad|Bahnhof";
// Numéro de route facultatif : certaines fermetures de col arrivent sans (« Bourg-St-Bernard -> St-Oyen zwischen Pass … »).
const HEADER_RE = new RegExp(`^(?:([AH]\\d+[A-Z]?|\\d{2,3}) )?(.+?) (<->|->) (.+?)(?: ((?:${LOCATION_START})\\b.*))?$`);

/** Statut éditorial en tête de description ("Freigegeben" = publié, "Aufgehoben" = levé). */
const CANCELLED_PREFIX_RE = /^(Aufgehoben|Révoqué|Revocato)\s*:/;

const JAM_RANK = { stationaryTraffic: 3, queuingTraffic: 2, slowTraffic: 1 };
const JAM_KIND = { stationaryTraffic: "stationary", queuingTraffic: "queuing", slowTraffic: "slow" };
const ROADWORKS_TYPES = new Set(["MaintenanceWorks", "ConstructionWorks"]);

function parseHeader(de) {
  if (!de) return null;
  const m = de.match(/^[^:]+:\s*(.*?)\s+Sachlage:/s);
  return m ? m[1].trim() : null;
}

function routeInfo(header) {
  const m = header?.match(HEADER_RE);
  if (!m) return { road: header?.match(/^([AH]\d+[A-Z]?|\d{2,3})\s/)?.[1] ?? null, from: null, to: null, arrow: null, location: null };
  const [, road = null, from, arrow, to, location = ""] = m;
  return { road, from, to, arrow, location: location.trim() };
}

/**
 * Nature de la situation, lue dans "Sachlage:" (vocabulaire fermé relevé sur le flux, ~3 000 records).
 * "Strecke gesperrt" avec "eine lokale Umleitung ist eingerichtet" reste franchissable : "closed_detour".
 * "eine Umleitung ist eingerichtet" (sans "lokale") peut être un détour par un autre col : "closed".
 * @returns {"closed"|"closed_detour"|"jam"|"slow"|"jam_expected"|"access_closed"|"hindrance"|"other"}
 */
function condition(de) {
  const s = de?.match(/Sachlage:\s*(.*?)(?=\s+(?:Ursache|Dauer|Zusatz|Länge|Zeitverlust|Empfehlung|Verkehrsführung|Hinweis)\b|$)/s)?.[1] ?? "";
  if (/^(Strecke|Tunnel|Brücke) gesperrt|^Strecke blockiert/.test(s)) {
    return /Empfehlung:\s*eine lokale Umleitung/.test(de) ? "closed_detour" : "closed";
  }
  if (/^Stau zu erwarten/.test(s)) return "jam_expected";
  if (/^Stau in der (Aus|Ein)fahrt/.test(s)) return "slow";
  if (/^Stau\b/.test(s)) return "jam";
  if (/^stockender Verkehr/.test(s)) return "slow";
  if (/^(Einfahrt|Ausfahrt|Ein- und Ausfahrt) gesperrt|gesperrt für/.test(s)) return "access_closed";
  if (/^Verkehrsbehinderung/.test(s)) return "hindrance";
  return "other";
}

/** Motif en français, lu dans « Raison: » du texte FR (« travaux de maintenance », « fermeture hivernale »…), ou null. */
function reasonFr(fr) {
  return fr?.match(/Raison:\s*(.*?)(?=\s+(?:Complément \d+|Durée|Recommandation|Déviation recommandée|Gestion du trafic):|\s*$)/s)?.[1].trim() || null;
}

/**
 * Plage horaire récurrente : "Dauer: nachts voraussichtlich 11.10.2026 22:00 bis 16.10.2026 05:00"
 * = toutes les nuits de 22:00 à 05:00 (heure suisse) entre ces dates ; validPeriod ne couvre que l'enveloppe.
 * Heures incohérentes avec "nachts"/"tagsüber" (relevé : "nachts … 07:00 bis … 17:00") → plage par défaut.
 */
function schedule(de) {
  const m = de?.match(/Dauer:\s*(nachts|tagsüber)\b[^\d]*\d{2}\.\d{2}\.\d{4} (\d{2}:\d{2})[^\d]+\d{2}\.\d{2}\.\d{4} (\d{2}:\d{2})/);
  if (!m) return null;
  const [, kind, from, to] = m;
  if (kind === "nachts") return from > to ? { kind: "night", from, to } : { kind: "night", from: "20:00", to: "06:00" };
  return from < to ? { kind: "day", from, to } : { kind: "day", from: "06:00", to: "20:00" };
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
  const route = routeInfo(parseHeader(t.de));

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
    roadworks: types.some((ty) => ROADWORKS_TYPES.has(ty)),
    causes: [...new Set(collect(records, "causeType").map(text).filter(Boolean))],
    condition: condition(t.de),
    reason_fr: reasonFr(t.fr),
    jam: jamType ? JAM_KIND[jamType] : null,
    jam_probability: probability,
    road: route.road,
    route_from: route.from,
    route_to: route.to,
    route_arrow: route.arrow, // "->" | "<->" | null
    location_de: route.location,
    alertc_direction: text(collect(records, "alertCDirectionCoded")[0]), // "positive" | "negative" | "both"
    queue_km: q.km,
    queue_km_src: q.src,
    delay_min: d.min,
    delay_min_src: d.src,
    start: minIso(starts),
    end: maxIso(ends),
    schedule: schedule(t.de),
    text_de: t.de ?? null,
    text_fr: t.fr ?? null,
    text_it: t.it ?? null,
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

/** "HH:MM" en heure suisse. */
const zurichClock = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/**
 * Message en vigueur à `nowIso` : actif, dans sa fenêtre de validité et, pour une plage récurrente
 * ("nachts"/"tagsüber"), dans la plage horaire du jour.
 */
export function isInEffect(s, nowIso) {
  if (s.status !== "active") return false;
  if ((s.start && s.start > nowIso) || (s.end && s.end < nowIso)) return false;
  if (!s.schedule) return true;
  const hm = zurichClock.format(new Date(nowIso));
  const { from, to } = s.schedule;
  return from <= to ? hm >= from && hm < to : hm >= from || hm < to;
}
