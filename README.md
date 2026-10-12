# Traversées alpines : état du trafic (prototype)

Widget éditorial intégré en iframe (964 / 632 / < 400 px, mobile d'abord) : état en temps réel des quatre
traversées alpines routières (Gothard, San Bernardino, Simplon, Grand-Saint-Bernard), par sens, d'après les
messages trafic de l'OFROU et ses compteurs (DATEX II, [opentransportdata.swiss](https://opentransportdata.swiss)).
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
```

Production locale : `npm run build && npm start` (Express sert aussi `dist/`).

## Widget

| URL | Contenu |
|---|---|
| `/` | vue d'ensemble des quatre traversées, triées par gravité |
| `/?point=gothard` | fiche d'une traversée (`gothard`, `san-bernardino`, `simplon`, `grand-st-bernard`) avec historique |
| `/?debug=1` | ajoute la liste des messages parsés |

La mise en page suit la largeur de l'iframe : compacte < 480 px (lisible sans interaction), standard 480–899 px,
large ≥ 900 px.

### Intégration iframe

```html
<div data-bl-traffic data-src="https://HOTE-DU-WIDGET/"></div>
<div data-bl-traffic data-src="https://HOTE-DU-WIDGET/" data-point="gothard"></div>
<script src="https://HOTE-DU-WIDGET/embed.js" async></script>
```

`embed.js` crée l'iframe et ajuste sa hauteur : le widget envoie `{ type: "bl-traffic:height", height, point }`
à la page parente à chaque changement de hauteur.

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
src/                 React + Tailwind ; public/embed.js
data/                archive.sqlite, latest.json, dumps XML (ignoré par git)
```

Migration n8n + Firestore : `lib/` se reprend tel quel dans un nœud Code ; `server/store.mjs` documente
le découpage en collections.

Source : OFROU / opentransportdata.swiss
