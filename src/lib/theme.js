import { useEffect, useState } from "react";

// Thème clair / sombre Blick : entièrement géré par iframeHeightAdjustment.js (repris de bl-iframe-map-solene-asie).
// Le script lit #theme=dark|light dans l'URL posée par le CMS, pose la paire --is-light-theme / --is-dark-theme dont
// base.css dérive chaque couleur sémantique, et suit les changements de thème de la page parente (CHANGE_THEME).
// L'interface suit donc seule via les variables CSS ; ce hook ne sert qu'à la carte (fond, tracés, pastilles canvas),
// que le moteur dessine sans lire var().

const hashTheme = () => (new URLSearchParams(window.location.hash.slice(1)).get("theme") === "dark" ? "dark" : "light");

const currentTheme = () => (window.blickIframeUtils?.currentTheme === "dark" ? "dark" : window.blickIframeUtils ? "light" : hashTheme());

const CALLBACK_ID = "bl-iframe-traffic";

/** Thème courant (« light » | « dark »), tenu à jour par iframeHeightAdjustment.js. */
export function useTheme() {
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    let utils = null;
    const register = () => {
      utils = window.blickIframeUtils;
      if (!utils?.registerThemeChangeCallback) return false;
      utils.registerThemeChangeCallback(CALLBACK_ID, (t) => setTheme(t === "dark" ? "dark" : "light"));
      setTheme(currentTheme());
      return true;
    };
    // Le script est chargé après le bundle (et en repli local si le CDN échoue) : on attend `load`.
    const onLoad = () => register();
    if (!register()) window.addEventListener("load", onLoad, { once: true });
    return () => {
      window.removeEventListener("load", onLoad);
      utils?.deregisterThemeChangeCallback?.(CALLBACK_ID);
    };
  }, []);

  return theme;
}

/** Valeur résolue d'une variable CSS de base.css (le moteur de carte et le canvas ne lisent pas var()). */
export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Couleur utilisable par la carte ou un canvas : un jeton `var(--…)` est résolu, une couleur littérale passe telle quelle. */
export function resolveColor(v) {
  const m = /^var\((--[\w-]+)\)$/.exec(v);
  return m ? cssVar(m[1]) : v;
}
