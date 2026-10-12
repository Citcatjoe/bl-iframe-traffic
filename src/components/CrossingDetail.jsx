import { useState } from "react";
import { DIRS, LEVELS, closureText, dedupeUpcoming, delayText, hhmm, km, mainCounter } from "../format.js";
import { maxQueue, speedsText, styleOf } from "../lib/levels";
import { usePolling } from "../usePolling.js";
import HistoryChart from "./HistoryChart.jsx";
import { LevelChip, counterSpeed, currentMessages, dirSummary } from "./bits.jsx";
import { Button } from "./ui/Button";
import { IconButton } from "./ui/IconButton";

const HISTORY_REFRESH_MS = 180_000;
const HOURS = [6, 12, 24];

function SectionTitle({ children }) {
  return <h4 className="m-0 text-[11px] font-bold tracking-[0.04em] text-ink-weak uppercase">{children}</h4>;
}

/** Chiffre principal : km de bouchon, sinon niveau ; « clear » : vitesses mesurées s'il y en a. */
function Hero({ c }) {
  const st = styleOf(c.level);
  const q = maxQueue(c);
  const speeds = c.level === "clear" ? speedsText(c) : null;
  const big = q != null ? `${km(q)} km` : speeds ?? LEVELS[c.level]?.short;
  const sub = c.level === "clear" ? (speeds ? `${LEVELS.clear.label} · vitesse mesurée${speeds.includes("/") ? " ↓ / ↑" : ""}` : null) : LEVELS[c.level]?.label;
  return (
    <div className="flex items-center gap-3">
      <i className={`fa-solid ${st.icon} w-[34px] text-center text-[28px]`} style={{ color: st.color }} aria-hidden="true" />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="font-display text-[34px] leading-none font-bold">{big}</span>
        {sub && <strong className="text-[13px] leading-[1.3]">{sub}</strong>}
      </span>
    </div>
  );
}

function Direction({ dir, d, countersKnown }) {
  const figs = [d.queue_km != null ? `${km(d.queue_km)} km` : null, delayText(d), d.since && d.level !== "clear" ? `depuis ${hhmm(d.since)}` : null].filter(Boolean);
  const main = mainCounter(d);
  const sp = counterSpeed(main);
  const others = (d.counters ?? []).filter((k) => !k.main);
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-line px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[14px] font-bold">
          <span aria-hidden="true">{DIRS[dir].arrow} </span>
          {d.label}
        </span>
        <LevelChip level={d.level} />
      </div>
      {figs.length > 0 && <p className="m-0 text-[13px] leading-[1.35]">{figs.join(" · ")}</p>}
      {countersKnown && d.counters ? (
        <>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[22px] leading-none font-bold whitespace-nowrap">{sp.big}</span>
            <span className="text-[12px] text-ink-weak">
              {main?.name ?? "Compteur"}
              {main?.measured_at ? ` · mesuré à ${hhmm(main.measured_at)}` : ""}
            </span>
          </div>
          {sp.note && <p className="m-0 text-[12px] text-ink-weak">{sp.note}</p>}
          {others.length > 0 && (
            <p className="m-0 text-[12px] text-ink-weak">
              {others.map((k) => `${k.name} ${k.speed_light != null ? `${k.speed_light} km/h` : "–"}`).join(" · ")}
            </p>
          )}
        </>
      ) : (
        <p className="m-0 text-[12px] text-ink-weak">Mesures des compteurs indisponibles</p>
      )}
    </div>
  );
}

function PassStatus({ pass, countersKnown }) {
  const sp =
    countersKnown && pass.counters
      ? [["↓", pass.counters.S], ["↑", pass.counters.N]].filter(([, r]) => r?.speed_light != null).map(([a, r]) => `${a} ${r.speed_light}`)
      : [];
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-surface-weak px-3 py-2.5">
      <span className="flex min-w-0 flex-col gap-0.5">
        <strong className="text-[13px]">{pass.label}</strong>
        {sp.length > 0 && <span className="text-[12px] text-ink-weak">{sp.join(" · ")} km/h mesurés</span>}
      </span>
      {pass.closed ? <LevelChip level="closed" /> : <span className="text-[12px] font-bold text-ink-weak">Aucune fermeture signalée</span>}
    </div>
  );
}

