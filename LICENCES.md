# Sources, API et licences (état au 02.11.2026)

Inventaire des données, services et briques tiers du widget, avec ce qu'ils autorisent pour un usage commercial
(Blick), ce qu'ils exigent et ce que le widget fait pour s'y conformer. Ce n'est pas un avis juridique : les
conditions citées sont celles en ligne à cette date ; en cas de doute, la version officielle fait foi.
*[interprétation]* marque une lecture des textes, pas une clause explicite.

## Légende sous le widget

Seules les **données exploitées** sont créditées ; les bibliothèques (React, MapLibre, Font Awesome…) ne le sont pas
(décision du 02.11.2026). Textes dans `src/config/credits.js`.

| Mode | Crédits |
|---|---|
| explore (carte) | Source des données : Plateforme de données sur le trafic (PDT) OFROU · Tracés : ASTRA · Carte : © OpenMapTiles © OpenStreetMap, swisstopo · Relief : Mapzen, EU-DEM, USGS |
| compact (sans carte) | Source des données : Plateforme de données sur le trafic (PDT) OFROU |

Le mode compact n'exploite que les données OFROU (ni tracés, ni fond de carte, ni relief, ni frontière) : un seul
crédit. « © OpenStreetMap » renvoie vers openstreetmap.org/copyright. En mobile, la légende du mode explore tient sur
quatre lignes : la hauteur de l'iframe est passée de 384 à 400 px pour garder la carte à ≈ 235 px.

## Vue d'ensemble

| Source | Utilisée pour | Usage commercial | Obligations principales | Conforme ? |
|---|---|---|---|---|
| OFROU, plateforme de données sur le trafic (PDT), via opentransportdata.swiss | messages trafic et compteurs, en continu (poller du VPS) ; les deux modes | oui *[interprétation : aucune restriction, données « utilisables par tous »]* | citer la source avec la formule imposée ; pas de données brutes redistribuées par interface machine ; accès 6 mois renouvelable | oui depuis le 02.11.2026 (§ 1) |
| ASTRA, couches ArcGIS Online `BS_AXIS` et `SVZ_2022` | tracés des axes et position des postes de comptage, figés par `npm run geo` | inconnu | inconnues (aucune licence dans les métadonnées du service) | crédité ; licence à vérifier |
| OpenStreetMap, via Overpass | tracé du col du Gothard, figé par `npm run geo` | oui | crédit OpenStreetMap ; base dérivée publiée sous ODbL | oui (crédit commun avec le fond de carte) |
| OpenFreeMap (tuiles et styles Positron, Dark) | fond de carte, appelé par chaque lecteur | oui, gratuit, sans limite | « © OpenMapTiles » et « OpenStreetMap » | oui |
| Tuiles de relief Terrarium (AWS Open Data, ex-Mapzen) | relief ombré, appelé par chaque lecteur | oui | crédits des sources d'altitude | oui depuis le 02.11.2026 (§ 4) |
| swisstopo swissBOUNDARIES3D | frontière : trame hors Suisse, filtre des localités | oui | citer la source | oui depuis le 02.11.2026 (§ 5) |
| Bibliothèques npm | code du widget et du serveur | oui | conserver les avis de licence | pas créditées dans la légende (décision) ; voir § 6 |
| Polices et shell Blick | typographie, `base.css`, `iframeHeightAdjustment.js` | usage Blick uniquement | propriété Ringier | oui (projet Blick) |

## 1. OFROU : messages trafic et compteurs

- **Produits** : « Road traffic – traffic situations » et « Road traffic – traffic counters » (DATEX II, SOAP),
  `api.opentransportdata.swiss`. Clé gratuite (README § 1).
- **Accès** :
  - application créée le **08.10.2026 à 13:39** sur
    [api-manager.opentransportdata.swiss](https://api-manager.opentransportdata.swiss/portal/private/dashboard)
    (tableau de bord : application, abonnements, clés) ;
  - identifiants gérés par le gestionnaire de mots de passe de l'entreprise ; clés dans `.env` (chiffré par
    git-crypt) et `/srv/bl-iframe-traffic/.env` sur le VPS ;
  - **fin de l'accès : vers le 08.04.2027** *[calcul : 6 mois après la création ; date exacte à lire sur le
    tableau de bord]*. La clé dédiée aux compteurs date du 12.10.2026 : si elle vient d'un autre abonnement, son
    échéance tombe vers le 12.04.2027 ;
  - prolongation : demande écrite et motivée (usage éditorial continu pour Blick) à
    verkehrsdaten-plattform@astra.admin.ch, **à envoyer vers mi-mars 2027**. Sans prolongation, le poller reçoit une
    erreur `AUTH` et le widget reste figé sur le dernier relevé.
