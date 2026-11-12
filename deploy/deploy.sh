#!/usr/bin/env bash
# Met en ligne le poller et l'API de bl-iframe-traffic sur le VPS depuis ce Mac (voir PLAN-VPS.md § 6).
# Le widget n'y est pas : il est compilé (npm run build, adresse de l'API dans .env.production) et publié
# sur le FTP de l'entreprise.
#
#   deploy/deploy.sh [hôte-ssh]     défaut : vps (alias de ~/.ssh/config)
#
# Envoie le code et le .env déchiffré par SSH (rien ne passe par GitHub, aucune clé git-crypt sur le serveur),
# installe les dépendances de production, met à jour le service systemd et la config Caddy, puis redémarre.
# Sur le serveur, data/ (archive SQLite) n'est jamais touché.
set -euo pipefail
cd "$(dirname "$0")/.."
hote=${1:-vps}
dest=/srv/bl-iframe-traffic
paquet=/tmp/bl-iframe-traffic.tgz

[[ -f .env ]] || { echo ".env introuvable" >&2; exit 1; }
if head -c 10 .env | LC_ALL=C grep -qa GITCRYPT; then
  echo ".env est encore chiffré : git-crypt unlock d'abord" >&2
  exit 1
fi

# COPYFILE_DISABLE / --no-xattrs : pas de fichiers ._* ni d'attributs macOS dans l'archive.
COPYFILE_DISABLE=1 tar -czf - --no-xattrs .env package.json package-lock.json server lib deploy |
  ssh "$hote" "cat > $paquet"

ssh "$hote" sudo bash -s -- "$dest" "$paquet" <<'EOF'
set -euo pipefail
dest=$1
paquet=$2
arrivee=$(mktemp -d)
trap 'rm -rf "$arrivee" "$paquet"' EXIT
tar -xzf "$paquet" -C "$arrivee" --no-same-owner

id traffic &>/dev/null || useradd --system --home "$dest" --shell /usr/sbin/nologin traffic
mkdir -p "$dest/data"
for dossier in server lib; do rsync -a --delete "$arrivee/$dossier/" "$dest/$dossier/"; done
install -o root -g root -m 644 "$arrivee/package.json" "$arrivee/package-lock.json" "$dest/"
# Clés OTD : lisibles par le service seulement.
install -o root -g traffic -m 640 "$arrivee/.env" "$dest/.env"
chown -R root:root "$dest/server" "$dest/lib"
chown -R traffic:traffic "$dest/data"

cd "$dest"
npm ci --omit=dev --no-audit --no-fund --loglevel=error

install -m 644 "$arrivee/deploy/bl-iframe-traffic.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --quiet bl-iframe-traffic
systemctl restart bl-iframe-traffic

# Le Caddyfile principal (dépôt pegasus) importe /etc/caddy/sites/*.caddy.
install -D -m 644 "$arrivee/deploy/bl-iframe-traffic.caddy" /etc/caddy/sites/bl-iframe-traffic.caddy
# Sous l'utilisateur caddy : la validation ouvre les journaux ; en root, elle les créerait en root (illisibles par Caddy).
sudo -u caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile 2>/dev/null
systemctl reload caddy

sleep 3
systemctl is-active bl-iframe-traffic
EOF
