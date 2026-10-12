import { CrossingDetail } from "./CrossingDetail.jsx";
import { CountBar, CrossingList } from "./CrossingList.jsx";
import { IconButton } from "./ui/IconButton";

const BASE = "z-[3] flex flex-col overflow-hidden bg-surface";

function panelClass(mode, panelOpen) {
  if (mode === "wide") return `${BASE} relative w-[312px] flex-none border-r border-line`;
  if (mode === "mid") {
    return `${BASE} absolute top-3 bottom-3 left-3 w-[300px] rounded-lg shadow-menu transition-transform duration-[220ms] ease-in-out ${panelOpen ? "translate-x-0" : "-translate-x-[calc(100%+24px)]"}`;
  }
  return `${BASE} absolute inset-0 z-[6] ${panelOpen ? "" : "hidden"}`;
}

/**
 * Panneau unique liste ↔ fiche. Deux pages côte à côte ; la fiche entre par la droite.
 * Mobile : plein cadre au-dessus de la carte quand `panelOpen` (sinon le dock sous la carte fait le travail).
 */
export function SidePanel({ mode, panelOpen, list, sel, shown, countersKnown, onSelect, onHover, onClose, onBack }) {
  const mobile = mode === "mobile";
  const mid = mode === "mid";
  const focused = !!sel && (!mobile || panelOpen);

  return (
    <aside className={panelClass(mode, panelOpen)} inert={(mid || mobile) && !panelOpen} aria-label="Traversées alpines">
      {/* overflow-clip, pas hidden : un focus dans la page cachée ne doit pas faire défiler la piste. */}
      <div className="relative min-h-0 flex-1 overflow-clip">
        <div
          className="flex h-full w-[200%] transition-transform duration-[340ms] ease-[cubic-bezier(.2,.7,.2,1)]"
          style={{ transform: focused ? "translateX(-50%)" : "translateX(0)" }}
        >
          {/* Page liste */}
          <div className="flex h-full min-h-0 w-1/2 flex-col" inert={focused}>
            <div className={`flex flex-none items-center justify-between pr-3 pl-4 ${mid || mobile ? "pt-2.5" : "pt-3.5"}`}>
              <span className="font-display text-[19px] font-bold">Traversées alpines</span>
              {(mid || mobile) && <IconButton icon="fa-solid fa-xmark" label="Fermer la liste" onClick={onClose} />}
            </div>
            {/* Emplacement des filtres (recherche, groupes) si la liste s'allonge */}
            <CountBar count={list.length} />
            <CrossingList crossings={list} sel={sel} onSelect={onSelect} onHover={mobile ? undefined : onHover} />
          </div>

          {/* Page fiche */}
          <div className="flex h-full min-h-0 w-1/2 flex-col" inert={!focused}>
            {shown && (
              <>
                <div className="flex h-[52px] flex-none items-center justify-between gap-2 border-b border-line pr-2 pl-1.5">
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex h-10 cursor-pointer items-center gap-2 rounded-pill bg-transparent px-2.5 font-body text-sm font-bold text-ink transition-colors duration-150 hover:bg-surface-weak"
                  >
                    <i className="fa-solid fa-arrow-left" aria-hidden="true" />
                    Toutes les traversées
                  </button>
                  {(mid || mobile) && <IconButton icon="fa-solid fa-xmark" label="Fermer le panneau" onClick={onClose} />}
                </div>
                <CrossingDetail c={shown} countersKnown={countersKnown} small={mobile} />
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
