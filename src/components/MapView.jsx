import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  COOPERATIVE_GESTURES,
  FOCUS_MAX_ZOOM,
  FRAME,
  FRAME_MS,
  GEO_URL,
  MAP_THEMES,
  MAX_BOUNDS,
  TRACKED_BOUNDS,
} from "../config/mapConfig";
import { shortName } from "../lib/levels";
import { STATUS, rowOf } from "../lib/status.js";
import { resolveColor } from "../lib/theme.js";
import { customizeBasemap } from "../map/basemap";
import { addCorridorLayers, crossingBounds, pickCorridor, setCorridorData } from "../map/corridors";
import { loadMapEngine, MAP_LOCALE } from "../map/engine";
import { PillLayer } from "../map/PillLayer";
import { Button } from "./ui/Button";
import { IconButton } from "./ui/IconButton";

let geoPromise = null;
const loadGeo = () =>
  (geoPromise ??= fetch(GEO_URL).then((r) => {
    if (!r.ok) throw new Error(`${GEO_URL} ${r.status}`);
    return r.json();
  }));

const DOT = "\uf111"; // fa-circle : même pastille que les listes
const BARRIER = "\ue562"; // fa-road-barrier : col fermé, comme dans les listes

/**
 * Pastilles : une par point suivi, à sa position (`kind: "point"` de traffic-geo.json). Une ligne : la pastille de
 * couleur des listes (barrière pour un col fermé) et le nom court ; le statut et le détail sont dans la liste.
 */
