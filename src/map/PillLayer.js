import { HYSTERESIS, NARROW_ZOOM_OFFSET, PILL_FADE_MS } from "../config/mapConfig";
import { drawPill, isPillImageId, PILL_FONTS, pillImageId, pillSize } from "../lib/pill";
import { placePills } from "../lib/placePills";

const SOURCE = "pills";
const LAYER = "pills";
const MOVE_THROTTLE_MS = 60;
// Délai avant de masquer une pastille évincée par la collision (déplacement de la carte : évite le clignotement).
// Une pastille retirée par le filtre s'efface tout de suite, en même temps que la pagination du filtre.
const HIDE_DELAY_MS = 220;
const COLLISION_PAD = 6;

const point = (lng, lat, properties) => ({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties });

/**
 * Couche des pastilles : placement JS (pas la collision native), fondus en rAF.
 * Item = { id, target, level, minZoom, lng, lat, text, glyph, color } : une ligne, pictogramme coloré + nom ; en
 * mobile, pictogramme seul (la carte montre la Suisse entière, les noms la masqueraient).
 * level 1 = toujours posé (points suivis), sinon posé s'il ne chevauche rien. `target` = point sélectionné au clic.
 */
export class PillLayer {
  constructor(map) {
    this.map = map;
    this.state = { items: [], sel: null, hover: null, mode: "wide", theme: "light" };
    this.anim = new Map(); // id → { ll, props, o, target, gone }
    this.ready = false;
    this.destroyed = false;
    this.firstPlaced = false;
    this.raf = null;
    this.moveTimer = null;
    this.lastInputs = null;

    this.onImageMissing = (e) => {
      if (!isPillImageId(e.id) || map.hasImage(e.id)) return;
      const { data, pixelRatio } = drawPill(e.id);
      map.addImage(e.id, data, { pixelRatio });
    };
    this.onMove = () => {
      if (this.moveTimer) return;
      this.moveTimer = setTimeout(() => {
        this.moveTimer = null;
        this.place();
      }, MOVE_THROTTLE_MS);
    };
    this.onMoveEnd = () => this.place();
    map.on("styleimagemissing", this.onImageMissing);
  }

  /** Attend les polices (sinon glyphes faux), puis crée la source et la couche. */
  async init() {
    try {
      await Promise.all(PILL_FONTS.map((f) => document.fonts.load(f)));
    } catch {
      // police indisponible : on dessine quand même avec le repli
    }
    if (this.destroyed) return;
    this.map.on("move", this.onMove);
    this.map.on("moveend", this.onMoveEnd);
    this.ready = true;
    this.attach();
  }

  /** Source et couche des pastilles ; à rappeler après un changement de style (thème), qui les retire. */
  attach() {
    if (!this.ready || this.destroyed || this.map.getSource(SOURCE)) return;
    this.map.addSource(SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    this.map.addLayer({
      id: LAYER,
      type: "symbol",
      source: SOURCE,
      layout: {
        "icon-image": ["get", "img"],
        "icon-size": ["get", "s"],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "symbol-sort-key": ["get", "z"],
      },
      paint: { "icon-opacity": ["get", "o"] },
    });
    this.place();
  }

  update(next) {
    const s = { ...this.state, ...next };
    this.state = s;
    const inputs = [s.items, s.sel, s.hover, s.mode, s.theme];
    if (this.lastInputs && inputs.every((v, i) => v === this.lastInputs[i])) return;
    this.lastInputs = inputs;
    this.place();
  }

  /** Point suivi sous le curseur (px), la pastille la plus haute l'emporte. */
  pick(pt, tolerance) {
    if (!this.ready || !this.map.getLayer(LAYER)) return null;
    const features = this.map.queryRenderedFeatures(
      [
        [pt.x - tolerance, pt.y - tolerance],
        [pt.x + tolerance, pt.y + tolerance],
      ],
      { layers: [LAYER] },
    );
    const hit = features.filter((f) => f.properties.o > 0.5).sort((a, b) => (b.properties.z || 0) - (a.properties.z || 0))[0];
    return hit?.properties.target || null;
  }

  place() {
    if (!this.ready || this.destroyed) return;
    const map = this.map;
    const { items, sel, hover, mode, theme } = this.state;
    const z = map.getZoom();
    const offset = mode === "wide" ? 0 : NARROW_ZOOM_OFFSET;
    const container = map.getContainer();
    const wasVisible = (id) => this.anim.get(id)?.target === 1;

    const candidates = [];
    for (const it of items) {
      if (it.level !== 1 && z < it.minZoom + offset - (wasVisible(it.id) ? HYSTERESIS : 0)) continue;
      const text = mode === "mobile" ? "" : it.text;
      const size = pillSize(text);
      const p = map.project([it.lng, it.lat]);
      candidates.push({
        id: it.id,
        level: it.level,
        x: p.x,
        y: p.y,
        w: size.w + COLLISION_PAD,
        h: size.h + COLLISION_PAD,
        target: it.target,
        draw: { glyph: it.glyph, color: it.color, text },
      });
    }

    const placed = placePills(candidates, { sel, wasVisible, width: container.clientWidth, height: container.clientHeight });

    const now = performance.now();
    const seen = new Set();
    for (const it of placed) {
      const ll = map.unproject([it.x, it.y]);
      const selected = it.level === 1 && it.target === sel;
      const hovered = it.target === hover;
      const props = {
        id: it.id,
        target: it.target,
        z: selected ? 4 : hovered ? 3 : it.level === 1 ? 2 : 1,
        img: pillImageId({ ...it.draw, selected, hovered, theme }),
      };
      const e = this.anim.get(it.id);
      if (e) Object.assign(e, { ll: [ll.lng, ll.lat], props, target: 1, gone: null });
      else this.anim.set(it.id, { ll: [ll.lng, ll.lat], props, o: this.firstPlaced ? 0 : 1, target: 1, gone: null });
      seen.add(it.id);
    }
    this.firstPlaced = placed.length > 0;
    const itemIds = new Set(items.map((it) => it.id));
    this.anim.forEach((e, id) => {
      if (!seen.has(id) && e.gone == null) e.gone = itemIds.has(id) ? now : now - HIDE_DELAY_MS;
    });
    this.startAnim();
  }

  startAnim() {
    if (this.raf) return;
    let last = performance.now();
    const step = (t) => {
      this.raf = null;
      if (!this.ready || this.destroyed) return;
      const dt = Math.min(64, t - last);
      last = t;
      let busy = false;
      this.anim.forEach((e, id) => {
        if (e.gone != null) {
          if (t - e.gone > HIDE_DELAY_MS) e.target = 0;
          else busy = true;
        }
        if (e.o !== e.target) {
          const d = dt / PILL_FADE_MS;
          e.o = e.target > e.o ? Math.min(1, e.o + d) : Math.max(0, e.o - d);
          busy = true;
        }
        if (e.target === 0 && e.o === 0) this.anim.delete(id);
      });
      const features = [];
      this.anim.forEach((e) => {
        const k = 1 - (1 - e.o) ** 3;
        features.push(point(e.ll[0], e.ll[1], { ...e.props, o: k, s: 0.85 + 0.15 * k }));
      });
      this.map.getSource(SOURCE)?.setData({ type: "FeatureCollection", features });
      if (busy) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  destroy() {
    this.destroyed = true;
    this.ready = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    clearTimeout(this.moveTimer);
  }
}
