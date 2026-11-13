# Suivi d'audience : événements du widget

Référence des événements envoyés par le widget, pour les exploiter (rapports, synthèse) ou les modifier. État au
13.11.2026, relevé dans le navigateur sur les trois mises en page (mobile, desktop, compact).

## Chaîne d'envoi

1. `index.html` pose `window.blickDataLayer = []` avant le bundle : rien n'est perdu avant le chargement du script.
2. `src/lib/analytics.js` pousse chaque événement dans `window.blickDataLayer` (relu à chaque envoi).
3. `public/js/iframeHeightAdjustment.js` (script Blick, chargé après le bundle) vide le tableau, le remplace par un
   objet `{ push }`, et relaie chaque événement à la page qui contient l'iframe :
   - web : `window.parent.postMessage(message, "*")` ;
   - apps : pont natif iOS (`webkit.messageHandlers.onMessageListener`) ou Android (`BlickAndroidJsBridge`).
4. La page Blick reçoit le message `TRACK` et le transmet à son outil de mesure (GTM / GA4, puis Looker Studio).
   Cette étape est hors de ce dépôt.

Même convention que les autres widgets Blick (`bl-iframe-map-geneve`, `bl-iframe-fourmis`,
`bl-iframe-quiz-multi-euro`, `bl-iframe-cryptolist`…) : `event`, `iframe_name`, `iframe_id`. Différence : ce widget
ajoute des données à certains événements (`point`, `source`, `filter`, `points`). Elles sont relayées telles quelles ;
leur reprise dans les rapports dépend de la configuration côté Blick, non vérifiée.

## Message reçu par la page (web)

Objet poussé par le widget :

```js
{ event: "iframe_click", iframe_name: "storytelling_trafic_routier_explore", iframe_id: "iframe_point_clicked", point: "col-du-gothard", source: "list" }
```

Message relayé par `iframeHeightAdjustment.js` (`event` devient `name`, le reste passe dans `data`) :

```js
{
  blick_event_type: "TRACK",
  type: "TRACK",
  name: "iframe_click",
  iframeId: "<identifiant de l'iframe, posé par le script>",
  data: { iframe_name: "storytelling_trafic_routier_explore", iframe_id: "iframe_point_clicked", point: "col-du-gothard", source: "list" }
}
```

## Nom du widget : `iframe_name`

`storytelling_trafic_routier_<variante>[_<track>]`

| Partie | Valeurs | Source |
|---|---|---|
| `<variante>` | `explore` (défaut) ou `compact` | `?mode=` de l'URL |
| `_<track>` | facultatif : minuscules, chiffres, tirets, 40 caractères au plus ; sinon ignoré (avertissement en console) | `?track=` |

`?track=` sert à séparer dans les rapports les vues d'un même mode intégrées dans des contextes différents : une valeur
par intégration contextualisée. Exemple :
`?mode=compact&points=lausanne-geneve,lausanne-valais%7Cdouane-bardonnex,douane-vallorbe&track=axes-douanes` →
`storytelling_trafic_routier_compact_axes-douanes`.

La mise en page (964 / 632 px / mobile) n'apparaît pas dans le nom : un même `iframe_name` couvre toutes les largeurs.

## Données communes

| Clé | Quand | Valeur |
|---|---|---|
| `points` | mode compact avec `?points=` seulement, sur **tous** ses événements | la sélection telle qu'écrite dans l'URL (`a,b\|c,d`) |

## Événements

| `event` | `iframe_id` | Données | Déclencheur | Mode |
|---|---|---|---|---|
| `iframe_impression` | `iframe_impression` | | affichage du widget, une fois par chargement de page | explore, compact |
| `iframe_click` | `iframe_list_clicked` | | ouverture de la liste : bouton « Liste · N » sur la carte (964 / 632 px) ; bouton liste rond du panneau bas (mobile) | explore |
| `iframe_click` | `iframe_filter_clicked` | `filter` | appui sur le bouton de filtre cyclique ; `filter` = filtre **atteint** après l'appui | explore |
| `iframe_click` | `iframe_point_clicked` | `point`, `source` | choix d'un point : ligne de la liste (`source: "list"`) ou pastille / tracé sur la carte (`source: "map"`) | explore |
| `iframe_click` | `iframe_history_clicked` | `point` | dépliage de « Historique du jour » dans une fiche (desktop et mobile) | explore |
| `iframe_click` | `iframe_see_all_clicked` | | lien « Tout voir » (seulement si `?seeAllUrl=` est fourni) | compact |

