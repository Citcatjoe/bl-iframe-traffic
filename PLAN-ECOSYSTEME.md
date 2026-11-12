# Plan : un mini-écosystème pour tous les widgets de données (13.10.2026)

Plan de repli si la plateforme de Mario ([PLAN-CATNAP.md](PLAN-CATNAP.md)) ne nous est pas ouverte. **Non
implémenté** : Pegasus a suivi une autre convention (un sous-domaine et des unités systemd par projet), décrite avec
l'inventaire du serveur dans brain (`homelab/machines/pegasus/`). Gardé comme trace du raisonnement ; les modèles de
`deploy/ecosysteme/` y sont copiés (`modeles/`). Au lieu de chercher une solution gratuite par projet (Firestore Spark, n8n sur le NAS, FTP), un seul
VPS fournit à tous les widgets les quatre briques qui manquent : des pollers qui tournent en permanence, des
fichiers de données servis avec cache, une adresse HTTPS stable, une publication en une commande. C'est ce que
fait catwalk / catnap, sans le bandeau rédaction ni le design injecté, inutiles ici.

Généralise [PLAN-VPS.md](PLAN-VPS.md) (un projet, serveur Express) : ici, plus de serveur applicatif, seulement
des pollers qui écrivent des fichiers et Caddy qui les sert. Fichiers prêts dans [`deploy/ecosysteme/`](deploy/ecosysteme/).

```mermaid
flowchart LR
  subgraph VPS["VPS Lite · 2,70 CHF / mois"]
    TT[poller@trafic.timer] --> PT[node publish.mjs] --> FT[(/srv/feeds/trafic)]
    TM[poller@meteo.timer] --> PM[node publish.mjs] --> FM[(/srv/feeds/meteo)]
    ST["/srv/sites/trafic/current"]
    SM["/srv/sites/meteo/current"]
  end
  FT & FM & ST & SM --> C
  C --> CF[Cloudflare gratuit · optionnel] --> V((lecteurs))
  D[deploy-site.sh, depuis le Mac] --> ST & SM
```

## 1. Ce que ça remplace

| Besoin | Bricolage actuel | Dans l'écosystème |
|---|---|---|
| Faire tourner un poller en permanence | n8n sur le NAS, fonctions Firebase planifiées | un timer systemd par projet |
| Stocker et servir les données | Firestore (50 000 lectures / jour, coupure à 9 h) | fichiers JSON servis par Caddy, cache d'une minute, aucun quota |
| Adresse HTTPS | FTP, IP, demande DNS | `https://<IP ou nom>/<projet>/` |
| Publier un widget | FTP à la main | `deploy-site.sh <projet> vps`, bascule d'un coup, retour arrière |
| Coût | 0, avec des plafonds | 2,70 CHF / mois pour tous les projets, sans plafond d'audience |

## 2. Conventions

| Chemin sur le VPS | Contenu | Propriétaire |
|---|---|---|
| `/srv/apps/<p>/` | clone du dépôt du projet + `.env` (clés API, `chmod 600`, root) | ton compte |
| `/srv/feeds/<p>/` | fichiers JSON publics, écrits par le poller | `feeds` |
| `/srv/state/<p>/` | état privé du poller (archive SQLite…), non servi | `feeds` |
| `/srv/sites/<p>/releases/<version>/` | versions compilées du widget (5 gardées) | ton compte |
| `/srv/sites/<p>/current` | lien vers la version en ligne | ton compte |
| `/srv/sites/<p>/config.json` | source des données du widget, réglable sans recompiler | ton compte |

| Adresse | Servi depuis |
|---|---|
| `https://<hôte>/<p>/` | `/srv/sites/<p>/current` ; `/assets/*` en cache un an |
| `https://<hôte>/<p>/feed/<fichier>.json` | `/srv/feeds/<p>` ; `Cache-Control: max-age=60, stale-while-revalidate=120, stale-if-error=86400`, CORS ouvert |

**Ce que chaque projet doit fournir :**
1. `scripts/publish.mjs --out <dossier> --state <dossier>` : un relevé, puis fin du processus. Il écrit ses
   fichiers dans `--out` en passant par un fichier temporaire puis un renommage (jamais de fichier à moitié écrit),
   relit ses propres fichiers s'il tient un historique, garde ce qui doit rester privé dans `--state`, et sort en
   erreur si le relevé échoue (les anciens fichiers restent alors en ligne).
2. Un widget compilé avec des chemins relatifs (`base: "./"` dans Vite) : il est servi sous `/<p>/`.
3. La lecture de `config.json` (règle R3 de [PLAN-N8N-FIRESTORE.md](PLAN-N8N-FIRESTORE.md), § 12), avec
   `{"source": "http", "base": "feed", "refresh_min": 3}` : `feed` est relatif à la page, donc `/<p>/feed/`.

## 3. Installation (une fois)

Système, pare-feu, Node 22 et Caddy : voir la documentation du serveur Pegasus dans brain
(`homelab/machines/pegasus/02-systeme.md` et `08-deploiement.md`). Puis :

```sh
sudo useradd --system --no-create-home --shell /usr/sbin/nologin feeds
sudo mkdir -p /srv/apps /srv/feeds /srv/state /srv/sites
sudo chown "$USER" /srv/apps /srv/sites          # publication par SSH sous ton compte
sudo cp deploy/ecosysteme/poller@.service deploy/ecosysteme/poller@.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo cp deploy/ecosysteme/Caddyfile /etc/caddy/Caddyfile   # e-mail, adresse, une ligne `import projet <p>` par projet
sudo systemctl reload caddy
```

