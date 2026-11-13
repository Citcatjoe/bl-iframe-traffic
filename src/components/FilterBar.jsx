import { useEffect, useRef, useState } from "react";
import { FILTERS } from "../lib/filters.js";
import { Dot } from "./PointRow.jsx";

const ALL = { id: null, label: "Tous les points" };

function Mark({ f }) {
  if (f.icon) return <i className={`fa-solid ${f.icon} w-[9px] text-[10px]`} aria-hidden="true" />;
  if (f.color) return <Dot color={f.color} />;
  return <span className="w-[9px]" aria-hidden="true" />;
}

/**
 * Tête de la liste (mode explore) : menu déroulant à choix unique, à la taille de son contenu.
 * Chaque option indique le nombre de points concernés. `action` : bouton à droite (fermer, ouvrir la liste).
 * `dropUp` : barre en bas du widget (mobile, sous la carte) : le menu s'ouvre vers le haut, sans filet bas.
 * `mobile` : menu sur fond `fill-strong` (barre et panneau y sont en `fill-weak`) ; sinon menu sur le fond de page.
 * Le déclencheur reste transparent partout (pas un champ : un menu).
 */
export function FilterBar({ crossings, value, onChange, action = null, dropUp = false, mobile = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const options = [ALL, ...FILTERS];
  const current = options.find((o) => o.id === value) ?? ALL;
  const count = (o) => (o.test ? crossings.filter(o.test).length : crossings.length);

  useEffect(() => {
    if (!open) return undefined;
    menuRef.current?.querySelector('[aria-checked="true"]')?.focus();
    const away = (e) => rootRef.current?.contains(e.target) || setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const pick = (id) => {
    onChange(id);
    close();
  };
  const onKey = (e) => {
    const items = [...menuRef.current.querySelectorAll('[role="menuitemradio"]')];
    const i = items.indexOf(document.activeElement);
    if (e.key === "Escape" || e.key === "Tab") close();
    else if (e.key === "ArrowDown") items[(i + 1) % items.length].focus();
    else if (e.key === "ArrowUp") items[(i - 1 + items.length) % items.length].focus();
    else if (e.key === "Home") items[0].focus();
    else if (e.key === "End") items.at(-1).focus();
    else return;
    e.preventDefault();
  };

  return (
    <div ref={rootRef} className={`relative flex h-[52px] flex-none items-center justify-between gap-2 pr-2 pl-1.5 ${dropUp ? "" : "border-b border-panel-line"}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Filtrer les points : ${current.label}`}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-10 cursor-pointer items-center gap-2 rounded-pill border-none px-2.5 font-body text-sm font-bold text-ink transition-colors duration-150 hover:bg-panel-hover ${open ? "bg-panel-hover" : "bg-transparent"}`}
      >
        {current.id && <Mark f={current} />}
        {current.label}
        <span className="font-normal text-ink-weak">{count(current)}</span>
        <i className={`fa-solid fa-chevron-down text-[10px] transition-transform duration-150 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {action}

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Filtrer les points"
          onKeyDown={onKey}
          className={`absolute ${dropUp ? "bottom-[46px]" : "top-[46px]"} ${mobile ? "bg-surface-strong" : "bg-surface"} left-1.5 z-10 flex w-max flex-col rounded-lg py-1.5 shadow-menu`}
        >
          {options.map((o) => {
            const on = o.id === current.id;
            return (
              <button
                key={o.label}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                tabIndex={-1}
                onClick={() => pick(o.id)}
                className={`grid h-9 cursor-pointer grid-cols-[12px_auto_1fr_12px] items-center gap-2 border-none bg-transparent px-3 text-left font-body text-sm text-ink focus-visible:outline-none ${mobile ? "hover:bg-menu-strong-hover focus-visible:bg-menu-strong-hover" : "hover:bg-surface-weak focus-visible:bg-surface-weak"}`}
              >
                <Mark f={o} />
                <span className={on ? "font-bold" : ""}>{o.label}</span>
                <span className="pl-3 text-right text-ink-weak">{count(o)}</span>
                {on ? <i className="fa-solid fa-check text-[11px]" aria-hidden="true" /> : <span />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
