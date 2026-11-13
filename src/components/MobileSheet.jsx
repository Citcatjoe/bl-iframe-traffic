import { useLayoutEffect, useRef, useState } from "react";
import { MobileDetail } from "./CrossingDetail.jsx";
import { CrossingList } from "./CrossingList.jsx";
import { CycleFilter } from "./CycleFilter.jsx";
import { RoundButton } from "./ui/RoundButton.jsx";

/** Bande de carte laissée visible au-dessus du panneau à sa hauteur maximale (liste ouverte). */
export const SHEET_TOP_GAP = 44;
/** Hauteur de l'accueil (9a) avant sa première mesure. */
const HOME_HEIGHT = 64;

/**
 * Panneau bas mobile (maquettes 9a, 9b, 9c), posé sur le bas de la carte, jamais masqué ; sa hauteur suit son contenu
 * (200 ms) jusqu'à `maxHeight`, au-delà le contenu défile.
 * - accueil : filtre cyclique et bouton liste ;
 * - liste (`listOpen`) : hauteur maximale ; la bande de carte au-dessus referme la liste ;
 * - fiche (`sel`) : compacte, le tracé reste visible au-dessus ; le bouton fermer ramène à l'accueil.
 * `insetRef` reçoit la hauteur de la vue d'arrivée, mesurée avant que la carte ne bouge (effet de mise en page, avant
 * les effets de MapView) : la carte cadre son sujet au-dessus. Liste ouverte : hauteur de l'accueil (la liste est
 * passagère, la carte n'y laisse qu'une bande).
 */
export function MobileSheet({ crossings, list, filter, onFilter, sel, shown, updatedAt, listOpen, maxHeight, insetRef, onSelect, onOpenList, onClose }) {
  const view = sel && shown ? "detail" : listOpen ? "list" : "home";
  const contentRef = useRef(null);
  const homeHeight = useRef(HOME_HEIGHT);
  const [contentHeight, setContentHeight] = useState(HOME_HEIGHT);

  // Hauteur naturelle du contenu (accueil, fiche), suivie quand il change (autre point, historique déplié).
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return undefined;
    const measure = () => setContentHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  useLayoutEffect(() => {
    const natural = contentRef.current ? Math.min(contentRef.current.offsetHeight, maxHeight) : maxHeight;
    if (view === "home") homeHeight.current = natural;
    insetRef.current = view === "list" ? homeHeight.current : natural;
  });

  const height = view === "list" ? maxHeight : Math.min(contentHeight, maxHeight);

  return (
    <>
      {view === "list" && (
        // Bande de carte visible au-dessus de la liste : la toucher referme la liste (la croix fait de même au clavier).
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={onClose}
          className="absolute inset-x-0 top-0 z-[4] cursor-pointer border-none bg-transparent p-0"
          style={{ height: SHEET_TOP_GAP }}
        />
      )}
      <aside
        aria-label="Points suivis"
        className="absolute inset-x-0 bottom-0 z-[4] flex flex-col overflow-hidden rounded-t-[14px] bg-panel shadow-[0_-6px_20px_rgba(18,16,16,0.14)] transition-[height] duration-200 ease-out motion-reduce:transition-none [--scrollbar-thumb:var(--panel-thumb)]"
        style={{ height }}
      >
        {view === "list" ? (
          <>
            <div className="flex flex-none items-center justify-between gap-2 px-4 py-2.5">
              <CycleFilter crossings={crossings} value={filter} onChange={onFilter} />
              <RoundButton icon="fa-solid fa-xmark" label="Fermer la liste" onClick={onClose} />
            </div>
            <CrossingList
              crossings={list}
              empty={filter ? "Aucun point ne correspond à ce filtre en ce moment." : "Pas encore de données."}
              sel={sel}
              onSelect={onSelect}
              mobile
            />
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div ref={contentRef}>
              {view === "detail" ? (
                <MobileDetail c={shown} updatedAt={updatedAt} onClose={onClose} />
              ) : (
                <div className="flex items-center justify-between gap-2.5 px-4 py-3">
                  <CycleFilter crossings={crossings} value={filter} onChange={onFilter} />
                  <RoundButton icon="fa-solid fa-list" label="Voir la liste des points" iconSize={18} onClick={onOpenList} />
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
