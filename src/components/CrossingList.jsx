import { STATUS, sortedRows } from "../lib/status.js";
import { shortName } from "../lib/levels.js";
import { Barrier, Dot, PointRowBody, ROW_GRID } from "./PointRow.jsx";

/**
 * État d'une ligne mobile, en temps réel : « Pas d'alerte » discret (une fermeture annoncée reste dans la fiche), ou
 * l'alerte en cours (pastille ou barrière, libellé en gras rouge).
 */
function MobileState({ r }) {
  if (r.level === "clear") {
    return (
      <span className="flex flex-none items-center gap-1.5 text-[12.5px] text-ink-weak">
        <Dot color={STATUS.clear.color} />
        {STATUS.clear.word}
      </span>
    );
  }
  return (
    <span className="flex flex-none items-center gap-1.5 text-[12.5px] font-bold whitespace-nowrap" style={{ color: STATUS.closed.color }}>
      {r.closedPass ? <Barrier size={15} /> : <Dot color={STATUS[r.level].color} />}
      {STATUS[r.level].word}
    </span>
  );
}

/**
 * Liste des points (mode explore), cliquable. Desktop : lignes du mode compact (marqueur, nom, « Statut · détail ·
 * sens »). `mobile` (panneau bas ouvert) : lignes de 44 px, nom court des pastilles, état en cours à droite. Même ordre
 * partout, celui du mode compact (sortedRows) : perturbations, puis points sans alerte, cols fermés en dernier.
 * `empty` : message quand aucun point n'est retenu.
 */
export function CrossingList({ crossings, empty, sel, onSelect, onHover, mobile = false }) {
  const rows = sortedRows(crossings);
  return (
    <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
      {rows.map((r) => {
        const active = r.id === sel;
        return (
          <li key={r.id} className={mobile ? "border-t border-sheet-line" : "border-b border-panel-line"}>
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              onMouseEnter={onHover && (() => onHover(r.id))}
              onMouseLeave={onHover && (() => onHover(null))}
              aria-current={active || undefined}
              className={`w-full cursor-pointer border-none px-4 text-left font-body text-ink transition-colors duration-150 hover:bg-panel-hover ${active ? "bg-panel-hover" : "bg-transparent"} ${mobile ? "flex h-11 items-center justify-between gap-3" : `${ROW_GRID} py-4`}`}
            >
              {mobile ? (
                <>
                  <span className="min-w-0 truncate font-display text-[15px] leading-[1.2] font-bold">{shortName(r.c)}</span>
                  <MobileState r={r} />
                </>
              ) : (
                <PointRowBody r={r} active={active} />
              )}
            </button>
          </li>
        );
      })}
      {rows.length === 0 && <li className="px-4 py-5 text-sm text-ink-weak">{empty}</li>}
    </ul>
  );
}