- **Conditions** : [conditions d'utilisation de l'OFROU](https://opentransportdata.swiss/fr/tac-fedro/) (état
  juin 2026). Les [conditions générales](https://opentransportdata.swiss/en/terms-of-use/) de la plateforme ne
  s'appliquent qu'aux données qui ne viennent pas de l'OFROU.
- **Ce qui est permis** : « les données peuvent être traitées, analysées, publiées et complétées » (§ 1) ; données
  « accessibles et utilisables par tous » (§ 4.1) ; usage mondial (§ 5.2). Aucune clause n'exclut l'usage commercial.
- **Obligations et limites** :
  - **Citation imposée (§ 11)** pour toute publication fondée sur ces données : « Source des données : Plateforme de
    données sur le trafic (PDT) OFROU » (en anglais : « Data source: Federal Roads Office (FEDRO) Traffic Data
    Platform (TDP) »).
  - **Pas de redistribution brute (§ 8)** : « il est interdit de transmettre les données en format brut à des tiers
    via une interface lisible par machine ». Les droits restent au fournisseur des données.
  - **Durée (§ 6.1)** : accès limité à 6 mois, prolongeable sur demande motivée
    (verkehrsdaten-plattform@astra.admin.ch).
  - **Pas de profilage (§ 6.4)** : interdit de combiner les données pour créer des profils de comportement ou
    réidentifier des usagers. Le widget ne le fait pas.
  - **Aucune garantie (§ 13)** : ni exactitude, ni actualité, ni disponibilité ; les risques de l'application sont à
    la charge de l'utilisateur. D'où « Selon l'OFROU · HH:MM » et « Aucun message de l'OFROU » dans la fiche.
  - L'OFROU peut retirer l'accès avec effet immédiat en cas de violation (§ 6.4).
- **Mise en conformité du 02.11.2026** :
  - **Crédit** : la formule du § 11, au mot près, sous les deux modes et dans le champ `source` de l'API (avant :
    « Source : OFROU / opentransportdata.swiss »).
  - **`/api/messages` coupé en production** (404 `DISABLED` si `NODE_ENV=production`, le cas du service systemd).
    Il servait publiquement les messages parsés des points suivis (120 Ko) et, avec `?all=1`, tout le flux OFROU
    parsé (1 Mo), ce qui ressemble à la redistribution interdite par le § 8. Il reste disponible en local (debug,
    `?debug=1`). `/api/now` et `/api/history` servent un état calculé pour dix points, ce qui relève du
    « traitement » permis *[interprétation]*.

## 2. ASTRA : tracés et postes de comptage

- **Couches** : `BS_AXIS` (axes routiers ; couche 3 routes nationales, couche 2 routes cantonales) et `SVZ_2022`
  (postes du comptage routier, état mars 2022), sur `services3.arcgis.com/IXAVBLfeIsfhE7s9`, sans clé. Lues une
  seule fois par `scripts/build-geo.mjs` ; le résultat est figé dans `public/data/traffic-geo.json`, livré avec le
  widget.
