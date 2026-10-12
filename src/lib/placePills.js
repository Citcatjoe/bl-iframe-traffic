// Placement des pastilles en espace écran (D2, D3, D5, D7).
// 1. Niveau 1 : toujours posés ; s'ils se chevauchent, ils s'écartent (relaxation).
// 2. Secondaires : posés un à un, seulement s'ils ne chevauchent rien et sont dans la vue.

const RELAX_ITERATIONS = 80;
const VIEW_MARGIN_X = 80;
const VIEW_MARGIN_Y = 40;

const levelOf = (it) => it.level || 3;

/**
 * @param {Array<{ id: string, level?: number, x: number, y: number, w: number, h: number }>} items
 *   Candidats déjà filtrés par zoom. `w`/`h` = boîte de collision (taille + marge).
 * @param {{ sel: string|null, wasVisible: (id: string) => boolean, width: number, height: number }} opts
 * @returns Les items posés, avec `x`/`y` éventuellement déplacés (copies).
 */
export function placePills(items, { sel, wasVisible, width, height }) {
  const placed = items
    .filter((it) => levelOf(it) === 1)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((it) => ({ ...it }));

  for (let n = 0; n < RELAX_ITERATIONS; n++) {
    let moved = false;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const A = placed[i];
        const B = placed[j];
        const ox = (A.w + B.w) / 2 - Math.abs(A.x - B.x);
        const oy = (A.h + B.h) / 2 - Math.abs(A.y - B.y);
        if (ox > 0 && oy > 0) {
          moved = true;
          // Poussée sur l'axe du moindre chevauchement
          if (oy <= ox) {
            const d = (oy / 2 + 0.5) * (A.y <= B.y ? -1 : 1);
            A.y += d;
            B.y -= d;
          } else {
            const d = (ox / 2 + 0.5) * (A.x <= B.x ? -1 : 1);
            A.x += d;
            B.x -= d;
          }
        }
      }
    }
    if (!moved) break;
  }

  const hits = (it) =>
    placed.some((q) => Math.abs(it.x - q.x) < (it.w + q.w) / 2 && Math.abs(it.y - q.y) < (it.h + q.h) / 2);

  const rest = items
    .filter((it) => levelOf(it) !== 1)
    .sort(
      (a, b) =>
        (a.id === sel ? -1 : b.id === sel ? 1 : 0) ||
        wasVisible(b.id) - wasVisible(a.id) ||
        levelOf(a) - levelOf(b) ||
        a.id.localeCompare(b.id),
    );

  for (const it of rest) {
    if (it.x < -VIEW_MARGIN_X || it.y < -VIEW_MARGIN_Y || it.x > width + VIEW_MARGIN_X || it.y > height + VIEW_MARGIN_Y) continue;
    if (!hits(it)) placed.push({ ...it });
  }

  return placed;
}
