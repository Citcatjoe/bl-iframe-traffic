import { hhmm } from "../format.js";

const DOT = { ok: "bg-ok", error: "bg-brand", loading: "bg-line" };

/** Sous ce seuil (largeur du widget), en-tête réduit : heure seule dans l'état du direct. */
export const HEADER_NARROW_MAX = 480;

const TITLE = {
  explore: "font-display text-[19px] leading-[1.2] text-balance text-ink antialiased",
  // Mode compact : titre traité en surtitre (petit, capitales, rouge Blick).
  compact: "truncate font-body text-[13px] leading-none tracking-[0.04em] whitespace-nowrap text-ink-brand uppercase",
};

/**
 * En-tête commun aux deux modes : titre et état du direct sur une ligne. Fond `fill-weak` et petit retrait
 * intérieur : les bords du widget restent lisibles dans l'article.
 * `compact` : titre en surtitre, sans filet dessous (la liste suit) ; sinon (explore) grand titre et filet sur la carte.
 */
export function Header({ narrow, status, time, compact = false }) {
  const stamp =
    status === "ok"
      ? narrow
        ? (time ? hhmm(time) : "En direct")
        : `En direct${time ? ` · ${hhmm(time)}` : ""}`
      : status === "error"
        ? "Indisponible"
        : "Chargement…";
  return (
    <header className={`flex flex-none items-center justify-between gap-3 bg-surface-weak px-3 py-2.5 ${compact ? "" : "border-b border-line"}`}>
      <h2 className={`m-0 min-w-0 font-bold ${TITLE[compact ? "compact" : "explore"]}`}>Le point sur le trafic routier</h2>
      <span className="flex flex-none items-center gap-1.5 text-[12px] leading-none whitespace-nowrap text-ink-weak" aria-live="polite">
        <span className={`size-2 rounded-full ${DOT[status]}`} aria-hidden="true" />
        {stamp}
      </span>
    </header>
  );
}
