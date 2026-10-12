import { MAP_ATTRIBUTION } from "../config/mapConfig";

const SOURCE_CREDIT = "Source : OFROU / opentransportdata.swiss";
const TRACKS_CREDIT = "Tracés : ASTRA";

/**
 * Pied de page. Les crédits ne doivent jamais être tronqués : sur mobile, ils passent sur deux lignes.
 * Sous 964 px, l'attribution de la carte est en surimpression sur la carte (MapView).
 */
export function Footer({ mode }) {
  const wide = mode === "wide";
  return (
    <footer className="flex flex-none flex-wrap justify-between gap-x-3 border-t border-line px-4 py-1.5 text-[10.5px] leading-[1.4] whitespace-nowrap text-ink-weak">
      <span>{wide ? `${SOURCE_CREDIT} · ${TRACKS_CREDIT}` : SOURCE_CREDIT}</span>
      <span>{wide ? MAP_ATTRIBUTION : TRACKS_CREDIT}</span>
    </footer>
  );
}
