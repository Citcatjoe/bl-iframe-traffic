/**
 * Crédits des données exploitées, sous le widget (détail des licences : LICENCES.md). Les bibliothèques (React,
 * MapLibre, Font Awesome…) ne sont pas créditées dans la légende.
 */

/** Conditions d'utilisation de l'OFROU, § 11 : formule imposée, au mot près. Seule source du mode compact. */
export const DATA_CREDIT = "Source des données : Plateforme de données sur le trafic (PDT) OFROU";

/**
 * Mode explore : ce que la carte ajoute. Au plus court : « OpenFreeMap » est facultatif (exigé : © OpenMapTiles et
 * OpenStreetMap, avec un lien vers sa page de droits) ; OpenStreetMap couvre aussi le tracé du col du Gothard.
 * Relief (tuiles Terrarium) : Mapzen et les sources d'altitude de la région (EU-DEM, SRTM et GMTED2010 de l'USGS).
 */
export const MAP_CREDITS = [
  { text: "Tracés : ASTRA" },
  { text: "Carte : © OpenMapTiles © OpenStreetMap, swisstopo", href: "https://www.openstreetmap.org/copyright" },
  { text: "Relief : Mapzen, EU-DEM, USGS" },
];
