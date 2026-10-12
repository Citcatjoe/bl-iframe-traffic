# Étape 0 : ce que contient vraiment le flux (relevés du 08.10.2026, 15:44 – 16:00)

Dump brut : `npm run traversees -- --dump data/raw.xml` (≈ 13 Mo non compressé). Extraits réels dans `test/fixtures/sample.xml`.

## Volume et structure

- 858 → 861 *situations*, 3 123 `situationRecord` (≈ 3,6 records par situation). Fournisseur : `FEDRO`.
- **Unité utile = la situation**, pas le record : le texte public (`commentType=description`) n'est porté que
  par le premier record ; les suivants décrivent cause, gestion du trafic, chantier… Le script de départ
  (un message par record) produisait donc 3 123 lignes presque toutes sans texte.
- Chaque feuille porte un `xsi:type` → avec fast-xml-parser, les valeurs sont des objets `{ "#text", "@type" }`
  (d'où les `[object Object]` du script de départ).
- Les messages **levés restent dans le flux** : 12 à 14 situations commencent par `Aufgehoben:` / `Révoqué:`,
  avec `validityStatus=active`. À filtrer (`status: "cancelled"`).
- `overallStartTime` ≈ heure de saisie. La fenêtre effective est dans `validPeriod` (ex. fermeture de col
  saisie à 11:44 pour 18:00 → 08:00).

## Champs effectivement remplis (sur 3 123 records)

| Champ | Remplissage | Commentaire |
|---|---|---|
| description DE / FR / IT | 100 % des situations | texte généré, structure fixe (ci-dessous) |
| `alertCDirectionCoded` | 2 989 | `both` / `positive` / `negative` |
| ALERT-C `specificLocation` | 2 989 | codes TMC ; la table de localisation n'est pas dans le flux |
| `lengthAffected` | 1 020 | surtout longueur de **chantier** ; longueur de bouchon : 2 bouchons sur 39 |
| `abnormalTrafficType` | 861 | `stationaryTraffic` (bouchon) 16, `queuingTraffic` (ralentissement) 18, `other` 827 |
| `delayTimeValue` | 2 à 3 | temps perdu structuré, très rare |
| `queueLength` | 0 | jamais présent |
| `severity` | 0 | jamais présent |
| coordonnées (TPEG) | 134 | minoritaires |

## Textes réels

Gothard, au moment du relevé (tunnel fermé pour un poids lourd en panne) :

```
Libéré: A2 Lucerne -> St-Gothard entre Jonction autoroutière Amsteg et Jonction autoroutière Göschenen
  Situation: bouchon longueur [km] 4.0 Raison: surcharge de trafic
Libéré: A2 Chiasso -> St-Gothard entre Jonction autoroutière Quinto et Parking Aire de dosage Airolo
  Situation: bouchon longueur [km] 5 Raison: surcharge de trafic
Libéré: A2 Chiasso <-> St-Gothard Tunnel Tunnel du St-Gothard, au kilomètre 11.43
  Situation: tunnel fermé Raison: véhicule en panne poids lourd en panne
```

Autres exemples sur l'A2 :

```
Libéré: A2 Bâle -> Lucerne entre Echangeur Echangeur d'Augst et Jonction autoroutière Sissach, au kilomètre 22.7
  Situation: bouchon Raison: accident Gestion du trafic: rétrécissement des voies Complément 1: retards Nbre. [min] 45
Libéré: A2 Chiasso <-> St-Gothard entre Jonction autoroutière Biasca et Jonction autoroutière Quinto
  Situation: trafic perturbé travaux, longueur [km] 25.5 Gestion du trafic: rétrécissement des voies …
```

Structure fixe : `<Statut>: <route> <origine> ->|<-> <destination> <lieu> Situation: … [longueur [km] N] Raison: … [Complément n: …] [Durée: …]`.
En DE : `Sachlage:`, `Länge [km]`, `Ursache:`, `Zusatz 1: Zeitverlust Anz. [min] 45`. Défaut de la source : apostrophes doublées (`jusqu''à`).

## Ajustements faits

- **Filtre Gothard** : « Gotthard / St-Gothard » est le *nom d'itinéraire* de toute l'A2 (« A2 Basel -> Gotthard »).
  Le filtre par mots-clés du script de départ retenait 71 situations, de Bâle à Chiasso. Désormais on lit l'en-tête DE
  (A2/H2 + extrémités connues), et les mots-clés (Erstfeld, Amsteg, Gurtnellen, Wassen, Göschenen, Gotthard-Tunnel,
  Airolo, Quinto, Faido, col…) ne sont cherchés que dans la partie *lieu* : 27 situations retenues, toutes dans le corridor.
- **km** : `lengthAffected` du record bouchon, sinon `Länge [km] N` / `longueur [km] N`, **uniquement si le message est
  un bouchon** (sinon c'est la longueur du chantier).
- **Temps perdu** : `delayTimeValue`, sinon `Zeitverlust Anz. [min] N` / `retards Nbre. [min] N`. Les formes libres
  du script de départ (« Zeitverlust bis zu 2 Stunden ») sont gardées en dernier recours, mais n'ont pas été observées.

## Fiabilité

- **Sens : fiable.** La flèche du texte (`Luzern -> Gotthard` = nord → sud, `Chiasso -> Gotthard` = sud → nord)
  et `alertCDirectionCoded` concordent dans **112 cas sur 112** sur l'A2/H2 (`negative` = vers le sud, `positive` = vers le nord),
  et `<->` correspond toujours à `both` (51/51). Le texte est utilisé en priorité, ALERT-C en repli. Cette correspondance
  positive/negative a été vérifiée sur l'A2 seulement : ne pas la généraliser à d'autres routes sans contrôle.
- **km : fiable quand présent, souvent absent.** Les deux bouchons du Gothard avaient la longueur (structurée et texte
  concordants : 4000 m ↔ « 4.0 »), probablement parce que ces messages sont enrichis par Viasuisse
  (`providerIdentifier`). 37 bouchons sur 39 ailleurs en Suisse n'en ont pas. La valeur est arrondie (5 km, pas 5,3).
- **Temps perdu : peu fiable / rare.** 3 messages sur 861, aucun au Gothard lors de ces relevés (alors que le
  tunnel était fermé). Le widget affiche « Temps perdu non communiqué ». Les attentes de type « 2 h au portail
  nord », qu'on lit en été, ne sont pas apparues dans ce flux : à revérifier un week-end chargé.
- **Fraîcheur** : `situationRecordVersionTime` évolue (la version 14 → 15 du bouchon nord est passée de 4 à 5 km
  entre deux relevés), donc l'historique archivé est exploitable. `publicationTime` correspond à l'heure de la requête.
- **Non vérifié** : comportement les jours de très forte affluence (Pâques, été), formulations en cas de dosage
  au portail sans bouchon, messages `slowTraffic`.
