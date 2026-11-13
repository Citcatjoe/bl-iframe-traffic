# Le point sur le trafic routier (prototype)

Widget cartographique Blick intégré en iframe (964 / 632 / < 400 px) : état en temps réel de dix points du réseau
routier suisse, par sens, d'après les messages trafic de l'OFROU et ses compteurs : tunnel et col du Gothard, tunnel et
col du Grand-Saint-Bernard, tunnel du San Bernardino, col du Simplon, axes autoroutiers Lausanne – Genève (A1) et
Lausanne – Valais (A9, jusqu'à Martigny), douanes de Bardonnex et de Vallorbe (DATEX II, [opentransportdata.swiss](https://opentransportdata.swiss)). Carte et panneau
coulissant repris du projet frère `bl-iframe-map-ski` (même shell Blick, même fond de carte, mêmes largeurs).
Compte rendu des données réelles : [ETAPE0.md](ETAPE0.md). Pistes et choix de périmètre : [PISTES.md](PISTES.md).
Hébergement envisagé : [PLAN-N8N-FIRESTORE.md](PLAN-N8N-FIRESTORE.md) (n8n + Firestore, point de départ),
[PLAN-VPS.md](PLAN-VPS.md) (en service : comment le projet relève et sert ses données sur le VPS Pegasus, fichiers
dans `deploy/` ; doc générale du serveur dans brain, `homelab/machines/pegasus/`), [PLAN-CATNAP.md](PLAN-CATNAP.md)
(plateforme interne catwalk / catnap), [PLAN-ECOSYSTEME.md](PLAN-ECOSYSTEME.md) (un VPS pour tous les widgets de
données, non implémenté, fichiers dans `deploy/ecosysteme/`).

## 1. Clé API (gratuite)

1. Créer un compte sur https://api-manager.opentransportdata.swiss
2. Créer une application (« Redirect URLs » : laisser vide, ou `http://localhost:5173` si le champ est obligatoire)
3. L'abonner à **« Road traffic – traffic situations »** et **« Road traffic – traffic counters »**
   (une seule application pour les deux, ou une application par produit). Sans les compteurs, le widget
   fonctionne sans les mesures de vitesse et de débit ; le serveur journalise `AUTH`.
4. Copier le **token** de l'application (pas le « token hash ») : `OTD_API_KEY` pour les messages,
   `OTD_COUNTERS_API_KEY` pour les compteurs si c'est une autre application (sinon laisser vide).

Limites (page produit « traffic situations ») : 5 appels/min ; accès valable **6 mois** avec 260 000 appels sur la
période (≈ 1 appel/min). Un relevé toutes les 3 min ≈ 87 000 appels en 6 mois par API interrogée. Pour prolonger l'accès ou réinitialiser le quota :
verkehrsdaten-plattform@astra.admin.ch ([conditions](https://opentransportdata.swiss/en/road-traffic/),
[FEDRO Terms of Use](https://opentransportdata.swiss/tac-fedro/)).

## 2. `.env` (chiffré avec git-crypt)

```sh
cp .env.example .env   # puis renseigner OTD_API_KEY=<token>
```

`.env` est versionné **chiffré** via [git-crypt](https://github.com/AGWA/git-crypt) (`.gitattributes`) :
il n'apparaît jamais en clair dans l'historique. Sur un nouveau clone :

```sh
brew install git-crypt
git-crypt unlock /chemin/vers/gothard-git-crypt.key   # clé exportée avec `git-crypt export-key`
```

Sans la clé git-crypt, le `.env` du dépôt est illisible : créer le sien depuis `.env.example`.
Vérifier l'état : `git-crypt status -e`.

## 3. Lancement

Node ≥ 22.13 (SQLite intégré `node:sqlite`).

```sh
npm install
npm run dev        # API locale sur :8787 (son propre poller OFROU) + front Vite (proxy /api)
npm run dev:vps    # front Vite seul, branché sur l'API du VPS (.env.vps) : pas de poller local
npm test           # parseur DATEX II, traversées, compteurs, sur des extraits réels
npm run traversees # exploration en ligne de commande (scripts/traversees.mjs : --json, --all, --dump, --file, --at)
npm run geo        # régénère public/data/traffic-geo.json (tracés et compteurs, couches ASTRA) si le périmètre change
```

Production : le poller et l'API tournent sur le VPS (`deploy/deploy.sh`, voir [PLAN-VPS.md](PLAN-VPS.md)) ; le widget
est compilé par `npm run build` pour lire l'API à l'adresse de `.env.production` (`VITE_API_BASE`), avec des chemins
relatifs (`base: "./"`), puis le contenu de `dist/` est publié sur le FTP dans
https://storytelling.blick.ch/fr/__is_embed_somewhere/bl-iframe-traffic/.

## Widget

Deux modes, choisis par le paramètre `mode` de l'URL. En-tête commun : titre « Le point sur le trafic routier » traité
en surtitre (13 px gras, capitales, rouge Blick) et « En direct · HH:MM » sur une ligne ; sous 480 px de large, l'heure
seule.

**Mode explore** (défaut, `?mode=explore`) : invitation à l'exploration, placée dans un article lié au sujet. Sans
cadre ni marge extérieure ; l'en-tête a un fond `--color-fill-weak` et un petit retrait intérieur, pour que les bords
du widget se lisent dans l'article ; la carte et les crédits vont d'un bord à l'autre (crédits en style de légende
Blick, comme `bl-tool-timeline-r` : 12 px, graisse normale, `--color-text-weak`).
Carte MapLibre (fond OpenFreeMap Positron + relief, comme `bl-iframe-map-ski`) : tracé de chaque point suivi
coloré selon son état, une étiquette par point sur une ligne (pastille de couleur des listes, barrière pour un col
fermé, puis le nom court ; ni statut ni vitesse, la liste les donne ; en mobile, pastille seule), postes de comptage
révélés au zoom (nom seul). Vue d'ensemble cadrée sur les points (de Bardonnex au San Bernardino), sur la Suisse
entière en mobile. Panneau unique liste ↔ fiche :

- **Filtre** en tête de liste, menu déroulant à choix unique (« Tous les points » par défaut) : Bouchons,
  Ralentissements, Fermetures (route fermée, avec ou sans déviation locale, ou jonction fermée), À venir (fermeture
  annoncée dans les 24 h ou risque de bouchon), chacun avec le nombre de points concernés. Le filtre s'applique à la
  liste, aux tracés et aux pastilles de la carte.
- **Liste** : mêmes lignes et même ordre que le mode compact (voir plus bas), cliquables.
- **Fiche** (maquette 5a) : nom, puis « type route · tronçon suivi » et « Selon l'OFROU · HH:MM » (heure du relevé :
  l'OFROU peut diverger d'autres sources, le TCS par exemple) ; lignes d'info séparées par des filets (pastille
  ou pictogramme, ligne principale en gras, précision dessous) :
  - **état** : une seule ligne si les deux sens ont le même statut (« Pas d'alerte » / « Aucun message de l'OFROU »,
    « Fermé » / « Fermeture hivernale dans les deux sens, depuis le 20 octobre ») ; sinon une ligne par sens, la plus
    grave d'abord (« Bouchon vers le Tessin » / cause, tronçon touché sur un axe ou une douane, déviation, début ;
    « Aucun message de l'OFROU » pour un sens sans alerte, jamais « fluide » : l'absence de message ne dit rien du
    trafic ni de l'ouverture réelle). Sous un bouchon : temps perdu et longueur en grand, chacun s'il est connu ;
  - **fermeture annoncée** (lune) : la prochaine dans les 7 jours, « Ferme ce soir à 20:00 » (ou « Jonction fermée … ») /
    « Jusqu'à 05:00, chaque nuit jusqu'au 06.11 · travaux · déviation locale ». L'OFROU publie des chantiers jusqu'à un
    an d'avance (Vallorbe : nuits de mai et juillet 2027) : sans cette limite, « Ferme le 10.05 » se lirait sans année ;
  - **alternative** (route), point fermé seulement : col ↔ tunnel du Gothard ou du Grand-Saint-Bernard, si
    l'alternative n'est pas fermée elle aussi ;
  - **pied** : « Historique du jour · N changements », qui déplie les changements d'état par sens sur 24 h. Alerte :
    longueur, temps perdu, tronçon touché, motif (« Fermé · deux sens · entre Motto Bartola et le col du Gothard ·
    véhicule en feu ») ; fin d'alerte : ce qui s'arrête et sa durée (« fin de l'alerte · fermé pendant 27 min »). Pour
    un point fermé dont toutes les fins sont annoncées, « Réouverture prévue … » à la place.

  Ni graphique, ni mesures de compteurs, ni texte brut de l'OFROU. Le tronçon touché n'est repris que sur un axe ou
  une douane : ces routes ne sont jamais fermées en entier, mais entre deux jonctions, le plus souvent la nuit.

| Largeur de l'iframe | Mise en page (hauteur) |
|---|---|
| ≥ 860 px (cible 964) | comme en 632 px : carte pleine largeur, panneau superposé replié par défaut, ouvert par « Liste » ou un clic sur la carte (600 px) |
| 520–859 px (cible 632) | carte pleine largeur, panneau superposé replié par défaut, ouvert par « Liste » ou un clic sur la carte (540 px) |
| < 520 px (mobile) | sur le modèle de `bl-iframe-map-ski` : carte en 4:3 (pleine largeur, Suisse entière, pastilles sans nom) + barre dessous (menu du filtre, ouvert vers le haut, et bouton liste) ; le bouton ouvre la liste plein cadre (filtre, une ligne de 34 px par point : nom, pastille et mot du statut) ; un point choisi (liste ou carte) ouvre directement la fiche en plein cadre, même structure en tailles réduites (nom 20 px, lignes 14 px, pastilles 14 px, métriques 22 px), « Tous les points » revient à la liste, la croix à la carte (hauteur selon le contenu, ≈ 440 px à 360 px de large, ajustée par `iframeHeightAdjustment.js`) |

**Mode compact** (`?mode=compact`, maquette Claude Design 4a / 4b) : haut de rubrique ou homepage, lisible d'un coup
d'œil, sans carte ni interaction. Fondu dans l'article : ni cadre, ni arrondi, ni marge extérieure (en-tête et lignes
sur fond `--color-fill-weak`, avec un petit retrait intérieur ; pied « Tout voir » sur `--color-fill-strong`, avec ses marges latérales ; source franc bord, en style de légende). 6 points au plus, en deux colonnes à partir de 480 px (lecture par colonne, les plus
graves à gauche), une colonne en dessous. Chaque ligne : pastille de couleur (19 px), nom, puis « **Statut** · détail ·
sens », le mot du statut dans la couleur de la pastille. Exception : un col fermé (perturbation au long cours, pas un
état du trafic qui change d'une minute à l'autre) est signalé par une barrière à la place de la pastille, dans le même rouge. Aucune vitesse ni
mesure de compteur. Lignes non cliquables, pas de fiche (le détail est dans le mode explore). Sous 480 px, mêmes lignes
en une colonne. `?points=` restreint la vue à une sélection de points (même tri, même pied) ;
`|` sépare des colonnes, chacune triée par gravité (en une colonne, sous 480 px, les groupes se suivent). Par exemple
les axes à gauche, les douanes à droite :
`?mode=compact&points=lausanne-geneve,lausanne-valais|douane-bardonnex,douane-vallorbe`.

| Statut | Pastille | Ligne 2 |
|---|---|---|
| Bouchon | `--color-red-500` | `Bouchon · 8 km · ≈ 80–96 min perdues · vers le Tessin` (km et temps perdu quand ils sont connus) |
| Ralenti | orange #F07800 | `Ralenti · vers le Valais` |
| Fermé | `--status-closed` (`--color-red-900` en clair, #F25C5C en sombre) ; col fermé : barrière 17 px de la même couleur | `Fermé · fermeture hivernale · vers l'Italie` (motif tiré de « Raison: » du message FR, sinon « travaux ») |
| Déviation | orange #F07800 | `Déviation · travaux · deux sens` (route fermée, déviation locale) |
| Risque de bouchon, Jonction fermée | jaune #E0A800 | même schéma |
| Pas d'alerte | `--color-success` | `Pas d'alerte · deux sens` (aucun message : on ne dit pas « fluide »), ou `Pas d'alerte · ferme ce soir à 22:00[, déviation]` (les messages FR ne décrivent qu'une déviation locale : la fiche le précise) |

Tri : bouchons (temps perdu, puis longueur), ralentis, fermés, déviations, risques, jonctions, puis « Pas d'alerte »
(fermeture annoncée dans les 24 h d'abord) ; les cols fermés passent après tout le reste. Au-delà de 6 points, le pied
résume le reste : « N autres fermetures ce soir » (fermeture annoncée avant 06:00 le lendemain), « N autres points
sans alerte », « N cols fermés », et « N autres points perturbés » si plus de 6 points sont perturbés. Sous 480 px,
pastille (ou barrière) et nombre seuls, le libellé restant lu par les lecteurs d'écran. « Tout voir » à
droite du pied : lien vers `seeAllUrl` (page parente) si le
paramètre est fourni, sinon libellé seul (URL à définir). Dessous, la source des données OFROU (formule imposée,
[LICENCES.md](LICENCES.md)) : le mode compact n'utilise ni carte ni tracés, c'est son seul crédit.
Hauteur selon le contenu : ≈ 265 px à 964 px, ≈ 300 px à 632 px, ≈ 410–440 px sur mobile, plus la ligne de source
(≈ 25 px, deux lignes sur mobile).

| URL | Contenu |
|---|---|
| `/` ou `/?mode=explore` | carte des points suivis |
| `/?mode=compact[&points=…][&seeAllUrl=…]` | état des points en quelques lignes ; `points` : identifiants séparés par des virgules, `\|` entre colonnes (mêmes valeurs que `point`, inconnus ignorés avec un avertissement en console), tous les points par défaut ; `seeAllUrl` : cible de « Tout voir » ; `track` : suffixe du nom suivi en analytics (voir Suivi d'audience) |
| `/?point=gothard` | mode explore : fiche d'un point ouverte d'emblée (`gothard`, `col-du-gothard`, `lausanne-geneve`, `lausanne-valais`, `grand-st-bernard`, `col-du-grand-st-bernard`, `san-bernardino`, `simplon`, `douane-bardonnex`, `douane-vallorbe`) |
| `/?debug=1` | mode explore : ajoute la liste des messages parsés sous le widget |

Intégration : iframe Blick standard. La hauteur est gérée par le script Blick `iframeHeightAdjustment.js`
(chargé depuis blick.ch, copie locale en repli dans `public/js/`), comme `base.css` (tokens clair/sombre) et les polices.

**Thème clair / sombre.** Le CMS ajoute `#theme=dark` (ou `light`) à l'URL de l'iframe ; `iframeHeightAdjustment.js`
le lit, pose la paire `--is-light-theme` / `--is-dark-theme` sur la racine, et suit les bascules de la page
(`CHANGE_THEME`). Toutes les couleurs de `base.css` en dérivent, et l'interface n'utilise que ces tokens (via
`src/index.css`) : elle suit seule. La carte, dessinée par MapLibre et en canvas, suit via `useTheme()`
(`src/lib/theme.js`) : fond OpenFreeMap Positron ou Dark (`VITE_MAP_STYLE_LIGHT` / `VITE_MAP_STYLE_DARK`), relief,
localités, tracés, pastilles, aux teintes de `MAP_THEMES` (`src/config/mapConfig.js`) ; à la bascule, le style est
remplacé et nos couches rajoutées. Les couleurs de statut (pastilles, tracés) ne changent pas. Sans le script, thème
clair. Test : `http://localhost:5173/#theme=dark`.

**Suivi d'audience.** `src/lib/analytics.js` pousse dans `window.blickDataLayer` (posé dans `index.html`, relayé à la
page par `iframeHeightAdjustment.js` en message `TRACK`), selon la convention des widgets Blick :

| `event` | `iframe_id` | Données | Quand |
|---|---|---|---|
| `iframe_impression` | `iframe_impression` | | chargement du widget |
| `iframe_click` | `iframe_point_clicked` | `point`, `source` (`list` / `map`) | choix d'un point (pas la présélection `?point=`) |
| `iframe_click` | `iframe_filter_clicked` | `filter` (`jam`, `slow`, `closed`, `soon`, `all`) | choix dans le menu du filtre |
| `iframe_click` | `iframe_list_clicked` | | ouverture de la liste (bouton « Liste », ou bouton liste en mobile) |
| `iframe_click` | `iframe_history_clicked` | `point` | dépliage de l'historique d'une fiche |
| `iframe_click` | `iframe_see_all_clicked` | | « Tout voir » du mode compact (si `seeAllUrl`) |

`iframe_name` : `storytelling_trafic_routier_explore` ou `storytelling_trafic_routier_compact`, suivi de `_<track>` si
l'URL porte `?track=` (minuscules, chiffres, tirets ; 40 caractères au plus, sinon ignoré). À utiliser pour chaque vue
contextualisée, afin que ses statistiques restent séparées : par exemple
`?mode=compact&points=lausanne-geneve,lausanne-valais%7Cdouane-bardonnex,douane-vallorbe&track=axes-douanes` →
`storytelling_trafic_routier_compact_axes-douanes`. En mode compact avec `?points=`, chaque événement porte aussi
`points` (la sélection).

## API

| Route | Contenu |
|---|---|
| `GET /api/now[?point=…]` | état par point : niveau, type (`tunnel`, `col`, `axe`, `douane`), tronçon suivi (`section`), sens `a`/`b` avec libellé et flèche (km, temps perdu annoncé ou estimé, depuis, compteurs, messages avec tronçon touché `section_fr` et motif `reason_fr`), prochaines fermetures |
| `GET /api/history?point=…&hours=24` | une ligne par relevé et par sens (`level`, `queue_km`, `delay_min`, et du message le plus grave `section_fr`, `reason_fr`, `roadworks`) : journal de la fiche |
| `GET /api/messages[?all=1]` | messages parsés des points suivis, ou tout le flux (debug, ~1,3 Mo) ; **local seulement** : 404 si `NODE_ENV=production` (VPS), les conditions de l'OFROU interdisant de redistribuer les données brutes ([LICENCES.md](LICENCES.md)) |

Rattachement des messages : une fermeture hivernale (« Ursache: Wintersperre ») n'est rattachée qu'à un col, jamais à
un tunnel, un axe ou une douane. Le 05.11.2026, l'OFROU publiait la fermeture du col du Grand-Saint-Bernard aussi sur
la H21 « entre Bourg-St-Bernard et Martigny », ce qui affichait à tort le tunnel fermé. « Depuis le … » porte l'année
quand le début n'est pas de l'année en cours (chantiers de longue durée).

Compteurs : chaque relevé ne rapporte qu'une minute de mesure. Débits et vitesses sont donc lissés sur les relevés
des 10 dernières minutes : débit moyen de chaque voie, vitesse pondérée par le débit (carte du mode explore). Seules
comptent les minutes **mesurées** dans ces 10 minutes : le flux renvoie parfois une minute figée depuis des heures
(05.11.2026 : mesure de 01:18 encore servie à 12:14, un relevé sur deux environ). Sans mesure récente, le compteur
n'a pas de valeur (`measured_at: null`) plutôt qu'une valeur périmée présentée comme actuelle.
Un compteur est `silent` (« compteur muet ») quand aucune de ses voies n'a compté de véhicule depuis 6 h, à condition
que les relevés aient été continus pendant ces 6 h (sinon on ne conclut pas) ; `last_vehicle_at` donne la dernière
minute avec un véhicule.

Niveaux : `closed` fermé · `jam` bouchon · `slow` ralenti · `detour` fermé avec déviation locale ·
`expected` risque de bouchon · `access` jonction fermée · `clear` aucun message de perturbation (≠ trafic mesuré fluide).
Les fermetures nocturnes ou diurnes récurrentes (« Dauer: nachts … 22:00 bis … 05:00 ») ne comptent que pendant
leur plage horaire (heure suisse).

Le navigateur n'appelle que ce serveur. Seul le poller appelle l'OFROU : un relevé « messages » et un relevé
« compteurs » toutes les `POLL_INTERVAL_MIN` (3 par défaut), jamais moins de 2 min par API, y compris à travers
les redémarrages : chaque tentative est enregistrée avant l'appel.

## Structure

```
lib/datex.mjs        parsing DATEX II des messages : route, nature (Sachlage), plage horaire, km, temps perdu (pur)
lib/crossings.mjs    points suivis (tronçons, sens a/b, signes alertC, compteurs, position) + résumé par sens (pur) — périmètre à éditer ici
lib/counters.mjs     parsing DATEX II des compteurs (pur)
lib/otd-client.mjs   appels SOAP, erreurs typées (AUTH, RATE_LIMIT, TIMEOUT, …)
server/poller.mjs    fetch → parse → archive, par API, espacement minimal
server/store.mjs     SQLite : polls, messages (dédoublonnés par situation_id + version), observations, counter_values
server/index.mjs     Express
src/                 React + Tailwind + MapLibre : map/ (fond, pastilles, tracés), components/ (panneau, fiche, filtres, lignes), lib/status.js (statut et lignes des listes), lib/filters.js, lib/journal.js, lib/detail.js (fiche), lib/levels.js (couleurs des tracés), lib/theme.js (thème clair / sombre), lib/analytics.js (blickDataLayer)
public/              shell Blick (css, js, fonts), data/ch*.geojson (frontière swisstopo, npm run geo:ch), data/traffic-geo.json (npm run geo)
scripts/             traversees.mjs (CLI), build-geo.mjs (tracés ASTRA, col du Gothard OpenStreetMap), build-ch.mjs (frontière swisstopo)
data/                archive.sqlite, latest.json, dumps XML (ignoré par git)
```

Crédits sous le widget (`src/config/credits.js`), sources, API et licences : [LICENCES.md](LICENCES.md).
