import { useMemo, useState } from "react";
import { apiUrl } from "../config/api.js";
import { hhmm, km, when } from "../format.js";
import { trackClick } from "../lib/analytics.js";
import { alternativeOf, nextClosure, reopeningText, statusLines } from "../lib/detail.js";
import { durationText, journalEvents } from "../lib/journal.js";
import { STATUS, lowerFirst, reasonOf } from "../lib/status.js";
import { usePolling } from "../usePolling.js";
import { Barrier, Dot } from "./PointRow.jsx";
import { IconButton } from "./ui/IconButton";
import { RoundButton } from "./ui/RoundButton.jsx";

const HISTORY_REFRESH_MS = 180_000;
const JOURNAL_HOURS = 24;
const JOURNAL_MAX = 12;

/** Couleur du mot d'état : celle de la pastille, sauf « Fermé » en gris (la pastille porte déjà le rouge). */
const titleColor = (level) => (level === "closed" ? "var(--color-text-weak)" : STATUS[level].color);

/** Tailles de la fiche desktop (panneau de 300 px, maquette 5a). */
const S = {
  head: "pt-5",
  name: "text-[24px]",
  first: "mt-[18px]",
  line: "py-4",
  grid: "grid-cols-[24px_minmax(0,1fr)] gap-[14px]",
  title: "text-[15px]",
  metrics: "pl-[38px] gap-[14px]",
  metric: "text-[28px]",
  mark: 19,
  glyph: "text-[17px]",
  barrier: 17,
  foot: "pt-[14px] pb-4",
};
/** Métriques d'un bouchon dans la fiche mobile (panneau bas). */
const S_MOBILE = { metrics: "pl-7 gap-3", metric: "text-[22px]" };

/**
 * Texte en segments séparés par « · » : passe à la ligne entre deux segments, jamais au milieu, sauf un segment plus
 * long qu'une ligne (bloc en ligne : il ne déborde pas, il se coupe alors lui-même).
 */
function Segments({ parts }) {
  const list = parts.filter(Boolean);
  return list.map((p, i) => (
    <span key={i}>
      <span className="inline-block max-w-full">
        {p}
        {i < list.length - 1 && " ·"}
      </span>{" "}
    </span>
  ));
}
const segmentsOf = (text) => (text ? text.split(" · ") : []);

/**
 * Ligne d'info : pictogramme centré (colonne fixe), ligne principale en gras, précision dessous en 13 px grise.
 * `children` : sous la ligne (métriques).
 */
function InfoLine({ s, icon, title, color, text, first = false, children }) {
  return (
    <div className={`mx-4 border-t border-panel-line ${s.line} ${first ? s.first : ""}`}>
      <div className={`grid items-center ${s.grid}`}>
        <span className="flex justify-center">{icon}</span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={`${s.title} leading-[1.3] font-bold`} style={{ color }}>
            {title}
          </span>
          {text && <span className="text-[13px] leading-[1.45] text-ink-weak">{text}</span>}
        </span>
      </div>
      {children}
    </div>
  );
}

