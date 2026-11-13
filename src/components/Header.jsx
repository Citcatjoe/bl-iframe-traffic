import { hhmm } from "../format.js";

const DOT = { ok: "bg-ok", error: "bg-brand", loading: "bg-line" };

/** Sous ce seuil (largeur du widget), en-tête réduit : heure seule dans l'état du direct. */
export const HEADER_NARROW_MAX = 480;

/**
 * En-tête commun aux deux modes : titre traité en surtitre (petit, capitales, rouge Blick) et état du direct sur une
 * ligne. Fond `fill-weak` et petit retrait intérieur : les bords du widget restent lisibles dans l'article.
 * `compact` : sans filet dessous (la liste suit) ; sinon (explore) filet au-dessus de la carte.
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
      <h2 className="m-0 min-w-0 truncate font-body text-[13px] leading-none font-bold tracking-[0.04em] whitespace-nowrap text-ink-brand uppercase">
        Le point sur le trafic routier
      </h2>
      <span className="flex flex-none items-center gap-1.5 text-[12px] leading-none whitespace-nowrap text-ink-weak" aria-live="polite">
        <span className={`size-2 rounded-full ${DOT[status]}`} aria-hidden="true" />
        {stamp}
      </span>
    </header>
  );
}