- **Licence** : aucune mention de licence ni de copyright dans les métadonnées des deux services (vérifié le
  01.11.2026). Les données de la Confédération sont en général en « open use, citer la source », mais ce n'est pas
  confirmé pour ces couches *[à vérifier auprès de l'ASTRA ou sur opendata.swiss]*.
- **Crédit** : « Tracés : ASTRA » (légende) et champ `source` de `traffic-geo.json`.

## 3. OpenStreetMap : col du Gothard

- **Source** : route principale 2 entre Airolo et Hospental, via les API publiques Overpass (`overpass-api.de` et
  miroirs), une seule fois par `scripts/build-geo.mjs`.
- **Licence** : [ODbL](https://www.openstreetmap.org/copyright). Usage commercial permis. Obligations :
  - créditer OpenStreetMap à côté de la carte, avec un lien vers openstreetmap.org/copyright ;
  - toute base de données dérivée utilisée publiquement reste sous ODbL. `traffic-geo.json` le signale dans son
    champ `source`.
- **Crédit** : « © OpenStreetMap » de la légende (lien vers la page de droits), commun au fond de carte : la
  légende ne le répète pas après « Tracés ».

## 4. Fond de carte

### OpenFreeMap

- **Service** : styles `tiles.openfreemap.org/styles/positron` (clair) et `/dark` (sombre), tuiles vectorielles,
  polices des étiquettes. Sans clé, appelé par le navigateur de chaque lecteur.
- **Conditions** : [conditions d'utilisation](https://openfreemap.org/tos/) (14.10.2026) et
  [page d'accueil](https://openfreemap.org/). Gratuit, sans limite de vues ni de requêtes, usage commercial permis
  avec crédit. Fourni « tel quel », sans garantie, et **peut s'arrêter à tout moment sans préavis**. Passe
  éventuellement par Cloudflare.
- **Crédit exigé** : « © OpenMapTiles Data from OpenStreetMap ». Le mot « OpenFreeMap » est facultatif, retiré de
  la légende pour la raccourcir. Le schéma OpenMapTiles est sous CC BY 4.0, les données sous ODbL.
- **Crédit** : « Carte : © OpenMapTiles © OpenStreetMap » dans la légende (pas de surimpression sur la carte, choix
  de design ; le crédit reste à côté de la carte et visible sans clic).

### Relief : tuiles Terrarium

- **Service** : `s3.amazonaws.com/elevation-tiles-prod/terrarium`, jeu public AWS Open Data issu de Mapzen (Joerd),
  sans clé et sans engagement de disponibilité.
- **Conditions** : les sources d'altitude sont libres, y compris pour un usage commercial, mais demandent un crédit.
  [Liste exigée](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) : Mapzen, puis les sources par
  région. Pour la Suisse et ses voisins : Copernicus EU-DEM, SRTM et GMTED2010 (USGS).
- **Crédit** : « Relief : Mapzen, EU-DEM, USGS » (avant le 02.11.2026 : « Relief Mapzen » seulement).

## 5. Frontière de la Suisse

- **Source** : swisstopo swissBOUNDARIES3D, territoire national
  (`ch.swisstopo.swissboundaries3d-land-flaeche.fill`), via l'API publique geo.admin.ch, sans clé. Données
  ouvertes de la Confédération : usage libre, y compris commercial, source à citer.
- **Fichiers** : `public/data/ch.geojson` (≈ 550 points, filtre des localités) et `ch-precise.geojson`
  (≈ 2 400 points, trame hors Suisse), générés par `npm run geo:ch` (`scripts/build-ch.mjs` : anneau extérieur,
  simplifié par Douglas-Peucker). Écart avec les anciens contours : 25 m en médiane, 1 km au plus.
- **Crédit** : « swisstopo », dans « Carte : … » de la légende.
- **Avant le 02.11.2026** : contours non officiels repris de `bl-iframe-map-ski`, non crédités :
  `mledoze/countries` (ODbL, géométrie de thematicmapping.org) et `ZHB/switzerland-geojson` (aucune licence publiée,
  donc aucun droit de réutilisation).

## 6. Code et polices

| Brique | Version | Licence | Usage commercial | Remarque |
|---|---|---|---|---|
| MapLibre GL JS | 5.24.0 | BSD-3-Clause | oui | avis de licence à conserver |
| React, React DOM | 19.3.0 | MIT | oui | |
| Express | 5.2.1 | MIT | oui | serveur VPS |
| fast-xml-parser | 5.11.2 | MIT | oui | parsing DATEX II |
| Font Awesome Free | 6.7.2 | icônes CC BY 4.0, polices SIL OFL 1.1, code MIT | oui | [licence](https://fontawesome.com/license/free) : le crédit passe par le commentaire de licence des fichiers, supprimé par la minification (absent de `dist/assets/*.css`) |
| Vite, Tailwind CSS, concurrently, plugins | voir `package.json` | MIT | oui | outils de build, non livrés |
| Inter (`InterVariable`) | | SIL OFL 1.1 | oui | |
| Blick (`BlickVariable`), `base.css`, `iframeHeightAdjustment.js` | | propriété Ringier | usage Blick | ne pas réutiliser hors Blick |

## 7. Services tiers appelés par le lecteur

Le navigateur du lecteur contacte directement : le VPS (`trafic.citcatlab.ch`, notre API), OpenFreeMap (et
éventuellement Cloudflare) et AWS S3 (relief). L'OFROU, l'ASTRA, Overpass et geo.admin.ch ne sont jamais appelés
par le lecteur. À signaler si une revue protection des données (cookies, tiers) est demandée.

## Journal

- **02.11.2026** : date de création de l'application OTD consignée (08.10.2026, 13:39), échéance vers le
  08.04.2027 ; identifiants dans le gestionnaire de mots de passe de l'entreprise.
- **02.11.2026** : crédit OFROU au mot près (légende des deux modes, API) ; `/api/messages` coupé en production ;
  légende du mode explore complétée (relief EU-DEM et USGS, frontière swisstopo, lien OpenStreetMap) et
  raccourcie ; légende ajoutée au mode compact ; contours remplacés par swisstopo ; pas de crédit des bibliothèques.
- **01.11.2026** : premier inventaire.

## Reste à faire

- [ ] Vérifier la licence des couches ASTRA `BS_AXIS` et `SVZ_2022`.
- [ ] Font Awesome : garder le commentaire de licence dans le CSS livré (hors légende).
- [ ] Mi-mars 2027 : demander la prolongation de l'accès OTD (échéance vers le 08.04.2027, § 1).
