import { useLayoutEffect, useState } from 'react';

// Trois largeurs d'iframe cibles : 964 px (largeur max), 632 px (colonne d'article,
// slot de homepage ou de page de rubrique) et mobile (< 400 px en pratique).
// Seuils à mi-chemin entre les cibles, pour tolérer les écarts réels
// (téléphones de 412 à 440 px, iframe un peu plus étroite que sa colonne…).

/** Largeur maximale du widget : au-delà, il reste à 964 px, centré. */
export const MAX_WIDTH = 964;

/** Largeur → mode de layout : wide ≥ 860 (cible 964), mid ≥ 520 (cible 632), sinon mobile. */
export const modeFor = (w) => (w >= 860 ? 'wide' : w >= 520 ? 'mid' : 'mobile');

/**
 * Hauteur fixe de l'iframe en 964 et 632 px. Mobile : pas de hauteur fixe ; zone carte (mobileMapHeight) + crédits,
 * hauteur ajustée par iframeHeightAdjustment.js comme le mode compact.
 */
export const HEIGHT = { wide: 600, mid: 500 };

/**
 * Mobile : hauteur de la zone carte, entre l'en-tête et les crédits, panneau bas compris (posé sur la carte). Garde la
 * hauteur de l'ancienne mise en page : carte en 4:3 + barre de filtre de 53 px dessous.
 */
export const mobileMapHeight = (width) => Math.round((width * 3) / 4) + 53;

/** Largeur observée d'un élément (celle de l'iframe, plafonnée à MAX_WIDTH). */
export function useWidth(ref) {
  const [width, setWidth] = useState(() => (typeof window !== 'undefined' ? Math.min(window.innerWidth, MAX_WIDTH) : MAX_WIDTH));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return width;
}
