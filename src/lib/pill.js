import { MAP_THEMES } from "../config/mapConfig";

// Rendu canvas des pastilles (repris du projet ski). Chaque variante est une image de style
// générée à la demande ; son id encode tout ce qu'il faut pour la dessiner, thème compris.

const FONT_NAME = "700 12.5px BlickVariable, InterVariable, sans-serif";
const FONT_GLYPH = '900 11.5px "Font Awesome 6 Free"';

/** Polices à charger avant le premier rendu, sinon les glyphes sont faux. */
export const PILL_FONTS = [FONT_NAME, FONT_GLYPH];

const PIXEL_RATIO = 2;
const MARGIN = 16; // marge du canvas pour l'ombre portée
const SEP = "§";
const GLYPH_W = 17;

let measureCtx = null;
function textWidth(text, font) {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  measureCtx.font = font;
  return measureCtx.measureText(String(text)).width;
}

/** Taille de la pastille, hors marge d'ombre : une ligne (pictogramme + nom), ou un rond (pictogramme seul, sans texte). */
export function pillSize(text) {
  if (!text) return { w: 22, h: 22 };
  return { w: 8 + GLYPH_W + textWidth(text, FONT_NAME) + 10, h: 24 };
}

/** @param {{ glyph: string, color: string, text: string, selected: boolean, hovered: boolean, theme: string }} p */
export function pillImageId(p) {
  return ["pill", p.glyph, p.color, p.text, p.selected ? 1 : 0, p.hovered ? 1 : 0, p.theme].join(SEP);
}

export const isPillImageId = (id) => id.startsWith(`pill${SEP}`);

/** Dessine la pastille encodée dans `id`. Retourne l'ImageData et son pixelRatio. */
export function drawPill(id) {
  const [, glyph, color, text, selS, hovS, theme] = id.split(SEP);
  const sel = selS === "1";
  const hov = hovS === "1";
  const t = (MAP_THEMES[theme] ?? MAP_THEMES.light).pill;
  const size = pillSize(text);
  const W = Math.ceil(size.w);
  const H = size.h;
  const R = H / 2;
  const k = PIXEL_RATIO;

  const canvas = document.createElement("canvas");
  canvas.width = (W + MARGIN * 2) * k;
  canvas.height = (H + MARGIN * 2) * k;
  const x = canvas.getContext("2d");
  x.scale(k, k);
  x.textBaseline = "middle";
  const X = MARGIN;
  const Y = MARGIN;

  // Fond + ombre de contact
  x.save();
  x.shadowColor = "rgba(18,16,16,0.12)";
  x.shadowBlur = 1.5;
  x.shadowOffsetY = 0.5;
  x.beginPath();
  x.roundRect(X, Y, W, H, R);
  x.fillStyle = sel ? "#E20000" : hov ? t.hover : t.bg;
  x.fill();
  x.restore();

  // Ombre portée diffuse, dessinée sous le fond
  x.save();
  x.globalCompositeOperation = "destination-over";
  x.shadowColor = t.shadow;
  x.shadowBlur = 20;
  x.shadowOffsetY = 4;
  x.beginPath();
  x.roundRect(X, Y, W, H, R);
  x.fillStyle = sel ? "#E20000" : t.bg;
  x.fill();
  x.restore();

  const cy = Y + H / 2 + 0.5;
  x.font = FONT_GLYPH;
  x.fillStyle = sel ? "#FFFFFF" : color;
  if (!text) {
    x.textAlign = "center";
    x.fillText(glyph, X + W / 2, cy);
  } else {
    x.fillText(glyph, X + 8, cy);
    x.font = FONT_NAME;
    x.fillStyle = sel ? "#FFFFFF" : t.text;
    x.fillText(text, X + 8 + GLYPH_W, cy);
  }

  return { data: x.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: k };
}
