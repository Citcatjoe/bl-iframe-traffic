// MapLibre GL, chargé à la demande (import dynamique) : rien n'est téléchargé tant que la carte n'approche pas de l'écran.

let enginePromise = null;

export function loadMapEngine() {
  enginePromise ??= Promise.all([import("maplibre-gl"), import("maplibre-gl/dist/maplibre-gl.css")]).then(([mod]) => mod.default ?? mod);
  return enginePromise;
}

/** Textes de l'interface de la carte, en français. */
export const MAP_LOCALE = {
  "CooperativeGesturesHandler.WindowsHelpText": "Utilise Ctrl + molette pour zoomer",
  "CooperativeGesturesHandler.MacHelpText": "Utilise ⌘ + molette pour zoomer",
  "CooperativeGesturesHandler.MobileHelpText": "Utilise deux doigts pour déplacer la carte",
};
