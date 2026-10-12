import { hhmm } from "../format.js";

const DOT = { ok: "bg-ok", error: "bg-brand", loading: "bg-line" };
const TITLE_SIZE = { wide: "text-[26px]", mid: "text-[22px]", mobile: "text-[18px]" };

export function Header({ mode, status, time }) {
  const mobile = mode === "mobile";
  const stamp =
    status === "ok"
      ? `${mobile ? "Direct" : "Trafic en direct"}${time ? ` · ${hhmm(time)}` : ""}`
      : status === "error"
        ? mobile ? "Indisponible" : "Trafic indisponible"
        : "Chargement…";

  return (
    <header className={`flex flex-none flex-col gap-[5px] border-b border-line ${mobile ? "px-3.5 pt-[9px] pb-2" : "px-4 pt-3 pb-[11px]"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[11px] leading-none font-bold tracking-[0.04em] whitespace-nowrap text-ink-brand uppercase">
          Trafic · Traversées alpines
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] leading-none font-medium whitespace-nowrap text-ink-weak" aria-live="polite">
          <span className={`size-[7px] rounded-full ${DOT[status]}`} aria-hidden="true" />
          {stamp}
        </span>
      </div>
      <h2 className={`m-0 truncate font-display leading-[1.1] font-bold ${TITLE_SIZE[mode]}`}>Par où passer les Alpes ?</h2>
    </header>
  );
}
