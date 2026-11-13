/**
 * Bouton rond du panneau bas mobile (liste, fermer) : fond un cran au-dessus du panneau (`--panel-hover`), icône
 * centrée. `size` : 40 ou 32 px ; sous 44 px, la zone tactile est étendue à 44 px par un pseudo-élément.
 */
export function RoundButton({ icon, label, onClick, size = 40, iconSize = 14 }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`relative inline-flex flex-none cursor-pointer items-center justify-center rounded-full border-none bg-panel-hover text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line-strong ${size < 44 ? "before:absolute before:-inset-1.5 before:content-['']" : ""}`}
      style={{ width: size, height: size }}
    >
      <i className={`${icon} leading-none`} style={{ fontSize: iconSize }} aria-hidden="true" />
    </button>
  );
}
