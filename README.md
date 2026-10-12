# Redevance trail – terrains du Conservatoire du littoral

Site web statique (première ébauche) pour estimer la redevance d'un trail dont le tracé traverse des terrains du Conservatoire du littoral.

## Ce que fait le site

- Carte de tous les sites du Conservatoire (814 sites, Hexagone et outre-mer), en zonage bleu sur fond IGN.
- Recherche d'un site par son nom, ou accès direct à un territoire.
- Import d'un tracé GPX (bouton ou glisser-déposer). Le fichier reste dans le navigateur : rien n'est envoyé.
- Mesure automatique du linéaire du tracé situé à l'intérieur des terrains, avec le détail par site.
- Modification du tracé à la main : couper un tronçon (deux clics sur le tracé), ajouter un tronçon (clics sur la carte, accroche automatique au tracé et à ses extrémités), annuler la dernière modification ou revenir au tracé importé. Longueurs et redevance sont recalculées à chaque modification.
- Téléchargement du tracé, modifié ou non, au format GPX.
- Passages en bordure des terrains : le site repère les portions du tracé situées sur les terrains mais à moins de 15 m de leur limite (distance réglable : 10, 15, 25 ou 50 m ; réglages dans `bordure` de `js/config.js`). Après vérification sur la carte, chaque passage peut être coché pour ne pas être compté dans le linéaire, ou tous d'un coup avec la case générale. Les passages cochés sont surlignés en jaune sur la carte et sur la fiche. Une limite commune à deux sites du Conservatoire n'est pas considérée comme une bordure.
- Fenêtre de paramètres : nom du trail, nombre de jours, participants, linéaire, emprise au sol, véhicules.
- Calcul de la redevance et affichage du détail par poste.
- Téléchargement d'une fiche A4 en image (PNG) ou en PDF : logo, carte du tracé et des terrains, détail du calcul, montant final.

## Mise en ligne avec GitHub Pages

1. Créer un dépôt public sur GitHub.
2. Déposer **le contenu** de ce dossier à la racine du dépôt (`index.html` doit être à la racine).
3. Dans le dépôt : *Settings* > *Pages* > *Build and deployment* > *Source* : « Deploy from a branch », branche `main`, dossier `/ (root)`.
4. Le site est disponible après une à deux minutes à l'adresse `https://<compte>.github.io/<dépôt>/`.

Le site fonctionne aussi hors ligne de GitHub : un double-clic sur `index.html` suffit pour l'essayer (une connexion internet reste nécessaire pour les fonds de carte IGN).

## Mettre à jour le site sans gêner les visiteurs

- Déposer tous les fichiers modifiés **en une seule fois** (*Add file* > *Upload files*, un seul *Commit changes*) : le site bascule d'un coup sur la nouvelle version.
- À chaque mise à jour, **augmenter de 1 le numéro de version** en haut de `index.html` (`window.CDL_VERSION = '1'` devient `'2'`, etc.). Les navigateurs des visiteurs rechargent alors tous les fichiers au lieu de garder d'anciennes versions en mémoire.

## Formule de calcul

Reprise du classeur `Simulation-redevance_MS_08.10.26.xlsx` :

```
Redevance = facteur de durée × (part participants + part linéaire + part emprise + part véhicules)
```

Barème progressif : chaque tranche de la quantité est facturée à son propre coût unitaire. Exemple : 250 participants = 100 × 0,50 € + 150 × 0,75 € = 162,50 €.

| Participants | € par participant | | Linéaire | € par mètre |
|---|---|---|---|---|
| 0 à 100 | 0,50 | | 0 à 1 000 m | 0,05 |
| 101 à 500 | 0,75 | | 1 001 à 3 000 m | 0,075 |
| 501 à 1 000 | 1,00 | | 3 001 à 5 000 m | 0,10 |
| au-delà de 1 000 | 3,00 | | au-delà de 5 000 m | 0,125 |

