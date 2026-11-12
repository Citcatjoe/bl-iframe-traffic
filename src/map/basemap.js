import { CH_OUTLINE_URL, CH_PRECISE_URL, HILLSHADE, MAP_THEMES } from '../config/mapConfig';

// Ajustements du fond de carte (D12–D18). Tolérant : une couche absente du
// style (autre fournisseur) est ignorée, le reste s'applique.

const firstSymbolId = (map) => map.getStyle().layers.find((l) => l.type === 'symbol')?.id;

let geoCache = null;
const fetchJson = (url) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url} ${r.status}`);
    return r.json();
  });
const loadOutlines = () => (geoCache ??= Promise.all([fetchJson(CH_OUTLINE_URL), fetchJson(CH_PRECISE_URL)]));

/**
 * À appeler sur chaque `style.load` (chargement initial, puis changement de thème : le style est remplacé).
 * `isCurrent()` évite de toucher une carte détruite, ou un style remplacé entre-temps.
 */
export function customizeBasemap(map, theme, isCurrent) {
  const t = MAP_THEMES[theme];
  const layers = map.getStyle().layers;

  // D13 labels en français, D14 noms de pays masqués
  for (const l of layers) {
    if (l.type !== 'symbol') continue;
    if (/country/i.test(l.id)) {
      map.setLayoutProperty(l.id, 'visibility', 'none');
      continue;
    }
    const tf = map.getLayoutProperty(l.id, 'text-field');
    if (tf && /name/.test(JSON.stringify(tf))) {
      map.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:fr'], ['get', 'name']]);
    }
  }

  const places = t.places.filter((id) => map.getLayer(id));
  for (const id of t.hidden) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');

  // D15 Berne au même style que les autres villes
  if (map.getLayer('label_city') && map.getLayer('label_city_capital')) {
    for (const p of ['text-size', 'text-font']) {
      const v = map.getLayoutProperty('label_city', p);
      if (v !== undefined) map.setLayoutProperty('label_city_capital', p, v);
    }
    map.setLayoutProperty('label_city_capital', 'icon-image', '');
  }

  // D16 localités atténuées, en casse normale (le style sombre les met en capitales)
  for (const id of places) {
    map.setPaintProperty(id, 'text-color', t.place.color);
    map.setPaintProperty(id, 'text-halo-color', t.place.halo);
    map.setPaintProperty(id, 'text-halo-width', 1.2);
    map.setLayoutProperty(id, 'text-transform', 'none');
  }

  // D12 relief ombré discret, sous les labels
  map.addSource('dem', {
    type: 'raster-dem',
    tiles: HILLSHADE.tiles,
    encoding: HILLSHADE.encoding,
    tileSize: HILLSHADE.tileSize,
    maxzoom: HILLSHADE.maxzoom,
  });
  map.addLayer({ id: 'hill', type: 'hillshade', source: 'dem', paint: t.hillshade }, firstSymbolId(map));

  // D14 localités hors de Suisse masquées, D17 trame sombre hors de Suisse
  loadOutlines()
    .then(([outline, precise]) => {
      if (!isCurrent() || map.getSource('ch-shade')) return;
      for (const id of places) {
        const f = map.getFilter(id);
        map.setFilter(id, f ? ['all', f, ['within', outline]] : ['within', outline]);
      }
      const holes = precise.type === 'Polygon' ? [precise.coordinates[0]] : precise.coordinates.map((p) => p[0]);
      map.addSource('ch-shade', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [[[-20, 30], [40, 30], [40, 65], [-20, 65], [-20, 30]], ...holes] },
        },
      });
      map.addLayer(
        { id: 'ch-shade', type: 'fill', source: 'ch-shade', paint: { 'fill-color': t.outside.color, 'fill-opacity': t.outside.opacity, 'fill-antialias': true } },
        firstSymbolId(map),
      );
    })
    .catch((err) => console.warn('Contour CH indisponible', err));
}
