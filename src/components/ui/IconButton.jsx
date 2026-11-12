// Reproduction de l'`IconButton` du Blick Design System (taille sm : 36 × 36, rond).

const COLORS = {
  // Contrôles posés sur la carte : mêmes fonds que les pastilles (blanc en clair, gris très foncé en sombre).
  map: 'bg-map-control text-ink shadow-control hover:bg-map-control-hover',
  // Boutons du panneau liste / fiche : fonds relatifs au panneau (voir --panel-hover).
  grey: 'bg-panel-hover text-ink hover:bg-surface-strong',
  transparent: 'bg-transparent text-ink hover:bg-panel-hover',
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
