/**
 * Parsing DATEX II « MeasuredData » des compteurs routiers (opentransportdata.swiss). Module PUR.
 *
 * Une mesure par détecteur (= une voie, un sens) et par minute. Index des valeurs (table des points
 * de mesure OTD V25, identique pour tous les détecteurs) :
 *   11 débit véhicules légers (classes suisses 1–7), 12 vitesse moyenne véhicules légers
 *   21 débit poids lourds (classes 8–10),            22 vitesse moyenne poids lourds
 *    1 / 2 véhicules non classés / vitesse non plausible (contrôle d'erreur, ignorés ici)
 * Débits en véhicules/heure (extrapolés de la minute), vitesses en km/h. Une vitesse absente
 * (aucun véhicule de la catégorie pendant la minute) donne null. Une valeur marquée `dataError`
 * (ex. SENSOR_WWD : circulation à contresens détectée, relevé en direct à Gondo) donne aussi null.
 */
import { XMLParser } from "fast-xml-parser";
import { DatexParseError } from "./datex.mjs";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name, jpath, _leaf, isAttribute) => !isAttribute && (name === "siteMeasurements" || jpath.endsWith("siteMeasurements.measuredValue")),
});

const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const text = (x) => (x == null ? null : typeof x === "object" ? (x["#text"] != null ? String(x["#text"]) : null) : String(x));
const num = (x) => {
  const t = text(x);
  if (t == null || t.trim() === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const iso = (x) => {
  const t = text(x);
  if (!t) return null;
  const d = new Date(t.replace(/(\.\d{3})\d+/, "$1"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

function find(obj, key) {
  if (!obj || typeof obj !== "object") return undefined;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) {
    const r = find(v, key);
    if (r !== undefined) return r;
  }
  return undefined;
}

const FIELD_BY_INDEX = { 11: "flow_light", 12: "speed_light", 21: "flow_heavy", 22: "speed_heavy" };

/**
 * @param {string} xml  Réponse SOAP brute de pullMeasuredData
 * @returns {{ publication_time: string|null, detectors: Record<string, { measured_at: string|null, flow_light: number|null, speed_light: number|null, flow_heavy: number|null, speed_heavy: number|null }> }}
 */
export function parseMeasuredDataXml(xml) {
  if (typeof xml !== "string" || !xml.trim().startsWith("<")) throw new DatexParseError("Réponse compteurs vide ou non XML.");
  let doc;
  try {
    doc = parser.parse(xml);
  } catch (e) {
    throw new DatexParseError(`XML compteurs illisible : ${e.message}`);
  }
  const fault = find(doc, "Fault");
  if (fault) throw new DatexParseError(`SOAP Fault : ${text(fault.faultstring) ?? JSON.stringify(fault).slice(0, 300)}`);
  const pub = find(doc, "payloadPublication");
  if (!pub) throw new DatexParseError("payloadPublication introuvable (réponse compteurs inattendue).");

  const detectors = {};
  for (const sm of arr(pub.siteMeasurements)) {
    const id = sm.measurementSiteReference?.["@id"];
    if (!id) continue;
    const row = { measured_at: iso(sm.measurementTimeDefault), flow_light: null, speed_light: null, flow_heavy: null, speed_heavy: null };
    for (const mv of arr(sm.measuredValue)) {
      const field = FIELD_BY_INDEX[mv["@index"]];
      if (!field) continue;
      const basic = mv.measuredValue?.basicData;
      const value = field.startsWith("flow") ? basic?.vehicleFlow : basic?.averageVehicleSpeed;
      if (text(value?.dataError) === "true") continue;
      row[field] = field.startsWith("flow") ? num(value?.vehicleFlowRate) : num(value?.speed);
    }
    detectors[id] = row;
  }
  return { publication_time: iso(pub.publicationTime), detectors };
}
