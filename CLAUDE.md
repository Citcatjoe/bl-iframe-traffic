# Règles pour les agents : bl-iframe-traffic

## Documentation du VPS Pegasus (décision du 03.11.2026)

- **Ici** : seulement l'usage que ce projet fait de Pegasus, dans [PLAN-VPS.md](PLAN-VPS.md) : ce qu'il y installe
  (`deploy/`), comment la donnée OFROU y est relevée, mise en cache et servie au widget, déploiement, quota,
  exploitation propre au projet. À tenir à jour à chaque changement de `server/`, `deploy/` ou du cache.
- **Dans brain** (`~/Documents/___www/brain/homelab/machines/pegasus/`, dépôt `Citcatjoe/brain`) : tout ce qui
  concerne le serveur lui-même (inventaire de ce qu'il héberge, accès, système, réseau, Caddy principal,
  surveillance, sauvegarde, capacité, historique des interventions). Après un déploiement ou un changement visible
  sur le serveur : une ligne dans `10-historique.md`, et `06-services.md` si l'installation du projet change. Suivre
  l'`AGENTS.md` de brain (`git pull` avant, petit commit et `git push` juste après).
- Ne pas recopier ici la doc générale du serveur, ni l'inverse : renvoyer vers l'autre.
