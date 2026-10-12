#!/usr/bin/env node
/**
 * Géométries statiques de la carte → public/data/traffic-geo.json (versionné, à relancer seulement si le
 * périmètre de lib/crossings.mjs change).
 *
 * Sources (couches publiques ASTRA, ArcGIS Online, sans clé) :
 * - tracés : BS_AXIS / AXIS_SEG_MAINAXE_NS (axes principaux des routes nationales) ;
 * - compteurs : SVZ_2022 / SVZCounter_2022 (emplacement et nom des postes de comptage).
 *
 * Sortie : FeatureCollection WGS84
 *   { kind: "axis", crossing }            tracé du tronçon suivi (LineString)
 *   { kind: "counter", crossing, site, name, segment }   poste de comptage (Point)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { CROSSINGS } from "../lib/crossings.mjs";

const ARCGIS = "https://services3.arcgis.com/IXAVBLfeIsfhE7s9/arcgis/rest/services";
const OUT = new URL("../public/data/traffic-geo.json", import.meta.url);

/**
 * Tronçon d'axe national par traversée : axe ASTRA, sens de saisie, nom de segment, emprise conservée.
 * Le Grand-Saint-Bernard (H21) est axe national N21 depuis 2020.
 */
const AXES = {
  gothard: { axis: "N2", position: "+", segment: "ROTSEE - Chiasso", lat: [46.47, 46.84] }, // Faido – Erstfeld
  "san-bernardino": { axis: "N13", position: "=", segment: "Mesocco-Süd - Thusis-Süd", lat: [46.37, 46.57] }, // Mesocco – Splügen
  simplon: { axis: "N9", position: "=", segment: "Glis - Gondo" },
  "grand-st-bernard": { axis: "N21", position: "=", segment: "Martigny-Expo - Col du Gd-St-Bernard" },
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

const round = ([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5];

/** Garde les points dans la bande de latitude ; coupe la ligne en morceaux continus. */
function clip(paths, lat) {
  if (!lat) return paths;
  const out = [];
  for (const path of paths) {
    let cur = [];
    for (const p of path) {
      if (p[1] >= lat[0] && p[1] <= lat[1]) cur.push(p);
      else if (cur.length) {
        out.push(cur);
        cur = [];
      }
    }
    if (cur.length > 1) out.push(cur);
  }
  return out;
}

const features = [];

for (const c of CROSSINGS) {
  const a = AXES[c.id];
  if (!a) throw new Error(`Pas d'axe défini pour ${c.id}`);
  const rows = await query("BS_AXIS/FeatureServer/3", {
    where: `AXIS_NAME = '${a.axis}' AND AXIS_POSITION_CODE = '${a.position}' AND AXIS_SEGMENT_NAME = '${a.segment}'`,
    outFields: "AXIS_NAME,AXIS_SEGMENT_NAME",
    returnGeometry: "true",
    maxAllowableOffset: "0.0003", // ≈ 30 m : invisible aux zooms du widget
  });
  if (!rows.length) throw new Error(`${c.id} : segment ${a.axis} « ${a.segment} » introuvable`);
  const paths = clip(rows.flatMap((r) => r.geometry.paths), a.lat).map((p) => p.map(round));
  if (!paths.length) throw new Error(`${c.id} : tracé vide après découpe`);
  features.push({
    type: "Feature",
    properties: { kind: "axis", crossing: c.id },
    geometry: paths.length === 1 ? { type: "LineString", coordinates: paths[0] } : { type: "MultiLineString", coordinates: paths },
  });
}

const sites = CROSSINGS.flatMap((c) => c.counters.map((k) => ({ crossing: c.id, ...k })));
const zsIds = sites.map((k) => `'${Number(k.site.slice(3))}'`).join(",");
const counterRows = await query("SVZ_2022/FeatureServer/1", { where: `ZS_ID IN (${zsIds})`, outFields: "ZS_ID,Standort", returnGeometry: "true" });
const byZs = new Map(counterRows.map((r) => [String(r.attributes.ZS_ID), r]));
for (const k of sites) {
  const r = byZs.get(String(Number(k.site.slice(3))));
  if (!r) throw new Error(`Compteur ${k.site} absent de SVZ_2022`);
  features.push({
    type: "Feature",
    properties: { kind: "counter", crossing: k.crossing, site: k.site, name: k.name, standort: r.attributes.Standort, segment: k.segment ?? "main", main: Boolean(k.main) },
    geometry: { type: "Point", coordinates: round([r.geometry.x, r.geometry.y]) },
  });
}

const fc = {
  type: "FeatureCollection",
  source: "ASTRA (BS_AXIS, SVZ_2022), ArcGIS Online",
  generated_at: new Date().toISOString(),
  features,
};
await mkdir(new URL(".", OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(fc));
const pts = features.reduce((n, f) => n + (f.geometry.type === "Point" ? 1 : f.geometry.coordinates.flat(f.geometry.type === "LineString" ? 0 : 1).length), 0);
console.log(`${features.length} objets, ${pts} points → ${OUT.pathname}`);
