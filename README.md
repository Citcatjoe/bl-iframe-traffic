# Traversées alpines : état du trafic (prototype)

Widget cartographique Blick intégré en iframe (964 / 632 / < 400 px) : état en temps réel des quatre traversées
alpines routières (Gothard, San Bernardino, Simplon, Grand-Saint-Bernard), par sens, d'après les messages trafic
de l'OFROU et ses compteurs (DATEX II, [opentransportdata.swiss](https://opentransportdata.swiss)). Carte et panneau
coulissant repris du projet frère `bl-iframe-map-ski` (même shell Blick, même fond de carte, mêmes largeurs).
Compte rendu des données réelles : [ETAPE0.md](ETAPE0.md). Pistes et choix de périmètre : [PISTES.md](PISTES.md).

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
npm run dev        # API sur :8787 + front Vite (proxy /api)
npm test           # parseur DATEX II, traversées, compteurs, sur des extraits réels
npm run traversees # exploration en ligne de commande (scripts/traversees.mjs : --json, --all, --dump, --file, --at)
npm run geo        # régénère public/data/traffic-geo.json (tracés et compteurs, couches ASTRA) si le périmètre change
```

Production locale : `npm run build && npm start` (Express sert aussi `dist/`).

## Widget

Carte MapLibre (fond OpenFreeMap Positron + relief, comme `bl-iframe-map-ski`) : tracé de chaque tronçon suivi
coloré selon son état, pastille par traversée (nom, icône d'état, km ou vitesse mesurée), col du Gothard et postes
de comptage révélés au zoom. Panneau unique liste ↔ fiche : liste triée par gravité, fiche avec état par sens,
vitesses mesurées, messages en cours, prochaines fermetures et historique.

| Largeur de l'iframe | Mise en page (hauteur fixe) |
|---|---|
| ≥ 860 px (cible 964) | panneau fixe de 312 px à gauche + carte (600 px) |
| 520–859 px (cible 632) | carte pleine largeur, panneau superposé ouvert par « Liste » ou un clic sur la carte (540 px) |
| < 520 px (mobile) | carte + liste compacte sous la carte, fiche courte au clic, « Détails » en plein cadre (520 px) |

| URL | Contenu |
|---|---|
| `/` | carte des quatre traversées |
| `/?point=gothard` | fiche d'une traversée ouverte d'emblée (`gothard`, `san-bernardino`, `simplon`, `grand-st-bernard`) |
| `/?debug=1` | ajoute la liste des messages parsés sous le widget |

Intégration : iframe Blick standard. La hauteur est gérée par le script Blick `iframeHeightAdjustment.js`
(chargé depuis blick.ch, copie locale en repli dans `public/js/`), comme `base.css` (tokens clair/sombre) et les polices.

## API

| Route | Contenu |
|---|---|
| `GET /api/now[?point=…]` | état par traversée : niveau, sens `S`/`N` (km, temps perdu annoncé ou estimé, depuis, compteurs), col du Gothard, prochaines fermetures |
| `GET /api/history?point=…&hours=24` | une ligne par relevé et par sens (`level`, `queue_km`, `delay_min`) + vitesse/débit du compteur principal |
| `GET /api/messages[?all=1]` | messages parsés des traversées, ou tout le flux (debug, ~1,3 Mo) |

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
lib/crossings.mjs    traversées suivies (tronçons, sens, compteurs) + résumé par sens (pur) — périmètre à éditer ici
lib/counters.mjs     parsing DATEX II des compteurs (pur)
lib/otd-client.mjs   appels SOAP, erreurs typées (AUTH, RATE_LIMIT, TIMEOUT, …)
server/poller.mjs    fetch → parse → archive, par API, espacement minimal
server/store.mjs     SQLite : polls, messages (dédoublonnés par situation_id + version), observations, counter_values
server/index.mjs     Express
src/                 React + Tailwind + MapLibre : map/ (fond, pastilles, tracés), components/ (panneau, fiche), lib/levels.js (couleurs et icônes des niveaux)
public/              shell Blick (css, js, fonts), data/ch*.geojson (contour CH), data/traffic-geo.json (npm run geo)
scripts/             traversees.mjs (CLI), build-geo.mjs (géométries ASTRA)
data/                archive.sqlite, latest.json, dumps XML (ignoré par git)
```

Migration n8n + Firestore : `lib/` se reprend tel quel dans un nœud Code ; `server/store.mjs` documente
le découpage en collections.

Source : OFROU / opentransportdata.swiss