Sur le Mac, une entrée `vps` dans `~/.ssh/config` (adresse, utilisateur, clé) suffit à `deploy-site.sh`.

## 4. Ajouter un projet

```sh
P=meteo
# Sur le VPS
sudo mkdir -p /srv/feeds/$P /srv/state/$P && sudo chown feeds:feeds /srv/feeds/$P /srv/state/$P
git clone <dépôt> /srv/apps/$P && (cd /srv/apps/$P && npm ci --omit=dev)
sudo install -m 600 -o root -g root /dev/null /srv/apps/$P/.env && sudoedit /srv/apps/$P/.env   # clés API
sudo systemctl start poller@$P.service && journalctl -u poller@$P -n 20        # premier relevé à la main
sudo systemctl enable --now poller@$P.timer
# Rythme différent de 3 min : sudo systemctl edit poller@$P.timer (voir le fichier .timer)
echo '{"source": "http", "base": "feed", "refresh_min": 10}' > /srv/sites/$P/config.json
# Caddyfile : ajouter `import projet meteo`, puis sudo systemctl reload caddy

# Sur le Mac, dans le dépôt du projet
npm run build && /chemin/vers/deploy/ecosysteme/deploy-site.sh $P vps
```

## 5. Au quotidien

| Tâche | Commande |
|---|---|
| Publier une nouvelle version du widget | `npm run build && deploy-site.sh <p> vps` |
| Revenir à la version précédente | `deploy-site.sh <p> vps --rollback` |
| Mettre à jour le code d'un poller | `cd /srv/apps/<p> && git pull && npm ci --omit=dev` (pris en compte au relevé suivant) |
| Voir les prochains relevés | `systemctl list-timers 'poller@*'` |
| Journal d'un poller | `journalctl -u poller@<p> --since -1h` |
| Relevés en échec | `systemctl --failed` |
| Surveillance externe | sonde gratuite sur `/<p>/feed/now.json` : erreur, ou `fetched_at` de plus de 15 min |

Un relevé encore en cours n'est pas relancé par son timer. Chaque projet a un décalage fixe de 0 à 45 s
(`FixedRandomDelay`) : deux projets n'analysent pas leurs données au même instant.

## 6. Ressources

Voir la documentation de Pegasus dans brain (`homelab/machines/pegasus/README.md`, « Ce qu'on peut en faire ») :
deux projets comme le trafic tiennent sur le VPS Lite XS (1 vCPU, 2 Go),
la RAM étant la seule ressource à surveiller. Ici, le poller ne reste pas en mémoire entre deux relevés :
les ≈ 270 Mo de l'analyse XML du trafic ne sont occupés que pendant ≈ 1 s toutes les 3 min, et chaque relevé est
plafonné à 700 Mo (`MemoryMax`). Au-delà de ≈ 1,5 Go utilisés en régime établi : VPS Lite M (4 Go, 7,20 CHF / mois).

## 7. Sauvegarde

- Code : dans git. Widgets : recompilables, 5 versions gardées sur le VPS.
- `/srv/feeds` : régénéré par le relevé suivant, sauf l'historique 24 h, qui se reconstitue en 24 h.
- À sauvegarder hors du VPS : les `.env` (clés API) et, si un projet en a, son état dans `/srv/state/<p>`.

## 8. État pour le projet trafic

Vérifiés le 13.10.2026 : `deploy-site.sh` (publication, lien `config.json`, liens physiques entre versions, retour
arrière, conservation de 5 versions, refus d'un dossier sans `index.html`), testé en local avec un `ssh` simulé ;
le Caddyfile, validé (`caddy adapt`) et testé en local (Caddy 2.11.7 : widget, fichiers `/assets/` en cache un an,
`/feed/` avec cache et CORS, redirection `/trafic` → `/trafic/`, 404 ailleurs). Les unités systemd n'ont pas pu
être vérifiées (pas de systemd sur macOS).

Reste à écrire, et c'est le même travail que pour le plan n8n ou catnap (règles R1 à R3) :
- `scripts/publish.mjs` autour de `buildDocuments` (`lib/`) : écrit `now.json`, `{id}.json`, `history-{id}.json` ;
- côté front : adaptateur `http`, lecture de `config.json`, `base: "./"`, plus aucun `/api/…` en absolu.

Si Mario nous ouvre catnap, `publish.mjs` envoie les mêmes fichiers chez lui au lieu de `--out` : rien n'est perdu.

## 9. Risques

| Risque | Parade |
|---|---|
| Une seule machine pour tous les widgets, sans SLA | Cloudflare devant avec `stale-if-error` (les données d'avant la panne restent servies) ; âge des données affiché par les widgets ; VPS Cloud avec SLA si l'écosystème grossit |
| Tout repose sur une personne | ce document, les fichiers de `deploy/ecosysteme/`, et un second accès SSH confié à un collègue |
| Un poller défaillant | isolé : utilisateur dédié, écriture limitée à ses dossiers, 700 Mo au plus |
| Clés API sur le VPS | `.env` en `chmod 600` root, lu par systemd avant de passer à l'utilisateur `feeds` |

## 10. Décisions ouvertes

- Attendre la réponse de Mario avant d'installer quoi que ce soit.
- Adresse : IP (suffisante), ou un nom pour mettre Cloudflare devant.
- Compte Infomaniak et facture : personnels ou entreprise.
- Y servir aussi les lectures de Blick Tools (voir `blick-tools/AUDIT_SORTIE_FIREBASE.md`) : possible, mais une panne
  toucherait alors tous les widgets publiés ; à décider avec Cloudflare devant et une sauvegarde.
