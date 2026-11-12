#!/usr/bin/env node
/**
 * Contours de la Suisse → public/data/ch.geojson et ch-precise.geojson (versionnés, à ne relancer que pour une
 * nouvelle frontière).
 *
 * Source : swisstopo swissBOUNDARIES3D, territoire national (`ch.swisstopo.swissboundaries3d-land-flaeche.fill`),
 * via l'API publique geo.admin.ch, sans clé. Données ouvertes, source à citer (« swisstopo »).
 *
 * Seul l'anneau extérieur est gardé (les enclaves de Büsingen et Campione ne changent rien à l'échelle de la
 * carte), simplifié par Douglas-Peucker :
 * - ch.geojson ≈ 550 points : filtre `within` des localités (coût proportionnel au nombre de points) ;
 * - ch-precise.geojson ≈ 2 400 points : trame hors Suisse, visible au zoom.
 */
import { writeFile } from "node:fs/promises";

const URL_CH =
  "https://api3.geo.admin.ch/rest/services/api/MapServer/ch.swisstopo.swissboundaries3d-land-flaeche.fill/CH?geometryFormat=geojson&sr=4326&returnGeometry=true";
const OUT = (name) => new URL(`../public/data/${name}`, import.meta.url);
const TARGETS = { "ch.geojson": 550, "ch-precise.geojson": 2400 };

/** Distance d'un point au segment ab, en degrés (suffisant pour simplifier à l'échelle d'un pays). */
function segDist([x, y], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

/** Douglas-Peucker itératif sur une ligne ; garde toujours les extrémités. */
function simplify(points, tolerance) {
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let max = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(points[i], points[a], points[b]);
      if (d > max) [max, idx] = [d, i];
    }
    if (idx >= 0 && max > tolerance) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Tolérance la plus forte qui garde au moins `target` points (recherche dichotomique, résultat déterministe). */
function simplifyTo(ring, target) {
  let lo = 0;
  let hi = 0.1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (simplify(ring, mid).length >= target) lo = mid;
    else hi = mid;
  }
  return simplify(ring, lo);
}

const round = ([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6];

const res = await fetch(URL_CH);
if (!res.ok) throw new Error(`geo.admin.ch : HTTP ${res.status}`);
const { feature } = await res.json();
const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
// Le territoire national est un seul polygone ; on prend le plus grand anneau extérieur par sécurité.
const ring = polygons.map((p) => p[0]).sort((a, b) => b.length - a.length)[0];

for (const [name, target] of Object.entries(TARGETS)) {
  const simplified = simplifyTo(ring, target).map(round);
  await writeFile(OUT(name), JSON.stringify({ type: "Polygon", coordinates: [simplified] }));
  console.log(`${name} : ${simplified.length} points (sur ${ring.length})`);
}