function pillItems(geo, crossings) {
  if (!geo) return [];
  const anchors = new Map(geo.features.filter((f) => f.properties.kind === "point").map((f) => [f.properties.crossing, f.geometry.coordinates]));
  return crossings.flatMap((c) => {
    const at = anchors.get(c.id);
    if (!at) return [];
    const r = rowOf(c);
    return [{
      id: c.id,
      target: c.id,
      level: 1,
      lng: at[0],
      lat: at[1],
      text: shortName(c),
      glyph: r.closedPass ? BARRIER : DOT,
      color: resolveColor(STATUS[r.level].color),
    }];
  });
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Emprise de la vue : tracé du point choisi, sinon vue d'ensemble de tous les points suivis (jamais selon le filtre). */
function viewBounds(geo, sel) {
  if (sel) return crossingBounds(geo, sel);
  const ids = new Set((geo?.features ?? []).map((f) => f.properties.crossing).filter(Boolean));
  let w = 180, s = 90, e = -180, n = -90;
  for (const id of ids) {
    const b = crossingBounds(geo, id);
    if (!b) continue;
    w = Math.min(w, b[0][0]);
    s = Math.min(s, b[0][1]);
    e = Math.max(e, b[1][0]);
    n = Math.max(n, b[1][1]);
  }
  return w <= e ? [[w, s], [e, n]] : TRACKED_BOUNDS;
}

/**
 * Marges de cadrage : le sujet tient dans la zone laissée libre par le panneau. Mobile : en bas, hauteur du panneau
 * dans la vue d'arrivée + 16 px (sans écraser la carte sous un minimum de hauteur utile) ; vue d'ensemble : la
 * moitié d'une pastille en plus de chaque côté. Desktop : à gauche, largeur du panneau ouvert ; vue d'ensemble :
 * marges latérales des étiquettes (noms centrés sur les points en bord d'emprise), et en haut la place du bouton
 * « Liste » quand le panneau est replié. 24 px ailleurs. Comme en mobile, la carte garde une largeur utile minimale :
 * en 632 px, panneau ouvert, la marge gauche est réduite (des points passent sous le panneau plutôt qu'un zoom
 * minuscule).
 */
function viewPadding({ mode, sel, panelOpen, inset, mapWidth, mapHeight }) {
  const p = FRAME.edge;
  if (mode === "mobile") {
    const q = sel ? p : p + FRAME.pill;
    const bottom = Math.min(inset + FRAME.sheetGap + (q - p), Math.max(q, mapHeight - q - FRAME.minUsable));
    return { top: q, right: q, bottom, left: q };
  }
  const side = sel ? { left: p, right: p } : FRAME.labels;
  // Panneau ouvert : sa largeur, plus la marge des étiquettes au-delà des 24 px de base.
  const left = panelOpen ? FRAME.panel + side.left - p : side.left;
  return {
    top: panelOpen ? p : FRAME.listButton,
    right: side.right,
    bottom: p,
    left: Math.max(side.left, Math.min(left, mapWidth - side.right - FRAME.minWidth)),
  };
}

/**
 * Carte : tracés, pastilles, compteurs. Ne bouge que sur un événement : chargement (vue d'ensemble), point choisi
 * (son tracé), fiche fermée (vue d'ensemble), bouton maison (`homeKey`, vue d'ensemble), redimensionnement (vue
 * en cours, sans animation). Ni le filtre, ni l'ouverture de la liste, ni l'historique, ni un rafraîchissement des
 * données ne la déplacent. `crossings` : points retenus par le filtre (pastilles et tracés affichés). `panelOpen` :
 * panneau latéral ouvert (desktop) ; `insetRef` : hauteur du panneau bas dans la vue d'arrivée (mobile).
 * `hideControls` : liste mobile ouverte, boutons masqués. `onHome` : bouton maison (App ferme le panneau, remet
 * « Tous les points » et incrémente `homeKey`). Initialisée seulement quand elle approche de l'écran.
 */
export function MapView({ crossings, sel, hover, mode, theme, panelOpen, insetRef, homeKey, hideControls = false, onHover, onSelect, onHome, listToggle }) {
  const containerRef = useRef(null);
  const instance = useRef(null); // { map, pills }
  const [generation, setGeneration] = useState(0); // incrémenté à chaque carte prête
  const [geo, setGeo] = useState(null);
  // `theme` : les couleurs `var(--…)` des pastilles sont résolues pour le thème courant.
  const items = useMemo(() => pillItems(geo, crossings), [geo, crossings, theme]);
  const live = useRef(null);
  useLayoutEffect(() => {
    live.current = { items, crossings, geo, sel, hover, mode, theme, panelOpen, onHover, onSelect };
  });

  /** Cadre la vue en cours : tracé du point choisi, sinon vue d'ensemble. Interrompt le mouvement en cours. */
  const frame = (duration) => {
    const cur = instance.current;
    if (!cur?.loaded) return;
    const { geo: g, sel: subject, mode: m, panelOpen: open } = live.current;
    const bounds = viewBounds(g, subject);
    if (!bounds) return;
    const box = cur.map.getContainer();
    const padding = viewPadding({ mode: m, sel: subject, panelOpen: open, inset: insetRef?.current ?? 0, mapWidth: box.clientWidth, mapHeight: box.clientHeight });
    cur.map.fitBounds(bounds, { padding, maxZoom: FOCUS_MAX_ZOOM, duration: reducedMotion() ? 0 : duration });
  };
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    let alive = true;
    loadGeo().then(
      (g) => alive && setGeo(g),
      (err) => console.warn("Tracés indisponibles", err),
    );
    return () => {
      alive = false;
    };
  }, []);

  // Création / destruction de la carte
  useEffect(() => {
    const el = containerRef.current;
    let cancelled = false;
    let started = false;
    let retryTimer = null;

    const destroy = () => {
      const cur = instance.current;
      if (!cur) return;
      instance.current = null;
      cur.pills.destroy();
      try {
        cur.map.remove();
      } catch {
        // contexte déjà perdu
      }
    };

    const create = async () => {
      const gl = await loadMapEngine();
      if (cancelled) return;
      const map = new gl.Map({
        container: el,
        style: MAP_THEMES[live.current.theme].style,
        bounds: TRACKED_BOUNDS,
        maxBounds: MAX_BOUNDS,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        cooperativeGestures: COOPERATIVE_GESTURES,
        locale: MAP_LOCALE,
      });
      map.touchZoomRotate.disableRotation();
      const pills = new PillLayer(map);
      const self = { map, pills, loaded: false, styleToken: 0 };
      instance.current = self;
      const isCurrent = () => !cancelled && instance.current === self;

      // Perte du contexte WebGL : on recrée la carte
      map.on("webglcontextlost", () => {
        destroy();
        retryTimer = setTimeout(() => !cancelled && create(), 300);
      });

      // Chaque style chargé (au départ, puis à chaque changement de thème, qui remplace le style et retire nos
      // couches) : ajustements du fond, tracés, pastilles, aux couleurs du thème.
      map.on("style.load", () => {
        if (!isCurrent()) return;
        const token = ++self.styleToken;
        const t = live.current.theme;
        try {
          customizeBasemap(map, t, () => isCurrent() && self.styleToken === token);
        } catch (err) {
          console.warn("Fond de carte : ajustements partiels", err);
        }
        addCorridorLayers(map, t);
        if (!self.loaded) return;
        const { geo: g, crossings: cr, sel: s, hover: h } = live.current;
        setCorridorData(map, g, cr, s, h);
        pills.attach();
      });

      map.on("load", () => {
        if (!isCurrent()) return;
        map.resize();
        self.loaded = true;
        frameRef.current(0);
        const { items: it, crossings: cr, hover: h, theme: t, mode: m, sel: s, geo: g } = live.current;
        setCorridorData(map, g, cr, s, h);
        pills.update({ items: it, sel: s, hover: h, mode: m, theme: t });
        pills.init().then(() => isCurrent() && setGeneration((n) => n + 1));
        setGeneration((n) => n + 1);
      });

      const pick = (pt, tol) => pills.pick(pt, tol) ?? pickCorridor(map, pt, tol + 2);
      map.on("mousemove", (e) => {
        const id = pick(e.point, 2);
        map.getCanvas().style.cursor = id ? "pointer" : "";
        if (id !== live.current.hover) live.current.onHover(id);
      });
      map.on("mouseout", () => {
        if (live.current.hover) live.current.onHover(null);
      });
      map.on("click", (e) => {
        const id = pick(e.point, live.current.mode === "mobile" ? 8 : 3);
        if (id) live.current.onSelect(id);
      });
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (started || !entry.isIntersecting || !el.clientWidth || !el.clientHeight) return;
        started = true;
        io.disconnect();
        create();
      },
      { rootMargin: "200px" },
    );
    io.observe(el);

    // Redimensionnement (largeur, rotation) : recadre la vue en cours, sans animation.
    const ro = new ResizeObserver(() => {
      const map = instance.current?.map;
      if (!map) return;
      map.resize();
      frameRef.current(0);
    });
    ro.observe(el);

    return () => {
      cancelled = true;
      io.disconnect();
      ro.disconnect();
      clearTimeout(retryTimer);
      destroy();
    };
  }, []);

  // Entrées des pastilles et des tracés
  useEffect(() => {
    const cur = instance.current;
    if (!cur?.loaded) return;
    cur.pills.update({ items, sel, hover, mode, theme });
    setCorridorData(cur.map, geo, crossings, sel, hover);
  }, [items, crossings, geo, sel, hover, mode, theme, generation]);

  // Tracés arrivés après la carte : cadrage du chargement, maintenant que les emprises sont connues.
  useEffect(() => {
    if (geo) frameRef.current(0);
  }, [geo]);

  // Changement de thème (CHANGE_THEME de la page parente) : autre fond, nos couches sont rajoutées sur `style.load`.
  const lastTheme = useRef(theme);
  useEffect(() => {
    if (lastTheme.current === theme) return;
    lastTheme.current = theme;
    instance.current?.map.setStyle(MAP_THEMES[theme].style, { diff: false });
  }, [theme]);

  // Point choisi (ou autre point, fiche ouverte) : son tracé ; fiche fermée : vue d'ensemble.
  const lastSel = useRef(sel);
  useEffect(() => {
    if (lastSel.current === sel) return;
    lastSel.current = sel;
    frameRef.current(FRAME_MS);
  }, [sel]);

  // Bouton maison : vue d'ensemble, une fois le panneau fermé (marges lues après le rendu).
  const lastHome = useRef(homeKey);
  useEffect(() => {
    if (lastHome.current === homeKey) return;
    lastHome.current = homeKey;
    frameRef.current(FRAME_MS);
  }, [homeKey]);

  const zoomBy = (fn) => instance.current && instance.current.map[fn]();

  return (
    <div className={`relative min-w-0 ${mode === "mobile" ? "size-full" : "order-1 min-h-0 flex-1"}`}>
      {/* Taille explicite : la CSS du moteur force `position: relative` sur le conteneur, un `absolute inset-0` s'effondrerait. */}
      <div ref={containerRef} className="size-full bg-map" />
      <div className={`absolute top-2.5 right-2.5 z-[2] flex flex-col gap-1.5 ${hideControls ? "hidden" : ""}`}>
        {mode !== "mobile" && (
          <>
            <IconButton icon="fa-solid fa-plus" color="map" label="Zoom avant" onClick={() => zoomBy("zoomIn")} />
            <IconButton icon="fa-solid fa-minus" color="map" label="Zoom arrière" onClick={() => zoomBy("zoomOut")} />
          </>
        )}
        <IconButton icon="fa-solid fa-house text-[13px] opacity-75" color="map" label="Revenir à la vue d'ensemble" onClick={onHome} />
      </div>
      {listToggle && (
        <div className="absolute top-3 left-3 z-[2]">
          <Button color="black" iconLeft="fa-solid fa-list" onClick={listToggle.onClick}>
            {listToggle.label}
          </Button>
        </div>
      )}
    </div>
  );
}
