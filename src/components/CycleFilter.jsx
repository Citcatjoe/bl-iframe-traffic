import { useState } from "react";
import { PILL_FADE_MS } from "../config/mapConfig.js";
import { FILTERS, filterCount, filterCycle, nextFilter } from "../lib/filters.js";
import { Barrier, Dot } from "./PointRow.jsx";

const ALL = { id: null, label: "Tous les points" };
const OPTIONS = [ALL, ...FILTERS];

/** Pagination : diamètres (point actif, inactif) et écart, en px ; place réservée pour le cycle complet. */
const DOT_ON = 7;
const DOT_OFF = 5;
const DOT_GAP = 4;
const DOTS_WIDTH = OPTIONS.length * DOT_ON + (OPTIONS.length - 1) * DOT_GAP;

/**
 * Repère du filtre, repris des listes et de la carte : pastille de couleur (rouge bouchon, orange ralenti), barrière
 * rouge foncé pour les fermetures, horloge pour « À venir » ; rien pour « Tous les points ».
 */
function Mark({ f }) {
  if (f.barrier) return <Barrier size={12} />;
  if (f.icon) return <i className={`fa-solid ${f.icon} text-[11px] leading-none`} aria-hidden="true" />;
  if (f.color) return <Dot color={f.color} />;
  return null;
}

/**
 * Pagination en points (décorative) : un point par filtre du cycle, filtres vides exclus ; le premier est « Tous les
 * points ». Chaque point a sa case fixe (largeur réservée pour le cycle complet) : les points ne bougent pas ; seuls
 * leur taille (5 → 7 px) et leur couleur (`grey-500` → `text-default`) changent, en transition linéaire de la durée
 * du fondu des pastilles de la carte (PILL_FADE_MS) : au clic, pagination et pastilles changent ensemble.
 */
function Dots({ count, active }) {
  return (
    <span className="ml-1 flex flex-none items-center" style={{ width: DOTS_WIDTH, gap: DOT_GAP }} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const on = i === active;
        return (
          <span key={i} className="flex flex-none items-center justify-center" style={{ width: DOT_ON, height: DOT_ON }}>
            <span
              className={`rounded-full transition-[width,height,background-color] ease-linear motion-reduce:transition-none ${on ? "bg-ink" : "bg-[var(--color-grey-500)]"}`}
              style={{ width: on ? DOT_ON : DOT_OFF, height: on ? DOT_ON : DOT_OFF, transitionDuration: `${PILL_FADE_MS}ms` }}
            />
          </span>
        );
      })}
    </span>
  );
}

/**
 * Bouton de filtre cyclique (desktop et mobile), à la place du menu : affiche le filtre en cours, son compteur et sa
 * place dans le cycle (pagination en points) ; chaque appui passe au filtre suivant non vide (lib/filters.js,
 * nextFilter). Largeur constante : tous les libellés sont empilés dans la même case (seul le filtre en cours est
 * visible), la case prend la largeur du plus long, et la pagination réserve la place du cycle complet. Le filtre
 * choisi est annoncé dans une région `aria-live` (seulement après un appui : pas à chaque rafraîchissement).
 */
export function CycleFilter({ crossings, value, onChange }) {
  const [announce, setAnnounce] = useState("");
  const current = OPTIONS.find((f) => f.id === value) ?? ALL;
  const n = filterCount(crossings, current.id);
  const cycle = filterCycle(crossings);
  const position = Math.max(0, cycle.indexOf(value));
  return (
    <>
      <button
        type="button"
        onClick={() => {
          const next = nextFilter(crossings, value);
          if (next === value) return;
          const f = OPTIONS.find((x) => x.id === next) ?? ALL;
          setAnnounce(`Filtre : ${f.label}, ${filterCount(crossings, next)}`);
          onChange(next);
        }}
        aria-label={`Filtre ${position + 1} sur ${cycle.length} : ${current.label.toLowerCase()}, ${n}. Appuyer pour passer au filtre suivant`}
        className="flex h-9 flex-none cursor-pointer items-center rounded-pill border-none bg-panel-hover px-3.5 font-body text-[14px] leading-none text-ink"
      >
        <span className="grid" aria-hidden="true">
          {OPTIONS.map((f) => (
            <span key={f.label} className={`col-start-1 row-start-1 flex items-center gap-1.5 ${f.id === current.id ? "" : "invisible"}`}>
              <Mark f={f} />
              <span className="font-semibold whitespace-nowrap">{f.label}</span>
              <span className="min-w-[2ch] text-ink-weak tabular-nums">{filterCount(crossings, f.id)}</span>
            </span>
          ))}
        </span>
        <Dots count={cycle.length} active={position} />
      </button>
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </>
  );
}
