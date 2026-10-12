// Configuration centrale de la carte (MapLibre + OpenFreeMap, sans token).

export const MAP_STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";

/** OpenFreeMap exige « OpenFreeMap © OpenMapTiles © OpenStreetMap » ; le relief (tuiles Terrarium) exige Mapzen. */
export const MAP_ATTRIBUTION = "Carte OpenFreeMap © OpenMapTiles © OpenStreetMap · Relief Mapzen";

/** Relief ombré (AWS Terrarium, dataset public sans SLA). */
export const HILLSHADE = {
  tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
  encoding: "terrarium",
  tileSize: 256,
  maxzoom: 12,
  paint: {
    "hillshade-shadow-color": "#6A6262",
    "hillshade-highlight-color": "#FFFFFF",
    "hillshade-accent-color": "#A5A1A1",
    "hillshade-exaggeration": 0.3,
    "hillshade-illumination-direction": 315,
  },
};

/** Contours CH (non officiels). Relatifs à la racine du build. */
export const CH_OUTLINE_URL = "data/ch.geojson"; // filtre `within` des localités
export const CH_PRECISE_URL = "data/ch-precise.geojson"; // trame extérieure
export const GEO_URL = "data/traffic-geo.json"; // tracés et compteurs (scripts/build-geo.mjs)

export const CH_BOUNDS = [[5.95, 45.82], [10.49, 47.81]];
export const MAX_BOUNDS = [[4.5, 45.2], [11.8, 48.4]];

/** Couches de localités du style Positron (ignorées si absentes du style). */
export const PLACE_LAYERS = ["label_city_capital", "label_city", "label_town", "label_village", "label_other", "label_state"];

export const FIT_PADDING = {
  wide: { top: 40, bottom: 30, left: 30, right: 60 },
  mid: { top: 56, bottom: 24, left: 24, right: 56 },
  mobile: { top: 24, bottom: 16, left: 16, right: 50 },
};

/** Cadrage d'une traversée (tracé + compteurs) ; en 632 px, le panneau de 300 px couvre la gauche. */
export const FOCUS_PADDING = {
  wide: { top: 70, bottom: 60, left: 60, right: 70 },
  mid: { top: 60, bottom: 40, left: 336, right: 60 },
  mobile: { top: 40, bottom: 30, left: 30, right: 56 },
};
export const FOCUS_MAX_ZOOM = 10.5;

/** Gestes coopératifs (Ctrl/⌘ + molette, 2 doigts) : la carte ne capture pas le scroll de l'article. */
export const COOPERATIVE_GESTURES = true;

export const FLY = { speed: 1.1, curve: 1.5 };

/** Révélation par zoom : les traversées sont toujours visibles ; col et compteurs en zoomant. */
export const PASS_MIN_ZOOM = 8.3;
export const COUNTER_MIN_ZOOM = 8.5;
export const NARROW_ZOOM_OFFSET = 0.6; // 632 px et mobile
export const HYSTERESIS = 0.15;
/** En dessous de ce zoom, hors 964 px : pastille compacte sur une ligne. */
export const NAME_MIN_ZOOM = 7.4;
