import { CrossingDetail, DetailBar } from "./CrossingDetail.jsx";
import { CrossingList } from "./CrossingList.jsx";
import { CycleFilter } from "./CycleFilter.jsx";
import { IconButton } from "./ui/IconButton";

/**
 * Panneau unique liste ↔ fiche, 964 et 632 px (le mobile a son panneau bas, MobileSheet). Superposé à la carte,
 * replié tant que `panelOpen` est faux, ouvert par « Liste » ou un point choisi. Deux pages côte à côte ; la fiche
 * entre par la droite. `crossings` : tous les points (comptes du filtre) ; `list` : points retenus par le filtre.
 */
export function SidePanel({ panelOpen, crossings, updatedAt, list, filter, onFilter, sel, shown, onSelect, onHover, onClose, onBack }) {
  const focused = !!sel;
  return (
    <aside
      className={`absolute top-3 bottom-3 left-3 z-[3] flex w-[300px] flex-col overflow-hidden rounded-lg bg-panel shadow-menu transition-transform duration-[220ms] ease-in-out [--scrollbar-thumb:var(--panel-thumb)] ${panelOpen ? "translate-x-0" : "-translate-x-[calc(100%+24px)]"}`}
      inert={!panelOpen}
      aria-label="Points suivis"
    >
      {/* overflow-clip, pas hidden : un focus dans la page cachée ne doit pas faire défiler la piste. */}
      <div className="relative min-h-0 flex-1 overflow-clip">
        <div
          className="flex h-full w-[200%] transition-transform duration-[340ms] ease-[cubic-bezier(.2,.7,.2,1)]"
          style={{ transform: focused ? "translateX(-50%)" : "translateX(0)" }}
        >
          {/* Page liste */}
          <div className="flex h-full min-h-0 w-1/2 flex-col" inert={focused}>
            <div className="flex h-[52px] flex-none items-center justify-between gap-2 border-b border-panel-line pr-2 pl-3">
              <CycleFilter crossings={crossings} value={filter} onChange={onFilter} />
              <IconButton icon="fa-solid fa-xmark" label="Fermer la liste" onClick={onClose} />
            </div>
            <CrossingList
              crossings={list}
              empty={filter ? "Aucun point ne correspond à ce filtre en ce moment." : "Pas encore de données."}
              sel={sel}
              onSelect={onSelect}
              onHover={onHover}
            />
          </div>

          {/* Page fiche */}
          <div className="flex h-full min-h-0 w-1/2 flex-col" inert={!focused}>
            {shown && (
              <>
                <DetailBar onBack={onBack} onClose={onClose} />
                <CrossingDetail c={shown} crossings={crossings} updatedAt={updatedAt} />
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
