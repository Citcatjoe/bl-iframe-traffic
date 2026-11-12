import { DATA_CREDIT, MAP_CREDITS } from "../config/credits";

/**
 * Pied de page (légende) du mode explore : tous les crédits, rien en surimpression sur la carte, fond `fill-weak` et
 * petit retrait intérieur comme l'en-tête. Un texte qui passe à la ligne entre deux crédits (chacun d'un bloc, le point
 * médian reste en fin de ligne) ; seule la source OFROU, trop longue pour un mobile, peut se couper.
 */
export function Footer() {
  const credits = [{ text: DATA_CREDIT, wrap: true }, ...MAP_CREDITS];
  return (
    <footer className="flex-none border-t border-line bg-surface-weak px-3 py-1.5 text-[10.5px] leading-[1.4] text-ink-weak">
      {credits.map(({ text, href, wrap }, i) => (
        <span key={text}>
          <span className={wrap ? undefined : "whitespace-nowrap"}>
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-inherit no-underline hover:underline">
                {text}
              </a>
            ) : (
              text
            )}
            {i < credits.length - 1 && " ·"}
          </span>{" "}
        </span>
      ))}
    </footer>
  );
}