| Emprise | € par m² | | Véhicules | € par véhicule |
|---|---|---|---|---|
| 0 à 5 m² | 1,00 | | 1er véhicule | 50 |
| 6 à 10 m² | 1,50 | | 2e véhicule | 75 |
| 11 à 20 m² | 2,00 | | 3e véhicule | 100 |
| au-delà de 20 m² | 4,00 | | à partir du 4e | 200 |

| Nombre de jours | 1 | 2 | 3 | 4 | 5 | 6 | 7 et plus |
|---|---|---|---|---|---|---|---|
| Facteur de durée | 1 | 1,2 | 1,3 | 1,4 | 1,5 | 1,6 | 1,7 |

Les quantités sont arrondies à l'unité (mètre, m², personne) avant le calcul. Le calcul du site a été comparé au classeur sur 63 cas, bornes de tranches et durées de 1 à 10 jours comprises : résultats identiques.

## Modifier le barème ou les réglages

Tout se règle dans `js/config.js` :

- `bareme` : tranches (`max` = borne haute, `null` pour la dernière ; `cout` = coût unitaire) ;
- `facteurJours` : facteur multiplicateur selon le nombre de jours ;
- `versionBareme` : mention reprise en pied de fiche ;
- `fonds` : fonds de carte IGN. Le fond « Carte IGN (SCAN 25) » passe par une clé (`cle`) à remplacer par celle de l'établissement ;
- `valeursParDefaut`, `territoires`, `couleurs`.

## Logo

- Le logo du Conservatoire figure en haut du panneau et en tête de la fiche exportée, sur fond blanc.
- Pour le changer : remplacer `img/logo-cdl.jpg` par le nouveau fichier (même nom), puis lancer `python scripts/logo_vers_js.py img/logo-cdl.jpg img/logo-cdl.js`. Cette seconde étape ne sert qu'à l'essai par double-clic ; une fois le site en ligne, le fichier image suffit.
- Pour un autre nom ou un autre format (PNG, SVG), modifier `logo.fichier` dans `js/config.js`.

## Mettre à jour les sites

Les périmètres proviennent du flux WFS de l'IGN (Géoplateforme), couche `patrinat_cdl:conservatoire_littoral` (sites acquis, source PatriNat / Conservatoire du littoral), extraction du 07/10/2026.

1. Dans QGIS, exporter la couche en GeoJSON, en EPSG:4326.
2. Lancer : `python scripts/prep_sites.py export.geojson data/sites_cdl.js 2 5` (nécessite le module `shapely`).

Le script ne garde que les polygones, simplifie les contours à 2 m près et écrit `data/sites_cdl.js`.

## Limites de cette ébauche

- Le linéaire est mesuré sur des périmètres simplifiés à 2 m : l'écart peut atteindre quelques mètres à chaque franchissement de limite.
- Le linéaire dépend de la qualité du GPX fourni par l'organisateur.
- Un tronçon parcouru plusieurs fois (aller-retour, boucles) est compté autant de fois qu'il figure dans le GPX.
- Les noms de sites sont ceux du flux, sans correction.
- La fiche PDF est une image : son texte n'est pas sélectionnable.
- Montants indicatifs, sans valeur contractuelle.

## Organisation des fichiers

```
index.html              page unique
css/style.css           mise en forme
js/config.js            barème et réglages
js/redevance.js         calcul de la redevance
js/geo.js               lecture du GPX, croisement tracé / terrains
js/export.js            fiche A4, export PNG et PDF
js/app.js               interface
data/sites_cdl.js       périmètres des sites
img/                    logo du Conservatoire du littoral
exemples/               tracé d'exemple (fictif) à Mayotte
scripts/prep_sites.py   préparation des périmètres
scripts/logo_vers_js.py copie de secours du logo
vendor/                 Leaflet 1.9.4 (BSD-2), polices Source Sans 3 et Source Serif 4 (OFL)
```
