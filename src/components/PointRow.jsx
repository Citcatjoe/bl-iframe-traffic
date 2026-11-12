import { STATUS } from "../lib/status.js";

const trim = "[text-box:trim-both_cap_alphabetic]";

/** Pastille d'état : 19 px dans les lignes, 10 px dans les légendes. */
export function Dot({ color, size = 10 }) {
  return <span className="inline-block flex-none rounded-full" style={{ background: color, width: size, height: size }} aria-hidden="true" />;
}

/**
 * Col fermé : perturbation au long cours (fermeture saisonnière), pas un état du trafic qui change d'une minute à
 * l'autre. Seule exception aux pastilles : barrière à la place de la pastille, même rouge.
 */
export function Barrier({ size }) {
  return <i className="fa-solid fa-road-barrier leading-none" style={{ color: STATUS.closed.color, fontSize: size }} aria-hidden="true" />;
}

/** Marqueur d'état d'une ligne (sortedRows) : pastille, ou barrière pour un col fermé. */
export function StatusMark({ r }) {
  return r.closedPass ? <Barrier size={17} /> : <Dot color={STATUS[r.level].color} size={19} />;
}

/** « **Statut** · détail · sens », le statut dans la couleur de la pastille. */
export function StatusLine({ r, className = "" }) {
  const st = STATUS[r.level];
  return (
    <span className={`text-[13px] leading-[1.4] text-ink-weak ${trim} ${className}`}>
      <strong style={{ color: st.color }}>{st.word}</strong>
      {r.parts.map((p) => ` · ${p}`).join("")}
    </span>
  );
}

/** Contenu d'une ligne de point (marqueur, nom, statut), commun au mode compact et à la liste du mode explore. */
export function PointRowBody({ r, active = false }) {
  return (
    <>
      <span className="flex justify-center">
        <StatusMark r={r} />
      </span>
      <span className="flex min-w-0 flex-col gap-2">
        <span className={`font-display text-[16px] leading-[1.2] font-bold ${trim} ${active ? "text-ink-brand" : ""}`}>{r.name}</span>
        <StatusLine r={r} />
      </span>
    </>
  );
}

export const ROW_GRID = "grid grid-cols-[24px_minmax(0,1fr)] items-center gap-4";
