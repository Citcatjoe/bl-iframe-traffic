import { STATUS, sortedRows } from "../lib/status.js";
import { Barrier, Dot, PointRowBody, ROW_GRID } from "./PointRow.jsx";

/** Ligne courte (mobile) : nom, puis pastille et mot du statut en fin de ligne. */
function LineBody({ r, active }) {
  const st = STATUS[r.level];
  return (
    <>
      <span className={`min-w-0 truncate font-display text-[14px] font-bold ${active ? "text-ink-brand" : ""}`}>{r.name}</span>
      <span className="flex flex-none items-center gap-1.5 text-[13px] font-bold" style={{ color: st.color }}>
        {r.closedPass ? <Barrier size={12} /> : <Dot color={st.color} />}
        {st.word}
      </span>
    </>
  );
}

/**
 * Liste des points (mode explore), cliquable, dans l'ordre du mode compact. Lignes du mode compact (marqueur, nom,
 * « Statut · détail · sens »), ou `short` (mobile) : une ligne de 34 px sans le détail.
 * `empty` : message quand aucun point n'est retenu.
 */
export function CrossingList({ crossings, empty, sel, onSelect, onHover, short = false }) {
  const rows = sortedRows(crossings);
  return (
    <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
      {rows.map((r) => {
        const active = r.id === sel;
        const layout = short ? "flex h-[34px] items-center justify-between gap-3" : `${ROW_GRID} py-4`;
        return (
          <li key={r.id} className="border-b border-panel-line">
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              onMouseEnter={onHover && (() => onHover(r.id))}
              onMouseLeave={onHover && (() => onHover(null))}
              aria-current={active || undefined}
              className={`${layout} w-full cursor-pointer border-none px-4 text-left font-body text-ink transition-colors duration-150 hover:bg-panel-hover ${active ? "bg-panel-hover" : "bg-transparent"}`}
            >
              {short ? <LineBody r={r} active={active} /> : <PointRowBody r={r} active={active} />}
            </button>
          </li>
        );
      })}
      {rows.length === 0 && <li className="px-4 py-5 text-sm text-ink-weak">{empty}</li>}
    </ul>
  );
}
