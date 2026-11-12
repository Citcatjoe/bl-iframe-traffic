import { CrossingDetail, DetailBar } from "./CrossingDetail.jsx";
import { CrossingList } from "./CrossingList.jsx";
import { FilterBar } from "./FilterBar.jsx";
import { IconButton } from "./ui/IconButton";

const BASE = "z-[3] flex flex-col bg-panel [--scrollbar-thumb:var(--panel-thumb)]";

function panelClass(mode, panelOpen) {
  // 964 et 632 px : panneau superposé à la carte, replié par défaut, ouvert par « Liste » ou un point choisi.
  if (mode !== "mobile") {
    return `${BASE} overflow-hidden absolute top-3 bottom-3 left-3 w-[300px] rounded-lg shadow-menu transition-transform duration-[220ms] ease-in-out ${panelOpen ? "translate-x-0" : "-translate-x-[calc(100%+24px)]"}`;
  }
  if (panelOpen) return `${BASE} overflow-hidden absolute inset-0 z-[6]`;
  // Barre réduite : pas d'overflow-hidden, le menu du filtre s'ouvre vers le haut, par-dessus la carte.
  return `${BASE} relative order-2 flex-none border-t border-panel-line`;
}

/**
 * Panneau unique liste ↔ fiche. Deux pages côte à côte ; la fiche entre par la droite.
 * Mobile (comme bl-iframe-map-ski) : barre réduite sous la carte (filtre + bouton liste) ; plein cadre quand
 * `panelOpen` : liste en lignes courtes, ou directement la fiche quand un point est choisi (carte ou liste).
 * `crossings` : tous les points (comptes du filtre) ; `list` : points retenus par le filtre.
 */
export function SidePanel({ mode, panelOpen, crossings, updatedAt, list, filter, onFilter, sel, shown, onSelect, onHover, onOpen, onClose, onBack }) {
  const mobile = mode === "mobile";
  const focused = !!sel;
  const filterBar = (props) => <FilterBar crossings={crossings} value={filter} onChange={onFilter} {...props} />;

  // Mobile : la barre reste dans le flux, même sous le panneau plein cadre (inerte alors) : la carte garde sa taille,
  // et la vue d'ensemble recalculée pendant que le panneau est ouvert reste juste à sa fermeture.
  const bar = mobile && (
    <aside className={panelClass(mode, false)} inert={panelOpen} aria-hidden={panelOpen || undefined} aria-label="Points suivis">
      {filterBar({ dropUp: true, action: <IconButton icon="fa-solid fa-list" color="grey" label="Voir tous les points" onClick={onOpen} /> })}
    </aside>
  );
  if (mobile && !panelOpen) return bar;

  return (
    <>
      {bar}
      <aside className={panelClass(mode, panelOpen)} inert={!mobile && !panelOpen} aria-label="Points suivis">
        {/* overflow-clip, pas hidden : un focus dans la page cachée ne doit pas faire défiler la piste. */}
        <div className="relative min-h-0 flex-1 overflow-clip">
          <div
            className="flex h-full w-[200%] transition-transform duration-[340ms] ease-[cubic-bezier(.2,.7,.2,1)]"
            style={{ transform: focused ? "translateX(-50%)" : "translateX(0)" }}
          >
            {/* Page liste */}
            <div className="flex h-full min-h-0 w-1/2 flex-col" inert={focused}>
              {filterBar({ action: <IconButton icon="fa-solid fa-xmark" label="Fermer la liste" onClick={onClose} /> })}
              <CrossingList
                crossings={list}
                empty={filter ? "Aucun point ne correspond à ce filtre en ce moment." : "Pas encore de données."}
                sel={sel}
                onSelect={onSelect}
                onHover={mobile ? undefined : onHover}
                short={mobile}
              />
            </div>

            {/* Page fiche */}
            <div className="flex h-full min-h-0 w-1/2 flex-col" inert={!focused}>
              {shown && (
                <>
                  <DetailBar onBack={onBack} onClose={onClose} />
                  <CrossingDetail c={shown} crossings={crossings} updatedAt={updatedAt} compact={mobile} />
                </>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
