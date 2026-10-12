// Palette et pictogrammes des niveaux : source unique pour la carte, le panneau et le graphique.
import { km, mainCounter } from "../format.js";

/** color = trait de la carte et pastilles ; ink = texte sur fond `color` ; glyph = Font Awesome solid. */
export const LEVEL_STYLE = {
  closed: { color: "#A70000", ink: "#FFFFFF", icon: "fa-road-barrier", glyph: "\ue562" },
  jam: { color: "#E20000", ink: "#FFFFFF", icon: "fa-car-rear", glyph: "\uf5de" },
  slow: { color: "#F07800", ink: "#121010", icon: "fa-gauge", glyph: "\uf624" },
  detour: { color: "#F07800", ink: "#121010", icon: "fa-route", glyph: "\uf4d7", dashed: true },
  expected: { color: "#E0A800", ink: "#121010", icon: "fa-triangle-exclamation", glyph: "\uf071" },
  access: { color: "#E0A800", ink: "#121010", icon: "fa-ban", glyph: "\uf05e" },
  clear: { color: "#1F9D55", ink: "#FFFFFF", icon: "fa-circle-check", glyph: "\uf058" },
};

export const styleOf = (level) => LEVEL_STYLE[level] ?? LEVEL_STYLE.clear;

/** Nom court affiché sur la carte. */
const SHORT_NAME = { gothard: "Gothard", "san-bernardino": "San Bernardino", simplon: "Simplon", "grand-st-bernard": "Gd-St-Bernard" };
export const shortName = (c) => SHORT_NAME[c.id] ?? c.name;

const DIR_KEYS = ["S", "N"];

/** Vitesses mesurées du compteur principal, « 72 / 69 km/h » (S / N), ou null. */
export function speedsText(c) {
  const v = DIR_KEYS.map((d) => mainCounter(c.directions[d])?.speed_light ?? null);
  if (v.every((x) => x == null)) return null;
  if (v.every((x) => x != null)) return `${v[0]} / ${v[1]} km/h`;
  return `${v.find((x) => x != null)} km/h`;
}

export function maxQueue(c) {
  const q = DIR_KEYS.map((d) => c.directions[d].queue_km).filter((x) => x != null);
  return q.length ? Math.max(...q) : null;
}

/** Texte court de la pastille (ligne 2) selon le niveau. */
export function pillText(c) {
  switch (c.level) {
    case "closed":
      return "Fermé";
    case "jam": {
      const q = maxQueue(c);
      return q != null ? `${km(q)} km` : "Bouchon";
    }
    case "slow":
      return "Ralenti";
    case "detour":
      return "Déviation";
    case "expected":
      return "Risque";
    case "access":
      return "Jonction fermée";
    default:
      return speedsText(c) ?? "Pas d'alerte";
  }
}