### Valeurs

- `filter` : `all` (Tous les points), `jam` (Bouchons), `slow` (Ralentissements), `closed` (Fermetures), `soon`
  (À venir). Le cycle saute les filtres vides : seuls les filtres non vides au moment de l'appui peuvent apparaître.
- `point` : identifiant du point suivi (`gothard`, `col-du-gothard`, `lausanne-geneve`, `lausanne-valais`,
  `grand-st-bernard`, `col-du-grand-st-bernard`, `san-bernardino`, `simplon`, `douane-bardonnex`, `douane-vallorbe`).
- `source` : `list` ou `map`.

### Ce qui n'est pas envoyé

- la présélection par l'URL (`?point=`) : la fiche s'ouvre sans `iframe_point_clicked` ;
- le retour automatique à « Tous les points » quand un rafraîchissement des données vide le filtre en cours ;
- la fermeture de la liste ou de la fiche (croix, bande de carte au-dessus de la liste mobile), le retour « Tous les
  points » de la fiche desktop ;
- le repli de l'historique (seul le dépliage compte) ;
- le survol, les déplacements et zooms de la carte, le bouton maison (retour à la vue d'ensemble, filtre remis à
  « Tous les points » sans `iframe_filter_clicked`) ;
- les rafraîchissements de données, le changement de thème clair / sombre.

### Comptage : à savoir

- `iframe_impression` : une seule fois par chargement, même si React rejoue l'effet en développement.
- `iframe_point_clicked` : à chaque choix, y compris un point déjà ouvert choisi à nouveau, ou un autre point choisi
  sur la carte alors qu'une fiche est ouverte.
- `iframe_filter_clicked` : un événement par appui ; parcourir tout le cycle produit plusieurs événements, le dernier
  porte `filter: "all"`.
- `iframe_history_clicked` : à chaque dépliage (déplier, replier, déplier = 2 événements).
- Mobile : ouvrir la liste puis choisir un point donne `iframe_list_clicked` puis `iframe_point_clicked` (`list`) ;
  un point touché directement sur la carte donne seulement `iframe_point_clicked` (`map`).

## Dans le code

| Événement | Endroit |
|---|---|
| fonctions d'envoi (`trackImpression`, `trackClick`), construction de `iframe_name`, ajout de `points` | `src/lib/analytics.js` |
| `iframe_impression` | `src/App.jsx` (effet au montage) |
| `iframe_list_clicked` | `src/App.jsx`, `openPanel` (bouton « Liste » de `MapView`, bouton liste de `MobileSheet`) |
| `iframe_filter_clicked` | `src/App.jsx`, `changeFilter` (appelé par `CycleFilter` ; pas par le retour automatique) |
| `iframe_point_clicked` | `src/App.jsx`, `selectFrom("list")` / `selectFrom("map")` |
| `iframe_history_clicked` | `src/components/CrossingDetail.jsx`, `History` |
| `iframe_see_all_clicked` | `src/components/CompactView.jsx` |

`trackClick(action, data)` envoie `iframe_click` avec `iframe_id: "iframe_<action>_clicked"` et `data` à plat dans
l'objet. Pour ajouter un événement : appeler `trackClick("<action>", { … })` au bon endroit, puis compléter ce
document (tableau des événements, valeurs, « Dans le code ») et le tableau du README. Renommer un `iframe_id` ou une
clé casse la continuité des rapports existants : à décider avec qui les exploite.

## Vérifier

En local (`npm run dev`), sans iframe autour : la page se poste les messages à elle-même. Dans la console du
navigateur, avant les actions :

```js
window.addEventListener("message", (e) => e.data?.blick_event_type === "TRACK" && console.log(e.data.name, e.data.data));
```

Recharger écoute trop tard pour `iframe_impression` : poser l'écouteur avant le chargement (script d'initialisation
d'un navigateur piloté), ou vérifier l'impression en prod, dans l'outil de mesure Blick (aperçu GTM, temps réel GA4),
filtrée sur `iframe_name` commençant par `storytelling_trafic_routier`.
