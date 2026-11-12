#!/usr/bin/env bash
# Publie un widget compilé sur le VPS du mini-écosystème (voir PLAN-ECOSYSTEME.md).
#
#   deploy-site.sh <projet> <hôte-ssh> [dossier]    publie <dossier> (défaut : dist) et bascule d'un coup
#   deploy-site.sh <projet> <hôte-ssh> --rollback   remet en ligne la version précédente
#
# Chaque version va dans /srv/sites/<projet>/releases/<version>/ ; le lien `current`, servi par Caddy, est
# remplacé d'un coup : un lecteur ne voit jamais une version à moitié copiée. Les 5 dernières versions sont
# gardées. Si /srv/sites/<projet>/config.json existe, chaque version y est reliée : la source des données se
# règle sur le serveur, sans recompiler.
set -euo pipefail

usage() { echo "usage : $0 <projet> <hôte-ssh> [dossier | --rollback]" >&2; exit 2; }
[[ $# -ge 2 ]] || usage
projet=$1
hote=$2
arg=${3:-dist}
[[ $projet =~ ^[a-z0-9-]+$ ]] || { echo "nom de projet invalide : $projet" >&2; exit 2; }
base=${SITES_ROOT:-/srv/sites}/$projet
garder=5

# Remplace le lien `current` d'un coup (GNU : mv -T ; BSD : mv -h).
bascule='ln -s "releases/$1" current.tmp && { mv -T current.tmp current 2>/dev/null || mv -fh current.tmp current; }'

if [[ $arg == --rollback ]]; then
  ssh "$hote" bash -s -- "$base" <<EOF
set -euo pipefail
cd "\$1"
actuelle=\$(basename "\$(readlink current)")
precedente=\$(ls -1 releases | sort | awk -v a="\$actuelle" '\$0 == a { print p; exit } { p = \$0 }')
[[ -n \$precedente ]] || { echo "aucune version avant \$actuelle" >&2; exit 1; }
set -- "\$precedente"
$bascule
echo "en ligne : \$precedente (au lieu de \$actuelle)"
EOF
  exit
fi

[[ -f $arg/index.html ]] || { echo "$arg/index.html introuvable : compiler d'abord (npm run build)" >&2; exit 1; }
sha=$(git rev-parse --short HEAD 2>/dev/null || true)
version=$(date +%Y%m%d-%H%M%S)${sha:+-$sha}

ssh "$hote" "mkdir -p '$base/releases'"
# --link-dest : les fichiers inchangés depuis la version en ligne ne sont pas recopiés (liens physiques).
rsync -az --delete --link-dest="$base/current/" "$arg/" "$hote:$base/releases/$version/"
ssh "$hote" bash -s -- "$version" "$base" "$garder" <<EOF
set -euo pipefail
cd "\$2"
if [[ -f config.json ]]; then ln -sfn ../../config.json "releases/\$1/config.json"; fi
$bascule
ls -1 releases | sort | awk -v n="\$3" '{ v[NR] = \$0 } END { for (i = 1; i <= NR - n; i++) print v[i] }' |
  while read -r ancienne; do rm -rf "releases/\$ancienne"; done
echo "en ligne : \$1"
EOF
