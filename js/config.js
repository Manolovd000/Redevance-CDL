/*
 * Paramétrage du site — c'est le seul fichier à modifier pour faire évoluer
 * le barème, les libellés ou les fonds de carte.
 *
 * BARÈME : repris du classeur « Simulation-redevance_MS_08.10.26.xlsx ».
 *   Redevance = facteur de durée × (part participants + part linéaire + part emprise + part véhicules)
 *   Barème progressif : chaque part est calculée tranche par tranche, chaque tranche de la
 *   quantité étant facturée à son propre coût unitaire.
 *   « max » est la borne haute de la tranche (comme dans le classeur) ; la dernière tranche n'a pas
 *   de borne haute (max: null).
 */
window.CDL_CONFIG = {

  /*
   * Logo affiché en haut du panneau et sur la fiche exportée, toujours sur fond blanc.
   * Pour le changer, remplacer le fichier (voir le README). Pour le retirer, supprimer ce bloc « logo ».
   */
  logo: {
    fichier: 'img/logo-cdl.jpg',
    alt: 'Conservatoire du littoral',
    lien: 'https://www.conservatoire-du-littoral.fr/'
  },

  versionBareme: 'simulation de redevance manifestations sportives du 08/10/2026',

  bareme: {
    participants: {
      titre: 'Participants',
      unite: 'participant',
      paliers: [
        { max: 100,  cout: 0.5,  libelle: '0 à 100 personnes' },
        { max: 500,  cout: 0.75, libelle: '101 à 500 personnes' },
        { max: 1000, cout: 1,    libelle: '501 à 1 000 personnes' },
        { max: null, cout: 3,    libelle: 'au-delà de 1 000 personnes' }
      ]
    },
    lineaire: {
      titre: 'Linéaire',
      unite: 'mètre',
      paliers: [
        { max: 1000, cout: 0.05,  libelle: '0 à 1 000 m' },
        { max: 3000, cout: 0.075, libelle: '1 001 à 3 000 m' },
        { max: 5000, cout: 0.1,   libelle: '3 001 à 5 000 m' },
        { max: null, cout: 0.125, libelle: 'au-delà de 5 000 m' }
      ]
    },
    emprise: {
      titre: 'Emprise',
      unite: 'm²',
      paliers: [
        { max: 5,    cout: 1,   libelle: '0 à 5 m²' },
        { max: 10,   cout: 1.5, libelle: '6 à 10 m²' },
        { max: 20,   cout: 2,   libelle: '11 à 20 m²' },
        { max: null, cout: 4,   libelle: 'au-delà de 20 m²' }
      ]
    },
    vehicules: {
      titre: 'Véhicules',
      unite: 'véhicule',
      paliers: [
        { max: 1,    cout: 50,  libelle: '1er véhicule' },
        { max: 2,    cout: 75,  libelle: '2e véhicule' },
        { max: 3,    cout: 100, libelle: '3e véhicule' },
        { max: null, cout: 200, libelle: 'à partir du 4e véhicule' }
      ]
    }
  },

  /*
   * Facteur multiplicateur selon le nombre de jours (nombre de jours arrondi à l'entier supérieur).
   * Au-delà du dernier nombre de jours de la liste, le dernier facteur s'applique.
   */
  facteurJours: [
    { jours: 1, facteur: 1 },
    { jours: 2, facteur: 1.2 },
    { jours: 3, facteur: 1.3 },
    { jours: 4, facteur: 1.4 },
    { jours: 5, facteur: 1.5 },
    { jours: 6, facteur: 1.6 },
    { jours: 7, facteur: 1.7 }
  ],

  /* Valeurs proposées à l'ouverture de la fenêtre de paramètres. */
  valeursParDefaut: { jours: 1, participants: 0, emprise: 0, vehicules: 0 },

  /*
   * Fonds de carte (tuiles IGN – Géoplateforme).
   * « Plan IGN » et « Photos aériennes » sont en accès libre.
   * « Carte IGN » (SCAN 25) passe par une clé : remplacer « cle » par celle de l'établissement.
   */
  fonds: [
    {
      id: 'plan', nom: 'Plan IGN', zoomMax: 18,
      url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
    },
    {
      id: 'carte', nom: 'Carte IGN (SCAN 25)', zoomMax: 16, cle: 'ign_scan_ws',
      url: 'https://data.geopf.fr/private/wmts?apikey={cle}&SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
    },
    {
      id: 'photo', nom: 'Photos aériennes', zoomMax: 19,
      url: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'
    }
  ],
  fondParDefaut: 'plan',
  attributionFond: '© IGN – Géoplateforme',
  attributionSites: 'Sites : Conservatoire du littoral / PatriNat',

  /* Emprises proposées dans la liste « Aller à un territoire » : [ouest, sud, est, nord]. */
  territoires: [
    { nom: 'Hexagone',                 bbox: [-5.6, 41.2, 9.8, 51.3] },
    { nom: 'Corse',                    bbox: [8.4, 41.3, 9.7, 43.1] },
    { nom: 'Guadeloupe',               bbox: [-61.9, 15.8, -60.9, 16.6] },
    { nom: 'Martinique',               bbox: [-61.3, 14.3, -60.7, 14.95] },
    { nom: 'Saint-Martin / Saint-Barthélemy', bbox: [-63.2, 17.8, -62.7, 18.2] },
    { nom: 'Guyane',                   bbox: [-54.7, 2.0, -51.5, 6.0] },
    { nom: 'La Réunion',               bbox: [55.1, -21.5, 55.9, -20.8] },
    { nom: 'Mayotte',                  bbox: [44.95, -13.05, 45.33, -12.6] },
    { nom: 'Saint-Pierre-et-Miquelon', bbox: [-56.6, 46.7, -56.0, 47.2] }
  ],

  /* Couleurs de la carte (écran et export). */
  couleurs: {
    siteFond: 'rgba(46, 134, 222, 0.30)',
    siteTrait: '#1B5FAE',
    siteChoisi: '#F2B705',
    trace: '#10283A',
    traceCdl: '#E2431E'
  },

  exemple: { fichier: 'exemples/trail-exemple-mayotte.gpx', nom: 'Trail d\'exemple (tracé fictif, Mayotte)' }
};
