# Pistes pour un widget trafic (exploration du 08.10.2026)

Suite de [ETAPE0.md](ETAPE0.md). Rien de ce qui suit n'est encore implémenté, sauf mention contraire.
Les éléments marqués *[hypothèse]* n'ont pas été vérifiés.

## 1. `queueLength` et `severity` toujours vides

- Les deux champs sont **facultatifs** dans DATEX II 2.2.3 (`minOccurs="0"` dans
  `DATEXIISchema_2_2_3 with definitions.xsd`). L'OFROU ne les remplit pas : 0 occurrence sur 3 123 records.
- Les autres champs facultatifs de `AbnormalTraffic` sont absents eux aussi : `numberOfVehiclesWaiting`,
  `trafficTrendType` (bouchon qui s'allonge ou se résorbe), `relativeTrafficFlow`.
- **Longueur du bouchon :** elle est donnée par
  `supplementaryPositionalDescription/affectedCarriagewayAndLanes/lengthAffected` et dans le texte
  (« longueur [km] 5 »), mais seulement quand l'opérateur l'a saisie : 2 bouchons sur 39 au moment du relevé
  (ceux du Gothard).
- **Retard :** `delayTimeValue` est présent dans 2 à 3 records seulement.
- **Origine des messages :** ils sont saisis par VMZ‑CH, les polices cantonales et les services d'entretien,
  puis convertis automatiquement. On voit la trace du système source dans les commentaires internes :
  `((TIC/StationaryTraffic : 1005-54/60))`.
  *[hypothèse]* Ce système ne gère pas de niveau de gravité, donc rien n'est exporté.
- **Profil suisse publié par l'OFROU :** il ne couvre que les compteurs (MeasurementSiteTable / MeasuredData),
  pas les messages trafic. Il n'existe donc pas de liste officielle des champs réellement fournis.
  Question à poser au besoin : verkehrsdaten-plattform@astra.admin.ch.

## 2. Quota et durée de l'accès

Source : [opentransportdata.swiss/en/road-traffic](https://opentransportdata.swiss/en/road-traffic/) et page produit.

- **Accès gratuit :** 6 mois, avec 260 000 appels sur la période (≈ 1 appel/min) et 5 appels/min au maximum.
- **Fin des 6 mois :** l'accès s'arrête, sauf prolongation. Deux façons de prolonger :
  - devenir partenaire en fournissant soi-même des données à la plateforme (accès illimité) ;
  - envoyer une justification écrite à verkehrsdaten-plattform@astra.admin.ch.
  La même adresse traite les demandes de réinitialisation si le quota est épuisé avant la fin.
- **Notre rythme :** un appel toutes les 3 min fait ≈ 480 appels/jour, soit ≈ 87 000 appels en 6 mois.
  Le quota n'est pas un problème.
- **Le HTTP 429 vu à l'étape 0** venait de la limite de 5 appels/min, pas du quota.
- **Polling plus léger, recommandé par la documentation de la plateforme et non implémenté :**
  - un appel complet par jour, sans `If-Modified-Since` ;
  - ensuite, des appels avec `If-Modified-Since` (heure UTC, au plus 5 min dans le passé), qui ne renvoient que les
    messages modifiés.

  Aujourd'hui, le poller télécharge les ≈ 13 Mo complets à chaque relevé.
- Les messages révoqués restent dans le flux pendant 60 min ; le traitement actuel des messages annulés en tient
  compte.

## 3. Données disponibles pour un widget

### a) Dans le flux actuel (« Traffic Situations »), sans nouvel abonnement

| Donnée | Fiabilité | Usage possible |
|---|---|---|
| Fermetures : tunnel, jonctions (« entrée fermée » Airolo / Göschenen), H2 col du Gothard | bonne | bandeau « Tunnel fermé » |
| Heure de début (`created_time`, `validPeriod`) | bonne | « bouchon depuis 10 h 59 » |
| Évolution en km entre versions d'un message | bonne, déjà archivée dans SQLite | « max aujourd'hui : 5 km à 16 h » |
| Cause (`congestion`, accident, véhicule en panne) | moyenne | libellé de cause |
| Bouchons attendus (`probable`, « Stau zu erwarten ») | moyenne | prévision |
| « Aire de dosage » d'Airolo | ponctuelle | mention du dosage poids lourds |
| Chantiers et fermetures nocturnes à venir | bonne, dates précises | liste « Prochaines fermetures » |
| Autres traversées des Alpes : A13 San Bernardino, A9 Simplon, A21 Grand‑Saint‑Bernard | même qualité que le Gothard | comparateur « Par où passer ? » |
| Cols fermés (Grimsel, H2 Gothard, Furka…) | dépend de la saisie cantonale | widget saisonnier |
| Vue nationale : nombre de bouchons et d'accidents | bonne pour le nombre, km rarement présents | baromètre national |

**Relevé du 08.10.2026 sur les situations actives :**
- Types de records : AbnormalTraffic 592, MaintenanceWorks 679, RoadOrCarriagewayOrLaneManagement 738,
  ReroutingManagement 166, ConstructionWorks 123, Accident 3, VehicleObstruction 8, PublicEvent 11.
- 8 fermetures ou restrictions déjà annoncées sur le corridor du Gothard, la première étant la fermeture du H2
  entre Airolo et Hospental.

### b) Compteurs routiers en temps réel : l'ajout le plus utile

C'est le produit « Road traffic – traffic counters ». Il faut l'ajouter à l'application sur api-manager ; la clé
actuelle ne le couvre pas.

- **Appel :** SOAP sur `https://api.opentransportdata.swiss/TDP/Soap_Datex2/Pull`, avec l'en-tête SOAPAction
  `http://opentransportdata.swiss/TDP/Soap_Datex2/Pull/v1/pullMeasuredData`.
  Documentation : [cookbook compteurs](https://opentransportdata.swiss/en/cookbook/rt-road-traffic-counters/).
- **Contenu, chaque minute, par voie et par sens :**
  - débit (véhicules/h) et vitesse moyenne ;
  - voitures (classes 1–7, index 11/12) et poids lourds (classes 8–10, index 21/22) séparés.
- **Filtre :** on peut demander un seul poste de comptage par son identifiant (ex. `CH:0010/#`).
- **Liste des postes :** [trafficcounters](https://data.opentransportdata.swiss/de/dataset/trafficcounters)
  (V25 du 18.09.2026, 2 492 enregistrements).
- **Postes dans la zone du Gothard, identifiant (lat, lon) :**
  - CH:0010 (46.62, 8.56), CH:0150 (46.67, 8.59), CH:0195 (46.79, 8.67), CH:0196 (46.64, 8.59)
  - CH:0261 (46.64, 8.61), CH:0262 (46.72, 8.57), CH:0293 (46.51, 8.71), CH:0528 (46.73, 8.63)
  - CH:0529 (46.69, 8.60), CH:0582 (46.64, 8.60), CH:0627 (46.52, 8.56)
- **Détecteurs :** chaque poste a des détecteurs `.01` / `.02` (parfois `.03` / `.04`), avec le sens en alertC
  (`negative` / `positive`).
- *[hypothèse]* Placement sur l'A2 d'après les coordonnées : CH:0195 (vers Amsteg), CH:0528 (vers Gurtnellen),
  CH:0150 et CH:0529 (vers Göschenen), CH:0293 (vers Airolo / Quinto). La liste ne donne pas les noms et les
  coordonnées sont arrondies à ≈ 1 km : à confirmer sur le
  [tableau de bord ASTRA](https://fedro.maps.arcgis.com/apps/dashboards/1673b262537546098589ad3820e5ece2).
- **Ce que ça permet :**
  - un état mesuré, même sans message (« 8 km/h à Göschenen vers le sud ») ;
  - le débit de véhicules et la part de poids lourds ;
  - une confirmation de fermeture du tunnel (débit à zéro).
- **Limite :** une vitesse mesurée en un point ne donne pas un temps de parcours.

### c) Temps perdu : estimation

- **Règle de calcul :** le flux ne le donne presque jamais. La presse et les services d'info trafic utilisent une
  règle simple au Gothard : environ **10 à 12 min d'attente par km**.
  - Exemples relayés par la presse : 8 km ≈ 80 min, 10 km ≈ 100 min
    ([Tages‑Anzeiger](https://www.tagesanzeiger.ch/gotthard-stau-10-kilometer-wartezeit-am-nordportal-383229920894)).
  - Ça varie beaucoup : Blick a aussi rapporté 180 min pour 10 km tôt le matin.
- **Affichage :** toujours comme estimation, par exemple « ≈ 50 min (estimation) ».

### d) Hors de ces flux (non testé)

- **Table de localisation des codes TMC (versions 7.3 / 7.5) :** sur demande par e‑mail à l'OFROU.
  Elle permet de placer les codes alertC sur une carte.
- **OJP (calcul d'itinéraire en transports publics) :** il figure dans la liste des produits du compte.
  Il permet d'afficher le temps du même trajet en train à côté du bouchon.
- **API commerciales (TomTom, HERE, Google) :** temps de parcours réels, mais payants.
- **Jeu de données sur les feux de circulation :** il existe, mais n'est pas pertinent ici.

## 4. Recommandation (en attente de choix)

1. **Gothard :** état par sens, avec la durée du bouchon et une estimation du temps perdu clairement indiquée
   comme telle, plus un bandeau fermetures et la liste des prochaines fermetures.
2. **Vitesse mesurée** par les compteurs, dès que le produit est ajouté au compte.
3. **Comparateur des traversées alpines :** même code, filtre élargi.
4. **Polling plus léger** avec `If-Modified-Since`.
