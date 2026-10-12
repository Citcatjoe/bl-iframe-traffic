// Rendu canvas des pastilles (repris du projet ski). Chaque variante est une image de style
// générée à la demande ; son id encode tout ce qu'il faut pour la dessiner.

const FONT_NAME = "700 12.5px BlickVariable, InterVariable, sans-serif";
const FONT_TEXT = "700 11.5px InterVariable, sans-serif";
const FONT_GLYPH = '900 11.5px "Font Awesome 6 Free"';

/** Polices à charger avant le premier rendu, sinon les glyphes sont faux. */
export const PILL_FONTS = [FONT_NAME, FONT_TEXT, FONT_GLYPH];

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

/**
 * Taille de la pastille, hors marge d'ombre.
 * Avec `name` : deux lignes (nom, puis pictogramme + texte). Sans : une ligne compacte.
 */
export function pillSize(text, name) {
  if (!name) return { w: 8 + GLYPH_W + textWidth(text, FONT_TEXT) + 10, h: 24 };
  return { w: Math.max(textWidth(name, FONT_NAME), GLYPH_W + textWidth(text, FONT_TEXT)) + 28, h: 38 };
}

/** @param {{ glyph: string, color: string, text: string, name: string, selected: boolean, hovered: boolean }} p */
export function pillImageId(p) {
  return ["pill", p.glyph, p.color, p.text, p.selected ? 1 : 0, p.hovered ? 1 : 0, p.name].join(SEP);
}

export const isPillImageId = (id) => id.startsWith(`pill${SEP}`);

/** Dessine la pastille encodée dans `id`. Retourne l'ImageData et son pixelRatio. */
export function drawPill(id) {
  const [, glyph, color, text, selS, hovS, name] = id.split(SEP);
  const sel = selS === "1";
  const hov = hovS === "1";
  const size = pillSize(text, name);
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
  x.fillStyle = sel ? "#E20000" : hov ? "#F0EFEF" : "#FFFFFF";
  x.fill();
  x.restore();

  // Ombre portée diffuse, dessinée sous le fond
  x.save();
  x.globalCompositeOperation = "destination-over";
  x.shadowColor = "rgba(18,16,16,0.2)";
  x.shadowBlur = 20;
  x.shadowOffsetY = 4;
  x.beginPath();
  x.roundRect(X, Y, W, H, R);
  x.fillStyle = sel ? "#E20000" : "#FFFFFF";
  x.fill();
  x.restore();

  let cx = X + (name ? 14 : 8);
  let cy = Y + H / 2 + 0.5;
  if (name) {
    x.font = FONT_NAME;
    x.fillStyle = sel ? "#FFFFFF" : "#121010";
    x.fillText(name, cx, Y + 12.5);
    cy = Y + 27;
  }
  x.font = FONT_GLYPH;
  x.fillStyle = sel ? "#FFFFFF" : color;
  x.fillText(glyph, cx, cy);
  cx += GLYPH_W;
  x.font = FONT_TEXT;
  x.fillStyle = sel ? "#FFFFFF" : "#504949";
  x.fillText(text, cx, cy);

  return { data: x.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: k };
}
