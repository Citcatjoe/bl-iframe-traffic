// Configuration centrale de la carte (MapLibre + OpenFreeMap, sans token).

const env = import.meta.env;

/** Relief ombré (AWS Terrarium, dataset public sans SLA) ; teintes par thème dans MAP_THEMES. */
export const HILLSHADE = {
  tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
  encoding: "terrarium",
  tileSize: 256,
  maxzoom: 12,
};

/**
 * Couleurs de la carte par thème (le moteur et le canvas des pastilles ne lisent pas les variables CSS).
 * Fond OpenFreeMap : Positron en clair, Dark en sombre, remplaçables via .env. Teintes reprises de base.css.
 */
export const MAP_THEMES = {
  light: {
    style: env.VITE_MAP_STYLE_LIGHT || "https://tiles.openfreemap.org/styles/positron",
    hillshade: {
      "hillshade-shadow-color": "#6A6262",
      "hillshade-highlight-color": "#FFFFFF",
      "hillshade-accent-color": "#A5A1A1",
      "hillshade-exaggeration": 0.3,
      "hillshade-illumination-direction": 315,
    },
    place: { color: "#A5A1A1", halo: "rgba(255,255,255,0.9)" }, // localités
    places: ["label_city_capital", "label_city", "label_town", "label_village", "label_other", "label_state"],
    hidden: [], // couches du style masquées
    outside: { color: "#121010", opacity: 0.13 }, // trame hors de Suisse
    casing: "#FFFFFF", // liseré des tracés, contour des postes de comptage
    counter: { color: "#504949", halo: "rgba(255,255,255,0.95)" }, // noms des postes de comptage
    pill: { bg: "#FFFFFF", hover: "#F0EFEF", text: "#121010", shadow: "rgba(18,16,16,0.2)" },
  },
  dark: {
    style: env.VITE_MAP_STYLE_DARK || "https://tiles.openfreemap.org/styles/dark",
    hillshade: {
      "hillshade-shadow-color": "#000000",
      "hillshade-highlight-color": "#504949",
      "hillshade-accent-color": "#1E1A1A",
      "hillshade-exaggeration": 0.4,
      "hillshade-illumination-direction": 315,
    },
    place: { color: "#837C7C", halo: "rgba(18,16,16,0.9)" },
    places: ["place_city_large", "place_city", "place_town", "place_village", "place_suburb", "place_other", "place_state"],
    // Noms et sens uniques des routes : absents de Positron aux zooms du widget, masqués pour un rendu identique.
    hidden: ["highway_name_motorway", "highway_name_other", "road_oneway", "road_oneway_opposite"],
    outside: { color: "#000000", opacity: 0.35 },
    casing: "#121010",
    counter: { color: "#C8C6C6", halo: "rgba(18,16,16,0.95)" },
    // Fond des pastilles : celui du panneau liste / fiche en sombre (fill-strong), pour se détacher de la carte.
    pill: { bg: "#3B3535", hover: "#504949", text: "#F5F5F5", shadow: "rgba(0,0,0,0.55)" },
  },
};

/** Contours CH (swisstopo swissBOUNDARIES3D simplifié, scripts/build-ch.mjs). Relatifs à la racine du build. */
export const CH_OUTLINE_URL = "data/ch.geojson"; // filtre `within` des localités
export const CH_PRECISE_URL = "data/ch-precise.geojson"; // trame extérieure
export const GEO_URL = "data/traffic-geo.json"; // tracés et compteurs (scripts/build-geo.mjs)

/** Emprise des points suivis (de Bardonnex au San Bernardino, d'Erstfeld au Grand-Saint-Bernard). */
const TRACKED_BOUNDS = [[6.05, 45.85], [9.25, 46.85]];
/** Emprise de la Suisse. */
const CH_BOUNDS = [[5.96, 45.82], [10.49, 47.81]];
export const MAX_BOUNDS = [[4.5, 45.2], [11.8, 48.4]];

/**
 * Vue d'ensemble par mode. 964 / 632 px : emprise des points, marges latérales larges (les étiquettes portent le nom,
 * centrées sur des points en bord d'emprise), marge haute pour le bouton « Liste ». Mobile : étiquettes réduites à la
 * pastille, la Suisse entière centrée.
 */
export const OVERVIEW = {
  wide: { bounds: TRACKED_BOUNDS, padding: { top: 56, bottom: 30, left: 90, right: 110 } },
  mid: { bounds: TRACKED_BOUNDS, padding: { top: 56, bottom: 24, left: 90, right: 110 } },
  mobile: { bounds: CH_BOUNDS, padding: { top: 12, bottom: 12, left: 12, right: 12 } },
};

/** Cadrage d'un point suivi (tracé + compteurs) ; en 964 et 632 px, le panneau de 300 px couvre la gauche. */
export const FOCUS_PADDING = {
  wide: { top: 70, bottom: 60, left: 336, right: 70 },
  mid: { top: 60, bottom: 40, left: 336, right: 60 },
  mobile: { top: 40, bottom: 30, left: 30, right: 56 },
};
export const FOCUS_MAX_ZOOM = 10.5;

/** Gestes coopératifs (Ctrl/⌘ + molette, 2 doigts) : la carte ne capture pas le scroll de l'article. */
export const COOPERATIVE_GESTURES = true;

export const FLY = { speed: 1.1, curve: 1.5 };

/** Révélation par zoom : les points suivis sont toujours visibles ; compteurs secondaires en zoomant. */
export const COUNTER_MIN_ZOOM = 8.5;
export const NARROW_ZOOM_OFFSET = 0.6; // 632 px et mobile
export const HYSTERESIS = 0.15;