function History({ id, directions, small }) {
  const [hours, setHours] = useState(12);
  const h = usePolling(`/api/history?point=${id}&hours=${hours}`, HISTORY_REFRESH_MS);
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>{hours} dernières heures</SectionTitle>
        {!small && (
          <div className="flex items-center gap-1" role="group" aria-label="Période">
            {HOURS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={n === hours}
                onClick={() => setHours(n)}
                className={`cursor-pointer border-none bg-transparent px-1.5 py-1 font-body text-[12px] font-bold whitespace-nowrap decoration-2 underline-offset-4 ${n === hours ? "text-ink underline" : "text-ink-weak no-underline hover:text-ink"}`}
              >
                {n} h
              </button>
            ))}
          </div>
        )}
      </div>
      {h.data?.hours === hours ? (
        <HistoryChart data={h.data} small={small} directions={directions} />
      ) : (
        <p className="m-0 py-4 text-center text-[12px] text-ink-weak">{h.error ?? "Chargement de l'historique…"}</p>
      )}
    </section>
  );
}

/** Fiche complète d'une traversée (page droite du panneau). */
export function CrossingDetail({ c, countersKnown, small }) {
  const messages = currentMessages(c);
  const upcoming = dedupeUpcoming(c.upcoming);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-4 pt-[18px] pb-4">
      <div className="flex flex-col gap-[5px]">
        <span className="text-[11px] font-bold tracking-[0.04em] text-ink-brand uppercase">{c.kind}</span>
        <h3 className="m-0 font-display text-[28px] leading-[1.1] font-bold text-balance">{c.name}</h3>
      </div>
      <Hero c={c} />
      <div className="flex flex-col gap-2">
        {["S", "N"].map((k) => (
          <Direction key={k} dir={k} d={c.directions[k]} countersKnown={countersKnown} />
        ))}
      </div>
      {c.pass && <PassStatus pass={c.pass} countersKnown={countersKnown} />}
      {messages.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle>En ce moment</SectionTitle>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {messages.map((m) => (
              <li key={m.key} className="border-l-[3px] pl-2.5 text-[13px] leading-[1.4]" style={{ borderColor: styleOf(m.level).color }}>
                {m.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      {upcoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionTitle>Prochaines fermetures</SectionTitle>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] leading-[1.4]">
            {upcoming.map((m) => (
              <li key={m.situation_id + m.next_start}>{closureText(m)}</li>
            ))}
          </ul>
        </section>
      )}
      <History key={c.id} id={c.id} directions={c.directions} small={small} />
    </div>
  );
}

/** Fiche compacte sous la carte (mobile, 168 px) : lisible sans interaction. */
export function CrossingDock({ c, onClose, onDetails }) {
  const lines = ["S", "N"].map((k) => dockLine(k, c.directions[k]));
  return (
    <section aria-label={`Traversée ${c.name}`} className="order-3 flex h-[168px] flex-none flex-col gap-2 border-t border-line bg-surface px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span className="truncate text-[10.5px] font-bold tracking-[0.04em] text-ink-brand uppercase">{c.kind}</span>
          <span className="flex min-w-0 items-center gap-2">
            <h3 className="m-0 truncate font-display text-[20px] leading-[1.1] font-bold">{c.name}</h3>
            <LevelChip level={c.level} />
          </span>
        </div>
        <IconButton icon="fa-solid fa-xmark" color="grey" label="Fermer" onClick={onClose} />
      </div>
      <div className="flex min-h-0 flex-col gap-0.5 text-[12.5px] leading-[1.35]">
        {lines.map((t) => (
          <span key={t} className="truncate">
            {t}
          </span>
        ))}
      </div>
      <div className="mt-auto">
        <Button color="black" iconRight="fa-solid fa-arrow-right" onClick={onDetails}>
          Détails
        </Button>
      </div>
    </section>
  );
}

/** Une ligne par sens : résumé + vitesse mesurée du compteur principal. */
function dockLine(dir, d) {
  const v = mainCounter(d)?.speed_light;
  const base = d.level === "clear" ? `${dirSummary(dir, d)} · ${LEVELS.clear.short}` : dirSummary(dir, d);
  return v != null ? `${base} · ${v} km/h mesurés` : base;
}

/** Mobile sans sélection : liste compacte des traversées sous la carte. */
export function CrossingStrip({ crossings, onSelect, onOpen }) {
  return (
    <section aria-label="Traversées alpines" className="order-3 flex h-[168px] flex-none flex-col border-t border-line bg-surface">
      <div className="flex flex-none items-center justify-between py-1 pr-2 pl-4">
        <span className="text-[11px] font-bold tracking-[0.04em] text-ink-weak uppercase">{crossings.length} traversées · par gravité</span>
        <IconButton icon="fa-solid fa-list" label="Voir la liste détaillée" onClick={onOpen} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {crossings.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className="flex h-[31px] w-full cursor-pointer items-center justify-between gap-2 border-t border-line bg-transparent px-4 text-left font-body text-ink"
          >
            <span className="truncate font-display text-[14px] font-bold">{c.name}</span>
            <span className="flex flex-none items-center gap-2">
              {c.level === "clear" && speedsText(c) && <span className="text-[12px] text-ink-weak">{speedsText(c)}</span>}
              <LevelChip level={c.level} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
