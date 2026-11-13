import { DATA_CREDIT } from "../config/credits.js";
import { trackClick } from "../lib/analytics.js";
import { STATUS, sortedRows } from "../lib/status.js";
import { Barrier, Dot, PointRowBody, ROW_GRID } from "./PointRow.jsx";

/** Points listés ; les suivants sont résumés dans le pied. */
const MAX_ROWS = 6;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Mode compact (haut de rubrique, homepage), maquette 4a / 4b : 6 points au plus, en deux colonnes (≥ 480 px,
 * lecture par colonne, les plus graves à gauche) ou une (mobile, mêmes lignes et mêmes infos) ; le reste est résumé
 * dans le pied. Lignes non cliquables, pas de fiche : le détail est dans le mode explore (« Tout voir »).
 * `columns` (facultatif, `?points=a,b|c,d`) : une colonne par groupe, chacun trié par gravité ; en une colonne, les
 * groupes se suivent.
 */
export function CompactView({ crossings, columns, twoColumns, error, seeAllUrl }) {
  const rows = sortedRows(crossings);
  if (!rows.length) return <p className="m-0 bg-surface-weak px-3 py-3 text-[13px] text-ink-weak">{error ?? "Chargement…"}</p>;

  let colRows;
  let rest;
  if (columns) {
    const perGroup = Math.ceil(MAX_ROWS / columns.length);
    const sorted = columns.map(sortedRows);
    colRows = sorted.map((g) => g.slice(0, perGroup)).filter((g) => g.length);
    rest = sorted.flatMap((g) => g.slice(perGroup));
  } else {
    const shownRows = rows.slice(0, MAX_ROWS);
    const perColumn = twoColumns ? Math.ceil(shownRows.length / 2) : shownRows.length;
    colRows = [shownRows.slice(0, perColumn), shownRows.slice(perColumn)].filter((g) => g.length);
    rest = rows.slice(MAX_ROWS);
  }
  const passes = rest.filter((r) => r.closedPass).length;
  const tonight = rest.filter((r) => r.level === "clear" && r.tonight).length;
  const quiet = rest.filter((r) => r.level === "clear" && !r.tonight).length;
  const alerts = rest.length - passes - tonight - quiet; // plus de 6 points perturbés : ne jamais les taire
  // Cellules : colonne et ligne dans la grille (deux colonnes), ou à la suite (une colonne).
  const cells = colRows.flatMap((g, c) => g.map((r, j) => ({ r, c, j })));
  const counters = [
    [alerts, STATUS.jam.color, "autre point perturbé", "autres points perturbés"],
    [tonight, STATUS.closed.color, "autre fermeture ce soir", "autres fermetures ce soir"],
    [quiet, STATUS.clear.color, "autre point sans alerte", "autres points sans alerte"],
    [passes, null, "col fermé", "cols fermés"],
  ].filter(([n]) => n > 0);
  const seeAll = (
    <>
      Tout voir
      <i className="fa-solid fa-arrow-right text-[11px]" aria-hidden="true" />
    </>
  );

  return (
    <>
      <ul
        className="m-0 grid list-none bg-surface-weak px-3 py-0"
        style={twoColumns ? { gridTemplateColumns: `repeat(${colRows.length}, minmax(0, 1fr))`, columnGap: 28 } : undefined}
      >
        {cells.map(({ r, c, j }, i) => (
          <li
            key={r.id}
            className={`${ROW_GRID} ${twoColumns ? "py-4" : "py-[13px]"} ${(twoColumns ? j : i) === 0 ? "" : "border-t border-line"}`}
            style={twoColumns ? { gridColumn: c + 1, gridRow: j + 1 } : undefined}
          >
            <PointRowBody r={r} />
          </li>
        ))}
      </ul>
      <footer className={`flex flex-wrap items-center gap-y-1 bg-surface-strong px-4 py-[9px] text-[13px] leading-[1.4] text-ink ${twoColumns ? "gap-x-4" : "gap-x-3"}`}>
        {/* Une colonne (mobile) : pastille et nombre seuls, le libellé reste lu par les lecteurs d'écran. */}
        {counters.map(([n, color, one, many]) => (
          <span key={one} className="flex items-center gap-1.5" title={twoColumns ? undefined : plural(n, one, many)}>
            {color ? <Dot color={color} /> : <Barrier size={10} />}
            {twoColumns ? plural(n, one, many) : (
              <>
                <span aria-hidden="true">{n}</span>
                <span className="sr-only">{plural(n, one, many)}</span>
              </>
            )}
          </span>
        ))}
        {/* URL à définir : sans `seeAllUrl`, le libellé reste affiché sans lien. */}
        {seeAllUrl ? (
          <a href={seeAllUrl} target="_top" onClick={() => trackClick("see_all")} className="ml-auto flex items-center gap-1.5 font-bold text-ink-brand no-underline">
            {seeAll}
          </a>
        ) : (
          <span className="ml-auto flex items-center gap-1.5 font-bold text-ink-brand">{seeAll}</span>
        )}
      </footer>
      {/* Pas de carte ici : seules les données OFROU sont exploitées, d'où ce seul crédit. */}
      <p className="m-0 border-t border-line py-2 text-[12px] leading-[16px] text-ink-weak">{DATA_CREDIT}</p>
    </>
  );
}
