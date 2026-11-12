// Couleur des tracés de la carte par niveau, et noms courts des étiquettes.

/** color = trait de la carte (couleur ou jeton `var(--…)`, résolu au dessin) ; dashed = trait tireté (route fermée avec déviation). */
export const LEVEL_STYLE = {
  closed: { color: "var(--status-closed)" },
  jam: { color: "#E20000" },
  slow: { color: "#F07800" },
  detour: { color: "#F07800", dashed: true },
  expected: { color: "#E0A800" },
  access: { color: "#E0A800" },
  clear: { color: "#1F9D55" },
};

export const styleOf = (level) => LEVEL_STYLE[level] ?? LEVEL_STYLE.clear;

/** Nom court affiché sur la carte (pastille), quand le nom complet est trop long. */
const SHORT_NAME = {
  "grand-st-bernard": "Tunnel Gd-St-Bernard",
  "col-du-grand-st-bernard": "Col Gd-St-Bernard",
  "san-bernardino": "Tunnel San Bernardino",
  "douane-bardonnex": "Douane Bardonnex",
  "douane-vallorbe": "Douane Vallorbe",
};
export const shortName = (c) => SHORT_NAME[c.id] ?? c.name;
