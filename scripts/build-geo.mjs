#!/usr/bin/env node
/**
 * Géométries statiques de la carte → public/data/traffic-geo.json (versionné, à relancer seulement si le
 * périmètre de lib/crossings.mjs change).
 *
 * Sources :
 * - tracés : couches publiques ASTRA BS_AXIS (ArcGIS Online, sans clé) — 3 AXIS_SEG_MAINAXE_NS (routes
 *   nationales), 2 AXIS_SEG_KS (routes cantonales) ; col du Gothard (H2 uranais absent d'ASTRA) : OpenStreetMap
 *   via Overpass (ODbL) ;
 * - compteurs : SVZ_2022 / SVZCounter_2022 (emplacement et nom des postes de comptage) ;
 * - position de la pastille : `at` de chaque point dans lib/crossings.mjs.
 *
 * Sortie : FeatureCollection WGS84
 *   { kind: "axis", crossing }                      tracé du point suivi (LineString / MultiLineString)
 *   { kind: "point", crossing }                     position de la pastille (Point)
 *   { kind: "counter", crossing, site, name, main } poste de comptage (Point)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { CROSSINGS } from "../lib/crossings.mjs";

const ARCGIS = "https://services3.arcgis.com/IXAVBLfeIsfhE7s9/arcgis/rest/services";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const OUT = new URL("../public/data/traffic-geo.json", import.meta.url);

const main = (axis, position, segment) => `AXIS_NAME = '${axis}' AND AXIS_POSITION_CODE = '${position}' AND AXIS_SEGMENT_NAME = '${segment}'`;

/**
 * Tracé de chaque point : une ou plusieurs sources, découpées à une bande de latitude et/ou de longitude.
 * Le Grand-Saint-Bernard (H21) est axe national N21 depuis 2020 ; son tunnel n'est pas dans BS_AXIS.
 */
const TRACKS = {
  gothard: [{ layer: 3, where: main("N2", "+", "ROTSEE - Chiasso"), lat: [46.47, 46.84] }], // Faido – Erstfeld
  "col-du-gothard": [{ overpass: `[out:json][timeout:60];way["highway"="primary"]["ref"="2"](46.528,8.54,46.618,8.62);out geom;` }], // Airolo – Hospental
  "lausanne-geneve": [{ layer: 3, where: main("N1", "+", "LE VENGERON - ECUBLENS") }],
  "lausanne-valais": [{ layer: 3, where: main("N9", "+", "VILLARS-STE-CROIX - Brig"), lon: [6.652, 7.079] }], // Vennes – Martigny-Fully
  "grand-st-bernard": [{ layer: 3, where: "AXIS_NAME = 'N21' AND (AXIS_POSITION_CODE = '=' OR AXIS_POSITION_CODE = '+')" }], // Martigny – route couverte
  "col-du-grand-st-bernard": [{ layer: 2, where: "AXIS_OWNER = 'VS' AND AXIS_NAME = 'H21' AND AXIS_SEGMENT_NAME = 'Bourg St-Bernard - Col du Gd-St-Bernard'" }],
  "san-bernardino": [{ layer: 3, where: main("N13", "=", "Mesocco-Süd - Thusis-Süd"), lat: [46.37, 46.565] }], // Mesocco – Splügen
  simplon: [{ layer: 3, where: main("N9", "=", "Glis - Gondo") }], // Brigue – Gondo
  "douane-bardonnex": [{ layer: 3, where: main("N1", "+", "Bardonnex - LE VENGERON"), lat: [46.14, 46.165] }], // douane – Perly
  "douane-vallorbe": [
    { layer: 3, where: main("N9", "=", "Vallorbe - Ballaigues") },
    { layer: 3, where: "AXIS_NAME = 'N9' AND AXIS_POSITION_CODE = '+' AND AXIS_SEGMENT_NAME LIKE 'Ballaigues - ESSERT-PITTET%'", lon: [6.38, 6.43] },
  ],
};

async function query(layer, params) {
  const url = `${ARCGIS}/${layer}/query?${new URLSearchParams({ f: "json", outSR: "4326", ...params })}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${layer} : HTTP ${res.status}`);
  const j = await res.json();
  if (j.error) throw new Error(`${layer} : ${JSON.stringify(j.error)}`);
  if (j.exceededTransferLimit) throw new Error(`${layer} : résultat tronqué`);
  return j.features;
}

