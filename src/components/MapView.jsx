import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  COOPERATIVE_GESTURES,
  OVERVIEW,
  FLY,
  FOCUS_MAX_ZOOM,
  FOCUS_PADDING,
  GEO_URL,
  MAP_THEMES,
  MAX_BOUNDS,
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

/**
 * Carte : tracés, pastilles, compteurs. Vole vers `sel` quand il change ; revient à la vue d'ensemble quand il redevient null.
 * Initialisée seulement quand elle approche de l'écran.
 */
export function MapView({ crossings, sel, hover, mode, width, theme, onHover, onSelect, listToggle }) {
  const containerRef = useRef(null);
  const instance = useRef(null); // { map, pills }
  const [generation, setGeneration] = useState(0); // incrémenté à chaque carte prête
  const [geo, setGeo] = useState(null);
  // `theme` : les couleurs `var(--…)` des pastilles sont résolues pour le thème courant.
  const items = useMemo(() => pillItems(geo, crossings), [geo, crossings, theme]);
  const live = useRef(null);
  useLayoutEffect(() => {
    live.current = { items, crossings, geo, sel, hover, mode, theme, onHover, onSelect };
  });

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
        bounds: OVERVIEW[live.current.mode].bounds,
        fitBoundsOptions: { padding: OVERVIEW[live.current.mode].padding },
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
        const { mode: m, sel: s, geo: g } = live.current;
        const focus = s && g ? map.cameraForBounds(crossingBounds(g, s), { padding: FOCUS_PADDING[m], maxZoom: FOCUS_MAX_ZOOM }) : null;
        if (focus) map.jumpTo(focus);
        else map.fitBounds(OVERVIEW[m].bounds, { padding: OVERVIEW[m].padding, duration: 0 });
        self.loaded = true;
        const { items: it, crossings: cr, hover: h, theme: t } = live.current;
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

    const ro = new ResizeObserver(() => instance.current?.map.resize());
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

  // Changement de thème (CHANGE_THEME de la page parente) : autre fond, nos couches sont rajoutées sur `style.load`.
  const lastTheme = useRef(theme);
  useEffect(() => {
    if (lastTheme.current === theme) return;
    lastTheme.current = theme;
    instance.current?.map.setStyle(MAP_THEMES[theme].style, { diff: false });
  }, [theme]);

  // Changement de largeur : recadrage sur la vue d'ensemble
  const lastWidth = useRef(width);
  useEffect(() => {
    if (lastWidth.current === width) return;
    lastWidth.current = width;
    const map = instance.current?.map;
    if (!map) return;
    requestAnimationFrame(() => {
      map.resize();
      map.fitBounds(OVERVIEW[mode].bounds, { padding: OVERVIEW[mode].padding, duration: 0 });
    });
  }, [width, mode]);

  // Vol vers la sélection, retour à la vue d'ensemble quand elle est levée
  const lastSel = useRef(sel);
  useEffect(() => {
    const prev = lastSel.current;
    lastSel.current = sel;
    if (prev === sel) return;
    const cur = instance.current;
    if (!cur?.loaded) return;
    const { mode: m, geo: g } = live.current;
    const bounds = sel ? crossingBounds(g, sel) : OVERVIEW[m].bounds;
    if (!bounds) return;
    const cam = sel
      ? cur.map.cameraForBounds(bounds, { padding: FOCUS_PADDING[m], maxZoom: FOCUS_MAX_ZOOM })
      : cur.map.cameraForBounds(bounds, { padding: OVERVIEW[m].padding });
    if (cam) cur.map.flyTo({ ...cam, ...FLY, essential: true });
  }, [sel]);

  const zoomBy = (fn) => instance.current && instance.current.map[fn]();
  const showAll = () => instance.current?.map.fitBounds(OVERVIEW[mode].bounds, { padding: OVERVIEW[mode].padding, duration: 600 });

  return (
    <div className={`relative order-1 min-w-0 ${mode === "mobile" ? "aspect-[4/3] w-full flex-none" : "min-h-0 flex-1"}`}>
      {/* Taille explicite : la CSS du moteur force `position: relative` sur le conteneur, un `absolute inset-0` s'effondrerait. */}
      <div ref={containerRef} className="size-full bg-map" />
      <div className="absolute top-2.5 right-2.5 z-[2] flex flex-col gap-1.5">
        {mode !== "mobile" && (
          <>
            <IconButton icon="fa-solid fa-plus" color="map" label="Zoom avant" onClick={() => zoomBy("zoomIn")} />
            <IconButton icon="fa-solid fa-minus" color="map" label="Zoom arrière" onClick={() => zoomBy("zoomOut")} />
          </>
        )}
        <IconButton icon="fa-solid fa-expand" color="map" label="Afficher tous les points" onClick={showAll} />
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
