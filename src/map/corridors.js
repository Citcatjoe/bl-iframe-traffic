import { COUNTER_MIN_ZOOM } from "../config/mapConfig";
import { styleOf } from "../lib/levels";

// Tracés surveillés (blanc + couleur du niveau) et points de comptage secondaires (révélés en zoomant).
// Les propriétés dynamiques (niveau, sélection, survol, vitesses) sont recalculées dans `corridorData`.

const AXES = "axes";
const DOTS = "counter-dots";
export const LINE_LAYERS = ["axes-hit"];

const EMPTY = { type: "FeatureCollection", features: [] };

export function addCorridorLayers(map) {
  map.addSource(AXES, { type: "geojson", data: EMPTY });
  map.addSource(DOTS, { type: "geojson", data: EMPTY });
  const width = (base, sel, hov) => ["case", ["get", "sel"], sel, ["get", "hov"], hov, base];
  const lineZoom = (w) => ["interpolate", ["linear"], ["zoom"], 6, ["*", w, 0.8], 10, ["*", w, 1.4]];
  map.addLayer({
    id: "axes-casing",
    type: "line",
    source: AXES,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#FFFFFF", "line-width": lineZoom(width(7, 10, 9)) },
  });
  map.addLayer({
    id: "axes-line",
    type: "line",
    source: AXES,
    filter: ["!", ["get", "dashed"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": lineZoom(width(3.5, 6, 5)) },
  });
  map.addLayer({
    id: "axes-dashed",
    type: "line",
    source: AXES,
    filter: ["get", "dashed"],
    layout: { "line-join": "round" },
    paint: { "line-color": ["get", "color"], "line-width": lineZoom(width(3.5, 6, 5)), "line-dasharray": [1.6, 1] },
  });
  // Couche invisible, plus large, pour le clic et le survol des tracés
  map.addLayer({ id: "axes-hit", type: "line", source: AXES, paint: { "line-color": "#000", "line-opacity": 0, "line-width": 16 } });
  map.addLayer({
    id: "counter-dots",
    type: "circle",
    source: DOTS,
    minzoom: COUNTER_MIN_ZOOM,
    paint: {
      "circle-radius": 4.5,
      "circle-color": ["get", "color"],
      "circle-stroke-color": "#FFFFFF",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "counter-labels",
    type: "symbol",
    source: DOTS,
    minzoom: COUNTER_MIN_ZOOM,
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Noto Sans Bold"],
      "text-size": 11,
      "text-anchor": "left",
      "text-offset": [0.8, 0],
      "text-optional": true,
      "text-max-width": 30,
    },
    paint: { "text-color": "#504949", "text-halo-color": "rgba(255,255,255,0.95)", "text-halo-width": 1.6 },
  });
}

/** « 72 / 69 km/h » (S / N) d'un point de comptage, ou son nom seul sans mesure. */
function dotLabel(name, s, n) {
  const v = [s, n].map((r) => r?.speed_light ?? null);
  if (v.every((x) => x == null)) return name;
  return `${name} · ${v.map((x) => x ?? "–").join(" / ")} km/h`;
}

/** Met à jour les tracés et les points selon l'état courant. */
export function setCorridorData(map, geo, crossings, sel, hover) {
  if (!geo || !map.getSource(AXES)) return;
  const byId = new Map(crossings.map((c) => [c.id, c]));
  const axes = geo.features
    .filter((f) => f.properties.kind === "axis")
    .map((f) => {
      const id = f.properties.crossing;
      const st = styleOf(byId.get(id)?.level);
      return { ...f, properties: { crossing: id, color: st.color, dashed: !!st.dashed, sel: id === sel, hov: id === hover } };
    })
    // Sélection et survol dessinés au-dessus
    .sort((a, b) => a.properties.sel - b.properties.sel || a.properties.hov - b.properties.hov);

  const dots = geo.features
    .filter((f) => f.properties.kind === "counter" && !f.properties.main && f.properties.segment === "main")
    .map((f) => {
      const { crossing, site, name } = f.properties;
      const c = byId.get(crossing);
      const find = (d) => c?.directions[d].counters?.find((k) => k.site === site) ?? null;
      return {
        ...f,
        properties: { crossing, color: styleOf(c?.level).color, label: dotLabel(name, find("S"), find("N")) },
      };
    });

  map.getSource(AXES).setData({ type: "FeatureCollection", features: axes });
  map.getSource(DOTS).setData({ type: "FeatureCollection", features: dots });
}

/** Traversée sous le point (tracé), ou null. */
export function pickCorridor(map, pt, tolerance) {
  if (!map.getLayer("axes-hit")) return null;
  const f = map.queryRenderedFeatures(
    [
      [pt.x - tolerance, pt.y - tolerance],
      [pt.x + tolerance, pt.y + tolerance],
    ],
    { layers: LINE_LAYERS },
  )[0];
  return f?.properties.crossing ?? null;
}

/** Emprise [[w,s],[e,n]] d'une traversée : tracé + compteurs. */
export function crossingBounds(geo, id) {
  let w = 180, s = 90, e = -180, n = -90;
  const add = ([x, y]) => {
    w = Math.min(w, x);
    e = Math.max(e, x);
    s = Math.min(s, y);
    n = Math.max(n, y);
  };
  const walk = (c) => (typeof c[0] === "number" ? add(c) : c.forEach(walk));
  for (const f of geo?.features ?? []) if (f.properties.crossing === id) walk(f.geometry.coordinates);
  return w <= e ? [[w, s], [e, n]] : null;
}
