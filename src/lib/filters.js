// Filtre de la liste et de la carte (mode explore) : un seul à la fois ; aucun = tout afficher.
import { DIR_KEYS, dedupeUpcoming, within24h } from "../format.js";
import { STATUS } from "./status.js";

/** Niveau présent sur le point : dans un sens, ou dans un message sans sens identifiable. */
const hasLevel = (c, levels) =>
  DIR_KEYS.some((k) => levels.includes(c.directions[k].level)) || c.undirected.some((m) => levels.includes(m.level));

export const FILTERS = [
  { id: "jam", label: "Bouchons", color: STATUS.jam.color, test: (c) => hasLevel(c, ["jam"]) },
  { id: "slow", label: "Ralentissements", color: STATUS.slow.color, test: (c) => hasLevel(c, ["slow"]) },
  // Route fermée (avec ou sans déviation locale) ou jonction fermée : tout ce qui empêche de passer par là.
  { id: "closed", label: "Fermetures", color: STATUS.closed.color, test: (c) => hasLevel(c, ["closed", "detour", "access"]) },
  // Fermeture annoncée dans les 24 h ou risque de bouchon.
  { id: "soon", label: "À venir", icon: "fa-clock", test: (c) => hasLevel(c, ["expected"]) || dedupeUpcoming(c.upcoming).some(within24h) },
];

/** @param {string|null} id  filtre choisi, `null` pour tout afficher */
export function applyFilter(crossings, id) {
  const f = FILTERS.find((x) => x.id === id);
  return f ? crossings.filter(f.test) : crossings;
}

/**
 * Sélection de points (paramètre `?points=`, mode compact) : identifiants séparés par des virgules ; `|` sépare des
 * colonnes (`lausanne-geneve,lausanne-valais|douane-bardonnex,douane-vallorbe`). Vide ou absent : tous les points.
 * Identifiants inconnus ignorés et renvoyés dans `unknown`.
 * @returns {{ list: object[], columns: object[][]|null, unknown: string[] }}
 */
export function selectPoints(crossings, param) {
  const groups = (param ?? "").split("|").map((g) => g.split(",").map((s) => s.trim()).filter(Boolean)).filter((g) => g.length);
  if (!groups.length) return { list: crossings, columns: null, unknown: [] };
  const byId = new Map(crossings.map((c) => [c.id, c]));
  const columns = groups.map((g) => g.map((id) => byId.get(id)).filter(Boolean)).filter((g) => g.length);
  return {
    list: columns.flat(),
    columns: columns.length > 1 ? columns : null,
    unknown: groups.flat().filter((id) => !byId.has(id)),
  };
}