/** Overpass public : instable (406 sans User-Agent, 429, 502/504), on essaie chaque miroir, puis on recommence après une pause. */
async function overpass(q) {
  const errors = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 10_000 * attempt));
    for (const url of OVERPASS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "User-Agent": "bl-iframe-traffic/build-geo (Blick)", Accept: "application/json" },
          body: new URLSearchParams({ data: q }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        return j.elements.filter((e) => e.type === "way").map((e) => e.geometry.map((p) => [p.lon, p.lat]));
      } catch (e) {
        errors.push(`${url} : ${e.message}`);
      }
    }
  }
  throw new Error(`Overpass indisponible :\n${errors.join("\n")}`);
}

const round = ([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5];

/** Garde les points dans la bande de latitude et/ou de longitude ; coupe la ligne en morceaux continus. */
function clip(paths, { lat, lon }) {
  if (!lat && !lon) return paths;
  const inside = ([x, y]) => (!lat || (y >= lat[0] && y <= lat[1])) && (!lon || (x >= lon[0] && x <= lon[1]));
  const out = [];
  for (const path of paths) {
    let cur = [];
    for (const p of path) {
      if (inside(p)) cur.push(p);
      else if (cur.length) {
        if (cur.length > 1) out.push(cur);
        cur = [];
      }
    }
    if (cur.length > 1) out.push(cur);
  }
  return out;
}

async function track(src) {
  if (src.overpass) return overpass(src.overpass);
  const rows = await query(`BS_AXIS/FeatureServer/${src.layer}`, {
    where: src.where,
    outFields: "AXIS_NAME,AXIS_SEGMENT_NAME",
    returnGeometry: "true",
    maxAllowableOffset: "0.0003", // ≈ 30 m : invisible aux zooms du widget
  });
  if (!rows.length) throw new Error(`BS_AXIS/${src.layer} : rien pour ${src.where}`);
  return rows.flatMap((r) => r.geometry.paths);
}

const features = [];

for (const c of CROSSINGS) {
  const sources = TRACKS[c.id];
  if (!sources) throw new Error(`Pas de tracé défini pour ${c.id}`);
  const paths = [];
  for (const src of sources) paths.push(...clip(await track(src), src).map((p) => p.map(round)));
  if (!paths.length) throw new Error(`${c.id} : tracé vide après découpe`);
  features.push({
    type: "Feature",
    properties: { kind: "axis", crossing: c.id },
    geometry: paths.length === 1 ? { type: "LineString", coordinates: paths[0] } : { type: "MultiLineString", coordinates: paths },
  });
  features.push({ type: "Feature", properties: { kind: "point", crossing: c.id }, geometry: { type: "Point", coordinates: c.at } });
}

const sites = CROSSINGS.flatMap((c) => c.counters.map((k) => ({ crossing: c.id, ...k })));
const zsIds = [...new Set(sites.map((k) => `'${Number(k.site.slice(3))}'`))].join(",");
const counterRows = await query("SVZ_2022/FeatureServer/1", { where: `ZS_ID IN (${zsIds})`, outFields: "ZS_ID,Standort", returnGeometry: "true" });
const byZs = new Map(counterRows.map((r) => [String(r.attributes.ZS_ID), r]));
for (const k of sites) {
  const r = byZs.get(String(Number(k.site.slice(3))));
  if (!r) throw new Error(`Compteur ${k.site} absent de SVZ_2022`);
  features.push({
    type: "Feature",
    properties: { kind: "counter", crossing: k.crossing, site: k.site, name: k.name, standort: r.attributes.Standort, main: Boolean(k.main) },
    geometry: { type: "Point", coordinates: round([r.geometry.x, r.geometry.y]) },
  });
}

const fc = {
  type: "FeatureCollection",
  source: "ASTRA (BS_AXIS, SVZ_2022), ArcGIS Online ; col du Gothard : © contributeurs OpenStreetMap (ODbL)",
  generated_at: new Date().toISOString(),
  features,
};
await mkdir(new URL(".", OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(fc));
const pts = features.reduce((n, f) => n + (f.geometry.type === "Point" ? 1 : f.geometry.coordinates.flat(f.geometry.type === "LineString" ? 0 : 1).length), 0);
console.log(`${features.length} objets, ${pts} points → ${OUT.pathname}`);
