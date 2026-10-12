# Bouchons au Gothard (prototype)

Widget éditorial (≤ 632 px, mobile d'abord) basé sur les messages trafic temps réel de l'OFROU
(DATEX II, [opentransportdata.swiss](https://opentransportdata.swiss)).
Compte rendu des données réelles : [ETAPE0.md](ETAPE0.md). Pistes pour la suite : [PISTES.md](PISTES.md).

## 1. Clé API (gratuite)

1. Créer un compte sur https://api-manager.opentransportdata.swiss
2. Créer une application (« Redirect URLs » : laisser vide, ou `http://localhost:5173` si le champ est obligatoire)
3. L'abonner à **« Road traffic – traffic situations »**
4. Copier le **token** de l'application (pas le « token hash »)

Limites du plan : 5 appels/min ; accès valable **6 mois** avec 260 000 appels sur la période (≈ 1 appel/min).
Un relevé toutes les 3 min ≈ 87 000 appels en 6 mois. Pour prolonger l'accès ou réinitialiser le quota :
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
npm test           # parseur DATEX II sur des extraits réels
npm run gothard    # exploration en ligne de commande (voir scripts/gothard.mjs : --json, --all, --dump, --file)
```

Production locale : `npm run build && npm start` (Express sert aussi `dist/`).

## API

| Route | Contenu |
|---|---|
| `GET /api/now` | messages Gothard du dernier relevé + `summary` par sens (`N-S`, `S-N`) + autres alertes |
| `GET /api/now?all=1` | tout le flux (debug, ~1,3 Mo) |
| `GET /api/history?hours=24` | une ligne par relevé et par sens : `t`, `direction`, `queue_km`, `delay_min`, `jams` |

Le navigateur n'appelle que ce serveur. Seul le poller appelle l'OFROU (toutes les `POLL_INTERVAL_MIN`, 3 par défaut,
jamais moins de 2 min, y compris à travers les redémarrages : chaque tentative est enregistrée avant l'appel).

## Structure

```
lib/datex.mjs        parsing DATEX II + filtre Gothard + sens + résumé (pur, sans I/O)
lib/otd-client.mjs   appel SOAP, erreurs typées (AUTH, RATE_LIMIT, TIMEOUT, …)
server/poller.mjs    fetch → parse → archive, espacement minimal
server/store.mjs     SQLite : polls, messages (dédoublonnés par situation_id + version), observations
server/index.mjs     Express
src/                 React + Tailwind
data/                archive.sqlite, latest.json, dumps XML (ignoré par git)
```

Migration n8n + Firestore : `lib/` se reprend tel quel dans un nœud Code ; `server/store.mjs` documente
le découpage en collections.

Source : OFROU / opentransportdata.swiss
