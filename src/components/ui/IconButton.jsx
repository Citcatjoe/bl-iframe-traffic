// Reproduction de l'`IconButton` du Blick Design System (taille sm : 36 × 36, rond).

const COLORS = {
  white: 'bg-[var(--color-static-white)] text-[var(--color-static-black)] shadow-control hover:bg-[var(--color-static-neutral-100)]',
  grey: 'bg-surface-weak text-ink hover:bg-surface-strong',
  transparent: 'bg-transparent text-ink hover:bg-surface-weak',
};

export function IconButton({ icon, color = 'transparent', label, className = '', ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-9 flex-none cursor-pointer items-center justify-center rounded-pill text-[15px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-line-strong ${COLORS[color]} ${className}`}
      {...props}
    >
      <i className={icon} aria-hidden="true" />
    </button>
  );
}
