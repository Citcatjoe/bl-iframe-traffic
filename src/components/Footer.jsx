import { DATA_CREDIT, MAP_CREDITS } from "../config/credits";

/**
 * Crédits sous la carte (mode explore), allégés : 10,5 px / 1.4, graisse normale, `text-weak`, filet haut, sans fond
 * ni retrait latéral. Texte continu, sans retour à la ligne forcé ; liens de la couleur du texte, soulignés.
 */
export function Footer() {
  const credits = [{ text: DATA_CREDIT }, ...MAP_CREDITS];
  return (
    <footer className="flex-none border-t border-line pt-[7px] pb-2 text-[10.5px] leading-[1.4] font-normal text-ink-weak">
      {credits.map(({ text, href }, i) => (
        <span key={text}>
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-inherit underline">
              {text}
            </a>
          ) : (
            text
          )}
          {i < credits.length - 1 && " · "}
        </span>
      ))}
    </footer>
  );
}
