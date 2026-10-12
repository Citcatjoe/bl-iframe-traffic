import { LevelChip, crossingLines } from "./bits.jsx";

export function CountBar({ count }) {
  return (
    <div className="flex flex-none items-center justify-between gap-2 px-4 pt-1 pb-2">
      <span className="text-[11px] font-bold tracking-[0.04em] whitespace-nowrap text-ink-weak uppercase">
        {count} {count === 1 ? "traversée" : "traversées"} · par gravité
      </span>
    </div>
  );
}

/** Liste des traversées, déjà triée par gravité. */
export function CrossingList({ crossings, sel, onSelect, onHover }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto border-t border-line">
      {crossings.map((c) => {
        const active = c.id === sel;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            onMouseEnter={onHover && (() => onHover(c.id))}
            onMouseLeave={onHover && (() => onHover(null))}
            aria-current={active || undefined}
            className={`flex w-full cursor-pointer flex-col gap-1 border-b border-line px-4 py-3 text-left font-body text-ink transition-colors duration-150 hover:bg-surface-weak ${active ? "bg-surface-weak" : "bg-transparent"}`}
          >
            <span className="flex w-full items-center justify-between gap-3">
              <span className="flex min-w-0 flex-col gap-px">
                <span className={`font-display text-base leading-[1.2] font-bold ${active ? "text-ink-brand" : ""}`}>{c.name}</span>
                <span className="truncate text-[12px] leading-[1.2] text-ink-weak">{c.kind}</span>
              </span>
              <LevelChip level={c.level} />
            </span>
            {crossingLines(c).map((t) => (
              <span key={t} className="text-[12.5px] leading-[1.35] text-ink">
                {t}
              </span>
            ))}
          </button>
        );
      })}
      {crossings.length === 0 && <p className="m-0 px-4 py-5 text-sm text-ink-weak">Pas encore de données.</p>}
    </div>
  );
}