/** Bouchon : temps perdu et longueur en grand, alignés sur le texte de la ligne. */
function Metrics({ s, items }) {
  return (
    <div className={`mt-3 grid grid-cols-2 ${s.metrics}`}>
      {items.map((m) => (
        <div key={m.label} className="flex flex-col gap-1">
          <span className={`font-display ${s.metric} leading-none font-bold`}>{m.value}</span>
          <span className="text-[13px] leading-[1.45] text-ink-weak">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Détail d'un événement du journal. Alerte : longueur, temps perdu, tronçon touché, motif (« véhicule en feu »).
 * Fin d'alerte : ce qui s'arrête et sa durée, si son début est dans la période (« fermé pendant 27 min »).
 */
function eventDetail(e) {
  if (e.level === "clear") {
    const ended = e.prev && STATUS[e.prev] && e.lasted_ms != null ? `${lowerFirst(STATUS[e.prev].word)} pendant ${durationText(e.lasted_ms)}` : null;
    return ["fin de l'alerte", ended];
  }
  return [e.queue_km != null ? `${km(e.queue_km)} km` : null, e.delay_min != null ? `${e.delay_min} min perdues` : null, e.section_fr, reasonOf([e])];
}

/**
 * Historique du jour, replié : changements d'état par sens sur 24 h (relevés du serveur). `mobile` : bouton pleine
 * largeur de 36 px au moins, 12,5 px, chevron 16 px.
 */
function History({ id, directions, mobile = false }) {
  const [open, setOpen] = useState(false);
  const h = usePolling(apiUrl(`/api/history?point=${id}&hours=${JOURNAL_HOURS}`), HISTORY_REFRESH_MS);
  const events = useMemo(() => (h.data ? journalEvents(h.data.situations).slice(0, JOURNAL_MAX) : null), [h.data]);
  const n = events?.filter((e) => !e.initial).length ?? 0;
  const label = events
    ? `Historique du jour · ${n === 0 ? "aucun changement" : n === 1 ? "1 changement" : `${n} changements`}`
    : h.error
      ? "Historique indisponible"
      : "Historique du jour";
  const expandable = !!events?.length;
  return (
    <>
      <button
        type="button"
        aria-expanded={expandable ? open : undefined}
        disabled={!expandable}
        onClick={() => {
          if (!open) trackClick("history", { point: id });
          setOpen(!open);
        }}
        className={`flex w-full items-center justify-between gap-2 border-none bg-transparent p-0 text-left font-body text-ink-weak enabled:cursor-pointer ${mobile ? "min-h-9 text-[12.5px] leading-[1.35]" : "text-[13px] leading-[1.45]"}`}
      >
        {label}
        {expandable && <i className={`fa-solid fa-chevron-down ${mobile ? "text-[16px]" : "text-[11px]"} transition-transform duration-150 ${open ? "rotate-180" : ""}`} aria-hidden="true" />}
      </button>
      {open && expandable && (
        <ol className={`m-0 flex list-none flex-col gap-2 p-0 ${mobile ? "mt-1 pb-2.5" : "mt-3"}`}>
          {events.map((e) => {
            const st = STATUS[e.level] ?? STATUS.clear;
            const sens = e.dirs.length === 2 ? "deux sens" : lowerFirst(directions[e.dirs[0]].label);
            const what = eventDetail(e).filter(Boolean).join(" · ");
            return (
              <li key={`${e.t}${e.dirs.join("")}${e.level}`} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 text-[13px] leading-[1.45]">
                <span className="text-ink-weak tabular-nums">{e.initial ? `≤ ${when(e.t)}` : when(e.t)}</span>
                <span className="text-ink-weak">
                  <strong style={{ color: st.color }}>{st.word}</strong>
                  {` · ${sens}`}
                  {what && ` · ${what}`}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

/** Barre de la fiche : retour à la liste, fermeture du panneau. */
export function DetailBar({ onBack, onClose }) {
  return (
    <div className="flex h-[52px] flex-none items-center justify-between gap-2 border-b border-panel-line pr-2 pl-1.5">
      <button
        type="button"
        onClick={onBack}
        className="flex h-10 cursor-pointer items-center gap-2 rounded-pill bg-transparent px-2.5 font-body text-sm font-bold text-ink transition-colors duration-150 hover:bg-panel-hover"
      >
        <i className="fa-solid fa-arrow-left" aria-hidden="true" />
        Tous les points
      </button>
      <IconButton icon="fa-solid fa-xmark" label="Fermer le panneau" onClick={onClose} />
    </div>
  );
}

/**
 * Fiche d'un point (page droite du panneau desktop, maquette 5a) : nom, type et tronçon, source et heure du relevé,
 * lignes d'état (une, ou une par sens), fermeture annoncée, alternative si le point est fermé, puis historique replié
 * (ou réouverture prévue). `crossings` : tous les points (alternative) ; `updatedAt` : relevé OFROU affiché.
 */
export function CrossingDetail({ c, crossings, updatedAt }) {
  const s = S;
  const now = Date.now();
  const lines = statusLines(c, now);
  const closure = nextClosure(c, now);
  const alt = alternativeOf(c, crossings);
  const reopening = reopeningText(c, now);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className={`flex flex-col gap-1.5 px-4 ${s.head}`}>
        <h3 className={`m-0 font-display ${s.name} leading-[1.15] font-bold text-balance`}>{c.name}</h3>
        <span className="flex flex-col text-[13px] leading-[1.45] text-ink-weak">
          <span>{[c.kind, c.section].filter(Boolean).join(" · ")}</span>
          {/* L'OFROU peut diverger d'autres sources (TCS) : le lecteur doit savoir d'où vient l'état et de quand. */}
          {updatedAt && <span>Selon l'OFROU · {hhmm(updatedAt)}</span>}
        </span>
      </div>
      {lines.map((l, i) => (
        <InfoLine
          key={l.key}
          s={s}
          first={i === 0}
          icon={l.barrier ? <Barrier size={s.barrier} /> : <Dot color={STATUS[l.level].color} size={s.mark} />}
          title={l.title}
          color={titleColor(l.level)}
          text={l.text}
        >
          {l.metrics.length > 0 && <Metrics s={s} items={l.metrics} />}
        </InfoLine>
      ))}
      {closure && (
        <InfoLine
          s={s}
          icon={<i className={`fa-regular fa-moon ${s.glyph}`} style={{ color: STATUS.closed.color }} aria-hidden="true" />}
          title={closure.title}
          color={STATUS.closed.color}
          text={closure.text}
        />
      )}
      {alt && <InfoLine s={s} icon={<i className={`fa-solid fa-route ${s.glyph}`} aria-hidden="true" />} title={alt.title} text={alt.text} />}
      <div className={`mx-4 border-t border-panel-line ${s.foot}`}>
        {reopening ? (
          <p className="m-0 text-[13px] leading-[1.45] text-ink-weak">{reopening}</p>
        ) : (
          <History key={c.id} id={c.id} directions={c.directions} />
        )}
      </div>
    </div>
  );
}

/**
 * Ligne de la fiche mobile : filet haut, colonne icône de 18 px, libellé 14 px gras (et `aside` sur la même ligne),
 * précision dessous en 12,5 px, en segments insécables.
 */
function MobileLine({ icon, title, color, aside, text, children }) {
  return (
    <div className="flex gap-2.5 border-t border-panel-line py-[9px]">
      <span className="flex h-[18px] w-[18px] flex-none items-center justify-center">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] leading-[18px]">
          <strong style={{ color }}>{title}</strong>
          {aside && <span className="text-[12.5px] text-ink-weak"> {aside}</span>}
        </span>
        {text && (
          <span className="text-[12.5px] leading-[1.35] text-ink-weak">
            <Segments parts={segmentsOf(text)} />
          </span>
        )}
        {children}
      </span>
    </div>
  );
}

/**
 * Fiche d'un point dans le panneau bas mobile (maquette 9c), compacte pour laisser le tracé visible au-dessus : nom,
 * type et tronçon (jamais tronqués), bouton fermer ; état avec « · selon l'OFROU, HH:MM » sur la première ligne ;
 * fermeture annoncée ; historique replié (ou réouverture prévue). Pas d'alternative ici (fiche desktop seulement) :
 * le panneau reste compact.
 */
export function MobileDetail({ c, updatedAt, onClose }) {
  const now = Date.now();
  const lines = statusLines(c, now);
  const closure = nextClosure(c, now);
  const reopening = reopeningText(c, now);
  return (
    <div className="flex flex-col px-4 pt-3 pb-1">
      <div className="flex items-start gap-2.5 pb-2.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="m-0 font-display text-[22px] leading-[1.1] font-bold">{c.name}</h3>
          <span className="text-[12.5px] leading-[1.35] text-ink-weak">
            <Segments parts={[c.kind, c.section]} />
          </span>
        </div>
        <RoundButton icon="fa-solid fa-xmark" label="Fermer la fiche" size={32} onClick={onClose} />
      </div>
      {lines.map((l, i) => (
        <MobileLine
          key={l.key}
          icon={l.barrier ? <Barrier size={14} /> : <Dot color={STATUS[l.level].color} size={10} />}
          title={l.title}
          color={titleColor(l.level)}
          // L'OFROU peut diverger d'autres sources (TCS) : le lecteur doit savoir d'où vient l'état et de quand.
          aside={i === 0 && updatedAt ? `· selon l'OFROU, ${hhmm(updatedAt)}` : null}
          text={l.text}
        >
          {l.metrics.length > 0 && <Metrics s={S_MOBILE} items={l.metrics} />}
        </MobileLine>
      ))}
      {closure && (
        <MobileLine
          icon={<i className="fa-regular fa-moon text-[16px] leading-none" style={{ color: STATUS.closed.color }} aria-hidden="true" />}
          title={closure.title}
          color={STATUS.closed.color}
          text={closure.text}
        />
      )}
      <div className="border-t border-panel-line">
        {reopening ? (
          <p className="m-0 py-[9px] text-[12.5px] leading-[1.35] text-ink-weak">{reopening}</p>
        ) : (
          <History key={c.id} id={c.id} directions={c.directions} mobile />
        )}
      </div>
    </div>
  );
}
