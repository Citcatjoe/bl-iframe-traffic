// Reproduction du `Button` du Blick Design System (taille sm : 36 px, pill).
// Rendu en <a> quand `href` est fourni (lien sortant).

const COLORS = {
  red: 'bg-brand text-ink-inverse hover:bg-brand-hover',
  black: 'bg-inverse text-ink-inverse hover:bg-inverse-hover',
};

export function Button({ color = 'red', iconLeft, iconRight, href, children, className = '', ...props }) {
  const cls = `inline-flex h-9 items-center gap-2 rounded-pill px-3.5 text-sm font-bold leading-none whitespace-nowrap transition-colors duration-150 no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line-strong disabled:cursor-not-allowed disabled:opacity-40 ${COLORS[color]} ${className}`;
  const content = (
    <>
      {iconLeft && <i className={`${iconLeft} text-[13px]`} aria-hidden="true" />}
      {children}
      {iconRight && <i className={`${iconRight} text-[12px]`} aria-hidden="true" />}
    </>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...props}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={`cursor-pointer ${cls}`} {...props}>
      {content}
    </button>
  );
}
