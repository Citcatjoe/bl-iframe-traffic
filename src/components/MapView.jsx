import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  CH_BOUNDS,
  COOPERATIVE_GESTURES,
  FIT_PADDING,
  FLY,
  FOCUS_MAX_ZOOM,
  FOCUS_PADDING,
  GEO_URL,
  MAP_ATTRIBUTION,
  MAP_STYLE_URL,
  MAX_BOUNDS,
  PASS_MIN_ZOOM,
} from "../config/mapConfig";
import { LEVELS } from "../format.js";
import { pillText, shortName, styleOf } from "../lib/levels";
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

/** Pastilles : une par traversée (sur son compteur principal) + le col du Gothard (compteur du col). */
function pillItems(geo, crossings) {
  if (!geo) return [];
  const counters = geo.features.filter((f) => f.properties.kind === "counter");
  const items = [];
  for (const c of crossings) {
    const anchor = counters.find((f) => f.properties.crossing === c.id && f.properties.main);
    if (anchor) {
      const st = styleOf(c.level);
      const [lng, lat] = anchor.geometry.coordinates;
      const name = shortName(c);
      items.push({
        id: c.id,
        target: c.id,
        level: 1,
        lng,
        lat,
        name,
        text: pillText(c),
        compact: c.level === "clear" ? name : `${name} · ${pillText(c)}`,
        glyph: st.glyph,
        color: st.color,
      });
    }
    const passAnchor = c.pass && counters.find((f) => f.properties.crossing === c.id && f.properties.segment === "pass");
    if (passAnchor) {
      const st = styleOf(c.pass.closed ? "closed" : "clear");
      const [lng, lat] = passAnchor.geometry.coordinates;
      const text = c.pass.closed ? LEVELS.closed.label : "Pas de fermeture";
      items.push({ id: `${c.id}:pass`, target: c.id, level: 2, minZoom: PASS_MIN_ZOOM, lng, lat, name: "Col du Gothard", text, compact: text, glyph: st.glyph, color: st.color });
    }
  }
  return items;
}

/**
 * Carte : tracés, pastilles, compteurs. Vole vers `sel` quand il change ; revient à la vue Suisse quand il redevient null.
 * Initialisée seulement quand elle approche de l'écran.
 */
export function MapView({ crossings, sel, hover, mode, width, onHover, onSelect, listToggle }) {
  const containerRef = useRef(null);
  const instance = useRef(null); // { map, pills }
  const [generation, setGeneration] = useState(0); // incrémenté à chaque carte prête
  const [geo, setGeo] = useState(null);
  const items = useMemo(() => pillItems(geo, crossings), [geo, crossings]);
  const live = useRef(null);
  useLayoutEffect(() => {
    live.current = { items, crossings, geo, sel, hover, mode, onHover, onSelect };
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
        style: MAP_STYLE_URL,
        bounds: CH_BOUNDS,
        fitBoundsOptions: { padding: FIT_PADDING[live.current.mode] },
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
      const self = { map, pills, loaded: false };
      instance.current = self;
      const isCurrent = () => !cancelled && instance.current === self;

      // Perte du contexte WebGL : on recrée la carte
      map.on("webglcontextlost", () => {
        destroy();
        retryTimer = setTimeout(() => !cancelled && create(), 300);
      });

      map.on("load", () => {
        if (!isCurrent()) return;
        map.resize();
        const { mode: m, sel: s, geo: g } = live.current;
        const focus = s && g ? map.cameraForBounds(crossingBounds(g, s), { padding: FOCUS_PADDING[m], maxZoom: FOCUS_MAX_ZOOM }) : null;
        if (focus) map.jumpTo(focus);
        else map.fitBounds(CH_BOUNDS, { padding: FIT_PADDING[m], duration: 0 });
        try {
          customizeBasemap(map, isCurrent);
        } catch (err) {
          console.warn("Fond de carte : ajustements partiels", err);
        }
        addCorridorLayers(map);
        self.loaded = true;
        const { items: it, crossings: cr, hover: h } = live.current;
        setCorridorData(map, g, cr, s, h);
        pills.update({ items: it, sel: s, hover: h, mode: m });
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
    cur.pills.update({ items, sel, hover, mode });
    setCorridorData(cur.map, geo, crossings, sel, hover);
  }, [items, crossings, geo, sel, hover, mode, generation]);

  // Changement de largeur : recadrage sur la Suisse
  const lastWidth = useRef(width);
  useEffect(() => {
    if (lastWidth.current === width) return;
    lastWidth.current = width;
    const map = instance.current?.map;
    if (!map) return;
    requestAnimationFrame(() => {
      map.resize();
      map.fitBounds(CH_BOUNDS, { padding: FIT_PADDING[mode], duration: 0 });
    });
  }, [width, mode]);

  // Vol vers la sélection, retour à la Suisse quand elle est levée
  const lastSel = useRef(sel);
  useEffect(() => {
    const prev = lastSel.current;
    lastSel.current = sel;
    if (prev === sel) return;
    const cur = instance.current;
    if (!cur?.loaded) return;
    const { mode: m, geo: g } = live.current;
    const bounds = sel ? crossingBounds(g, sel) : CH_BOUNDS;
    if (!bounds) return;
    const cam = sel
      ? cur.map.cameraForBounds(bounds, { padding: FOCUS_PADDING[m], maxZoom: FOCUS_MAX_ZOOM })
      : cur.map.cameraForBounds(CH_BOUNDS, { padding: FIT_PADDING[m] });
    if (cam) cur.map.flyTo({ ...cam, ...FLY, essential: true });
  }, [sel]);

  const zoomBy = (fn) => instance.current && instance.current.map[fn]();
  const showAll = () => instance.current?.map.fitBounds(CH_BOUNDS, { padding: FIT_PADDING[mode], duration: 600 });

  return (
    <div className="relative order-1 min-h-0 min-w-0 flex-1">
      {/* Taille explicite : la CSS du moteur force `position: relative` sur le conteneur, un `absolute inset-0` s'effondrerait. */}
      <div ref={containerRef} className="size-full bg-map" />
      <div className="absolute top-2.5 right-2.5 z-[2] flex flex-col gap-1.5">
        {mode !== "mobile" && (
          <>
            <IconButton icon="fa-solid fa-plus" color="white" label="Zoom avant" onClick={() => zoomBy("zoomIn")} />
            <IconButton icon="fa-solid fa-minus" color="white" label="Zoom arrière" onClick={() => zoomBy("zoomOut")} />
          </>
        )}
        <IconButton icon="fa-solid fa-expand" color="white" label="Afficher toute la Suisse" onClick={showAll} />
      </div>
      {listToggle && (
        <div className="absolute top-3 left-3 z-[2]">
          <Button color="black" iconLeft="fa-solid fa-list" onClick={listToggle.onClick}>
            {listToggle.label}
          </Button>
        </div>
      )}
      {mode !== "wide" && (
        <div className="pointer-events-none absolute right-0 bottom-0 z-[2] max-w-full truncate rounded-tl-md bg-[rgba(255,255,255,0.8)] px-1.5 py-px text-[9.5px] leading-[1.4] text-[#504949]">
          {MAP_ATTRIBUTION.replace(/^Carte /, "")}
        </div>
      )}
    </div>
  );
}
