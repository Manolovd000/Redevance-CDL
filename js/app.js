/*
 * Interface : carte, recherche de site, import du GPX, fenêtre de paramètres, redevance, exports.
 */
(function () {
  'use strict';

  var cfg = window.CDL_CONFIG, geo = window.CDL.geo, R = window.CDL.redevance, exporter = window.CDL.exporter;
  var $ = function (id) { return document.getElementById(id); };
  var versionner = window.CDL_V || function (u) { return u; };

  var etat = {
    fond: cfg.fondParDefaut,
    index: null,          // sites indexés pour les croisements
    trace: null,          // { nom, segments, croisement }
    params: null,         // { nom, jours, participants, lineaire, emprise, vehicules }
    resultat: null
  };
  window.CDL.etat = etat; // pratique pour le débogage

  /* ================================================================ Carte */
  var carte = L.map('carte', { preferCanvas: true, zoomControl: false, worldCopyJump: true });
  window.CDL.carte = carte; // pratique pour le débogage
  L.control.zoom({ position: 'topright', zoomInTitle: 'Zoomer', zoomOutTitle: 'Dézoomer' }).addTo(carte);
  L.control.scale({ imperial: false, position: 'bottomright' }).addTo(carte);
  carte.attributionControl.setPrefix(false);

  var fonds = {}, idDuFond = {};
  cfg.fonds.forEach(function (f) {
    var couche = L.tileLayer(f.url.replace('{cle}', f.cle || ''), {
      maxNativeZoom: f.zoomMax, maxZoom: 19, attribution: cfg.attributionFond
    });
    fonds[f.nom] = couche; idDuFond[f.nom] = f.id;
    if (f.id === etat.fond) couche.addTo(carte);
  });
  L.control.layers(fonds, null, { position: 'topright', collapsed: false }).addTo(carte);
  carte.on('baselayerchange', function (e) { etat.fond = idDuFond[e.name] || etat.fond; });

  var legende = L.control({ position: 'bottomleft' });
  legende.onAdd = function () {
    var d = L.DomUtil.create('div', 'legende');
    d.innerHTML = '<div><i class="l-site"></i>Terrains du Conservatoire</div>' +
      '<div class="l-si-trace" hidden><i class="l-cdl"></i>Tracé sur les terrains</div>' +
      '<div class="l-si-trace" hidden><i class="l-trace"></i>Tracé hors terrains</div>' +
      '<div class="l-si-bord" hidden><i class="l-bord"></i>Passage en bordure, à vérifier</div>' +
      '<div class="l-si-exclu" hidden><i class="l-exclu"></i>Bordure non comptée</div>';
    return d;
  };
  legende.addTo(carte);

  function versBounds(b) { return L.latLngBounds([b[1], b[0]], [b[3], b[2]]); }
  carte.fitBounds(versBounds(cfg.territoires[0].bbox));

  var coucheSites = null, coucheChoix = L.layerGroup().addTo(carte), coucheTrace = L.layerGroup().addTo(carte);
  var coucheBordure = L.layerGroup().addTo(carte);

  function bulleSite(f) {
    var p = f.properties, d = document.createElement('div');
    var n = document.createElement('p'); n.className = 'bulle-nom'; n.textContent = p.nom; d.appendChild(n);
    var i = document.createElement('p'); i.className = 'bulle-info';
    i.textContent = p.terr + (p.ha ? ' · environ ' + R.nombre(p.ha) + ' ha' : '');
    d.appendChild(i);
    if (p.inpn) {
      var l = document.createElement('p'); l.className = 'bulle-info';
      var a = document.createElement('a');
      a.href = 'https://inpn.mnhn.fr/espace/protege/' + encodeURIComponent(p.inpn);
      a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Fiche du site sur l\'INPN';
      l.appendChild(a); d.appendChild(l);
    }
    return d;
  }

  function montrerSite(f, ouvrirBulle) {
    coucheChoix.clearLayers();
    L.geoJSON(f, { interactive: false, style: { color: cfg.couleurs.siteChoisi, weight: 4, fill: false } }).addTo(coucheChoix);
    carte.fitBounds(versBounds(f.bbox), { padding: [60, 60], maxZoom: 16 });
    if (ouvrirBulle) L.popup().setLatLng([f.properties.c[1], f.properties.c[0]]).setContent(bulleSite(f)).openOn(carte);
  }

  /* ============================================================ Sites */
  var sitesRecherche = [];

  function sansAccent(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' '); }

  function sitesCharges() {
    var fc = window.CDL_SITES;
    etat.index = geo.indexerSites(fc);
    coucheSites = L.geoJSON(fc, {
      style: { color: cfg.couleurs.siteTrait, weight: 1.2, fillColor: '#2E86DE', fillOpacity: 0.30 }
    }).addTo(carte);
    coucheSites.on('click', function (e) {
      if (ed.actif && ed.outil) return;
      L.popup().setLatLng(e.latlng).setContent(bulleSite(e.layer.feature)).openOn(carte);
    });
    coucheTrace.eachLayer(function (l) { if (l.bringToFront) l.bringToFront(); });
    sitesRecherche = fc.features.map(function (f) { return { f: f, cle: sansAccent(f.properties.nom + ' ' + f.properties.terr) }; });
    $('recherche').disabled = false; $('btn-gpx').disabled = false; $('btn-exemple').disabled = false;
    var m = fc.meta || {};
    $('etat-sites').textContent = R.nombre(fc.features.length) + ' sites sur la carte. Cliquer sur un site pour afficher son nom.';
    $('pied-donnees').textContent = 'Périmètres : ' + (m.source || 'Conservatoire du littoral') +
      (m.extraction ? ', extraction du ' + m.extraction.split('-').reverse().join('/') : '') + '.';
  }

  (function chargerSites() {
    var s = document.createElement('script');
    s.src = versionner('data/sites_cdl.js');
    s.onload = function () { setTimeout(sitesCharges, 0); };
    s.onerror = function () {
      $('etat-sites').textContent = 'Les sites n\'ont pas pu être chargés (fichier data/sites_cdl.js introuvable). Recharger la page.';
      $('etat-sites').className = 'alerte';
    };
    document.body.appendChild(s);
  })();

  /* -------- Recherche */
  var champ = $('recherche'), liste = $('resultats'), propositions = [], actif = -1;

  function fermerListe() { liste.hidden = true; champ.setAttribute('aria-expanded', 'false'); actif = -1; }

  function chercher() {
    var q = sansAccent(champ.value).trim();
    liste.textContent = '';
    if (q.length < 2) { fermerListe(); return; }
    var mots = q.split(/\s+/);
    propositions = sitesRecherche.filter(function (s) {
      return mots.every(function (m) { return s.cle.indexOf(m) >= 0; });
    }).sort(function (a, b) {
      var da = a.cle.indexOf(q) === 0 ? 0 : 1, db = b.cle.indexOf(q) === 0 ? 0 : 1;
      return da - db || a.cle.localeCompare(b.cle);
    }).slice(0, 12);
    if (!propositions.length) {
      var li = document.createElement('li'); li.className = 'aucun';
      li.textContent = 'Aucun site ne porte ce nom. Essayer un mot plus court.';
      liste.appendChild(li);
    }
    propositions.forEach(function (s, i) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option'); li.id = 'res-' + i; li.setAttribute('aria-selected', 'false');
      var a = document.createElement('span'); a.className = 'lieu'; a.textContent = s.f.properties.nom;
      var b = document.createElement('span'); b.className = 'ou'; b.textContent = s.f.properties.terr;
      li.appendChild(a); li.appendChild(b);
      li.addEventListener('mousedown', function (e) { e.preventDefault(); choisir(i); });
      liste.appendChild(li);
    });
    liste.hidden = false; champ.setAttribute('aria-expanded', 'true'); actif = -1;
  }

  function choisir(i) {
    var s = propositions[i];
    if (!s) return;
    champ.value = s.f.properties.nom;
    fermerListe();
    montrerSite(s.f, true);
  }

  function activer(i) {
    var items = liste.querySelectorAll('[role=option]');
    if (!items.length) return;
    actif = (i + items.length) % items.length;
    items.forEach(function (li, n) { li.setAttribute('aria-selected', n === actif ? 'true' : 'false'); });
    items[actif].scrollIntoView({ block: 'nearest' });
    champ.setAttribute('aria-activedescendant', items[actif].id);
  }

  champ.addEventListener('input', chercher);
  champ.addEventListener('blur', function () { setTimeout(fermerListe, 120); });
  champ.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (liste.hidden) chercher(); activer(actif + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activer(actif - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); choisir(actif >= 0 ? actif : 0); }
    else if (e.key === 'Escape') { fermerListe(); }
  });

  var selTerr = $('territoire');
  cfg.territoires.forEach(function (t, i) {
    var o = document.createElement('option'); o.value = i; o.textContent = t.nom; selTerr.appendChild(o);
  });
  selTerr.addEventListener('change', function () {
    var t = cfg.territoires[selTerr.value];
    if (t) carte.fitBounds(versBounds(t.bbox));
  });

  /* ============================================================= Tracé */
  function erreurGpx(msg) { var e = $('erreur-gpx'); e.textContent = msg || ''; e.hidden = !msg; }

  function chargerTexteGpx(texte, nomFichier) {
    erreurGpx('');
    var gpx;
    try { gpx = geo.lireGPX(texte); }
    catch (err) { erreurGpx(err.message); return; }
    var nom = gpx.nom || String(nomFichier || '').replace(/\.gpx$/i, '').replace(/[_-]+/g, ' ').trim() || 'Trail sans nom';
    var croisement = geo.croiser(gpx.segments, etat.index);
    if (ed.actif) fermerEdition();
    ed.historique = [];
    etat.trace = { nom: nom, segments: gpx.segments, croisement: croisement, modifications: 0 };
    calculerBordures();
    etat.resultat = null;
    var prec = etat.params || {};
    etat.params = {
      nom: nom,
      jours: prec.jours || cfg.valeursParDefaut.jours,
      participants: prec.participants !== undefined ? prec.participants : cfg.valeursParDefaut.participants,
      lineaire: lineaireRetenu(),
      emprise: prec.emprise !== undefined ? prec.emprise : cfg.valeursParDefaut.emprise,
      vehicules: prec.vehicules !== undefined ? prec.vehicules : cfg.valeursParDefaut.vehicules
    };
    carte.closePopup();
    coucheChoix.clearLayers();
    dessinerTrace();
    afficherTrace();
    afficherRedevance();
    ouvrirFenetre();
  }

  function latlngs(pts) { return pts.map(function (p) { return [p[1], p[0]]; }); }

  function dessinerTrace(cadrer) {
    coucheTrace.clearLayers();
    document.querySelectorAll('.l-si-trace').forEach(function (el) { el.hidden = !etat.trace; });
    if (!etat.trace) { dessinerBordures(); return; }
    var t = etat.trace, c = cfg.couleurs;
    t.segments.forEach(function (s) { L.polyline(latlngs(s), { color: '#FFFFFF', weight: 7, opacity: 0.9, interactive: false }).addTo(coucheTrace); });
    t.segments.forEach(function (s) { L.polyline(latlngs(s), { color: c.trace, weight: 3, interactive: false }).addTo(coucheTrace); });
    t.croisement.tronconsCdl.forEach(function (s) { L.polyline(latlngs(s), { color: c.traceCdl, weight: 5, interactive: false }).addTo(coucheTrace); });
    var premier = t.segments[0][0], dern = t.segments[t.segments.length - 1];
    var fin = dern[dern.length - 1];
    L.circleMarker([fin[1], fin[0]], { radius: 6, color: '#FFFFFF', weight: 2, fillColor: c.trace, fillOpacity: 1 }).bindTooltip('Arrivée').addTo(coucheTrace);
    L.circleMarker([premier[1], premier[0]], { radius: 6, color: c.trace, weight: 2.5, fillColor: '#FFFFFF', fillOpacity: 1 }).bindTooltip('Départ').addTo(coucheTrace);
    if (cadrer !== false) carte.fitBounds(versBounds(t.croisement.bbox), { padding: [50, 50] });
    dessinerBordures();
  }

  /* -------- Passages en bordure des terrains */
  etat.seuilBordure = cfg.bordure.seuilParDefaut;
  var selSeuil = $('bordure-seuil'); // déplacé entre deux emplacements selon le cas

  function calculerBordures() {
    var t = etat.trace;
    t.bordures = geo.bordures(t.croisement.tronconsCdl, etat.index, etat.seuilBordure, cfg.bordure.longueurMin);
    t.exclus = {};
  }
  function longueurExclue() {
    var t = etat.trace;
    return (t.bordures || []).reduce(function (s, b) { return s + (t.exclus[b.id] ? b.longueur : 0); }, 0);
  }
  function lineaireRetenu() {
    return Math.round(Math.max(0, etat.trace.croisement.longueurCdl - longueurExclue()));
  }
  function majLineaire() {
    etat.params.lineaire = lineaireRetenu();
    if (etat.resultat) etat.resultat = R.calculer(etat.params, cfg.bareme, cfg.facteurJours);
    afficherTrace();
    afficherRedevance();
    dessinerBordures();
  }

  function dessinerBordures() {
    coucheBordure.clearLayers();
    var t = etat.trace, liste = t ? t.bordures || [] : [];
    var nbExclus = liste.filter(function (b) { return t.exclus[b.id]; }).length;
    document.querySelectorAll('.l-si-bord').forEach(function (el) { el.hidden = liste.length === nbExclus; });
    document.querySelectorAll('.l-si-exclu').forEach(function (el) { el.hidden = !nbExclus; });
    liste.forEach(function (b) {
      var ll = latlngs(b.points);
      if (t.exclus[b.id]) {
        L.polyline(ll, { color: '#10283A', weight: 11, opacity: 0.9, interactive: false }).addTo(coucheBordure);
        L.polyline(ll, { color: cfg.couleurs.bordure, weight: 7, interactive: false }).addTo(coucheBordure);
      } else {
        L.polyline(ll, { color: cfg.couleurs.bordure, weight: 3, dashArray: '6 7', interactive: false }).addTo(coucheBordure);
      }
    });
  }

  (function () {
    var sel = selSeuil;
    cfg.bordure.seuils.forEach(function (s) {
      var o = document.createElement('option'); o.value = s; o.textContent = s + ' m';
      if (s === cfg.bordure.seuilParDefaut) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      etat.seuilBordure = Number(sel.value);
      if (!etat.trace) return;
      calculerBordures();
      majLineaire();
    });
    $('bordure-toutes').addEventListener('change', function (e) {
      etat.trace.bordures.forEach(function (b) { if (e.target.checked) etat.trace.exclus[b.id] = true; else delete etat.trace.exclus[b.id]; });
      majLineaire();
    });
    $('bordure-liste').addEventListener('change', function (e) {
      var id = Number(e.target.getAttribute('data-id'));
      if (!id) return;
      if (e.target.checked) etat.trace.exclus[id] = true; else delete etat.trace.exclus[id];
      majLineaire();
    });
    $('bordure-liste').addEventListener('click', function (e) {
      var id = Number(e.target.getAttribute('data-voir'));
      if (!id) return;
      var b = etat.trace.bordures.filter(function (x) { return x.id === id; })[0];
      if (b) carte.fitBounds(L.latLngBounds(latlngs(b.points)), { padding: [80, 80], maxZoom: 17 });
    });
  })();

  function afficherBordures() {
    var t = etat.trace, liste = t.bordures || [], ul = $('bordure-liste');
    $('bordure').hidden = !liste.length;
    var aucune = $('bordure-aucune');
    aucune.hidden = liste.length > 0 || !t.croisement.sites.length;
    aucune.textContent = 'Aucun passage en bordure des terrains (à moins de ' + etat.seuilBordure + ' m de leur limite). ';
    if (!liste.length) {
      // permet de changer la distance même quand rien n'est détecté
      if (!aucune.hidden) {
        aucune.appendChild(document.createTextNode('Distance : ')); aucune.appendChild(selSeuil);
      }
      return;
    }
    var note = document.querySelector('#bordure .note');
    if (selSeuil.parentNode !== note) note.insertBefore(selSeuil, note.childNodes[1]);
    var total = liste.reduce(function (s, b) { return s + b.longueur; }, 0);
    var nbExclus = liste.filter(function (b) { return t.exclus[b.id]; }).length;
    var toutes = $('bordure-toutes');
    toutes.checked = nbExclus === liste.length;
    toutes.indeterminate = nbExclus > 0 && nbExclus < liste.length;
    $('bordure-total').textContent = '(' + R.nombre(total) + ' m, ' + liste.length + ' passage' + (liste.length > 1 ? 's' : '') + ')';
    ul.textContent = '';
    liste.forEach(function (b, i) {
      var li = document.createElement('li'), lab = document.createElement('label'), cb = document.createElement('input');
      var txtSpan = document.createElement('span'), site = document.createElement('span'), lg = document.createElement('span'), voir = document.createElement('button');
      if (t.exclus[b.id]) li.className = 'exclu';
      lab.className = 'case';
      cb.type = 'checkbox'; cb.checked = !!t.exclus[b.id]; cb.setAttribute('data-id', b.id);
      cb.setAttribute('aria-label', 'Ne pas compter le passage ' + (i + 1));
      txtSpan.appendChild(document.createTextNode('Passage ' + (i + 1) + (b.site ? ', ' : '')));
      site.className = 'site'; site.textContent = b.site; txtSpan.appendChild(site);
      lab.appendChild(cb); lab.appendChild(txtSpan);
      lg.className = 'long'; lg.textContent = R.nombre(b.longueur) + ' m';
      voir.type = 'button'; voir.className = 'lien petit'; voir.textContent = 'Voir'; voir.setAttribute('data-voir', b.id);
      li.appendChild(lab); li.appendChild(lg); li.appendChild(voir); ul.appendChild(li);
    });
  }

  function afficherTrace() {
    var t = etat.trace;
    $('import').hidden = !!t; $('trace').hidden = !t;
    if (!t) return;
    var c = t.croisement;
    $('trace-nom').textContent = etat.params.nom;
    $('trace-total').textContent = R.distance(c.longueurTotale);
    $('trace-cdl').textContent = R.nombre(c.longueurCdl) + ' m';
    $('trace-vide').hidden = c.sites.length > 0;
    var exclu = longueurExclue();
    $('ligne-exclu').hidden = $('ligne-retenu').hidden = !(exclu > 0);
    $('trace-exclu').textContent = '− ' + R.nombre(exclu) + ' m';
    $('trace-retenu').textContent = R.nombre(lineaireRetenu()) + ' m';
    afficherBordures();
    var nbModif = t.modifications || 0;
    $('trace-modifie').hidden = !nbModif;
    $('trace-modifie').textContent = nbModif ? 'Tracé modifié à la main (' + nbModif + ' modification' + (nbModif > 1 ? 's' : '') + ').' : '';
    var ul = $('trace-sites'); ul.textContent = '';
    c.sites.forEach(function (s) {
      var li = document.createElement('li'), b = document.createElement('button'), m = document.createElement('span');
      b.type = 'button'; b.className = 'lien'; b.textContent = s.nom; b.title = 'Voir ce site sur la carte';
      b.addEventListener('click', function () { montrerSite(etat.index.fc.features[s.index], false); });
      m.textContent = R.nombre(s.metres) + ' m';
      li.appendChild(b); li.appendChild(m); ul.appendChild(li);
    });
  }

  function retirerTrace() {
    if (ed.actif) fermerEdition();
    ed.historique = [];
    etat.trace = null; etat.resultat = null;
    coucheChoix.clearLayers();
    dessinerTrace(); afficherTrace(); afficherRedevance(); erreurGpx('');
  }

  function lireFichier(f) {
    if (!f) return;
    if (!etat.index) { erreurGpx('Les sites sont encore en cours de chargement. Réessayer dans un instant.'); return; }
    var lecteur = new FileReader();
    lecteur.onload = function () { chargerTexteGpx(String(lecteur.result), f.name); };
    lecteur.onerror = function () { erreurGpx('Le fichier n\'a pas pu être lu.'); };
    lecteur.readAsText(f);
  }

  $('btn-gpx').addEventListener('click', function () { $('fichier-gpx').click(); });
  $('btn-autre').addEventListener('click', function () { $('fichier-gpx').click(); });
  $('fichier-gpx').addEventListener('change', function (e) { lireFichier(e.target.files[0]); e.target.value = ''; });
  $('btn-retirer').addEventListener('click', retirerTrace);
  $('btn-exemple').addEventListener('click', function () {
    if (window.CDL_EXEMPLE_GPX) chargerTexteGpx(window.CDL_EXEMPLE_GPX, cfg.exemple.nom);
    else erreurGpx('Le tracé d\'exemple est introuvable. Importer le fichier ' + cfg.exemple.fichier + ' à la main.');
  });

  /* ===================================================== Modification du tracé */
  var coucheEdition = L.layerGroup().addTo(carte);
  var TOL = 16; // tolérance d'accroche au tracé, en pixels écran
  var ed = { actif: false, outil: null, coupe: [], dessin: [], historique: [] };

  function copieSegments(segs) { return segs.map(function (s) { return s.slice(); }); }
  function memePoint(a, b) { return Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9; }
  function nettoyer(seg) { // retire les points répétés
    return seg.filter(function (p, i) { return i === 0 || !memePoint(p, seg[i - 1]); });
  }

  /** Point du tracé le plus proche d'un clic (en pixels écran). */
  function surLeTrace(latlng) {
    var p = carte.latLngToLayerPoint(latlng), mieux = null;
    etat.trace.segments.forEach(function (seg, s) {
      var a = carte.latLngToLayerPoint([seg[0][1], seg[0][0]]);
      for (var i = 0; i < seg.length - 1; i++) {
        var b = carte.latLngToLayerPoint([seg[i + 1][1], seg[i + 1][0]]);
        var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
        var t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
        var d = Math.sqrt(Math.pow(p.x - a.x - t * dx, 2) + Math.pow(p.y - a.y - t * dy, 2));
        if (!mieux || d < mieux.d) mieux = { d: d, s: s, i: i, t: t };
        a = b;
      }
    });
    if (!mieux) return null;
    // priorité aux extrémités des morceaux (départ, arrivée, bords d'une coupe) pour pouvoir les prolonger
    var bout = null;
    etat.trace.segments.forEach(function (sg, s) {
      [[0, true], [sg.length - 1, false]].forEach(function (e) {
        var q = sg[e[0]], d = carte.latLngToLayerPoint([q[1], q[0]]).distanceTo(p);
        if (d <= 12 && (!bout || d < bout.d)) {
          bout = { d: d, s: s, i: e[1] ? 0 : sg.length - 2, t: e[1] ? 0 : 1, pt: q.slice(),
            pos: e[0], debut: e[1], fin: !e[1] };
        }
      });
    });
    if (bout) return bout;
    var seg = etat.trace.segments[mieux.s], A = seg[mieux.i], B = seg[mieux.i + 1];
    // accroche franche sur les sommets proches (évite des micro-tronçons)
    var pa = carte.latLngToLayerPoint([A[1], A[0]]), pb = carte.latLngToLayerPoint([B[1], B[0]]);
    var pt = [A[0] + (B[0] - A[0]) * mieux.t, A[1] + (B[1] - A[1]) * mieux.t];
    var pp = carte.latLngToLayerPoint([pt[1], pt[0]]);
    if (pp.distanceTo(pa) < 6) { mieux.t = 0; pt = A.slice(); }
    else if (pp.distanceTo(pb) < 6) { mieux.t = 1; pt = B.slice(); }
    mieux.pt = pt;
    mieux.pos = mieux.i + mieux.t;
    mieux.debut = mieux.pos === 0;
    mieux.fin = mieux.pos === seg.length - 1;
    return mieux;
  }

  function longueur(pts) {
    var l = 0;
    for (var i = 0; i < pts.length - 1; i++) l += geo.distance(pts[i], pts[i + 1]);
    return l;
  }

  /** Applique de nouveaux segments : recalcul du croisement, de la redevance et de l'affichage. */
  function appliquerSegments(segments, memoriser) {
    if (memoriser !== false) ed.historique.push(copieSegments(etat.trace.segments));
    etat.trace.segments = segments;
    etat.trace.croisement = geo.croiser(segments, etat.index);
    etat.trace.modifications = ed.historique.length;
    calculerBordures();
    etat.params.lineaire = lineaireRetenu();
    if (etat.resultat) etat.resultat = R.calculer(etat.params, cfg.bareme, cfg.facteurJours);
    dessinerTrace(false);
    afficherTrace();
    afficherRedevance();
    majEdition();
  }

  function aide(txt) { $('edition-aide').textContent = txt; }

  function choisirOutil(outil) {
    ed.outil = ed.outil === outil ? null : outil;
    ed.coupe = []; ed.dessin = [];
    majEdition();
  }

  function majEdition() {
    $('edition').hidden = !ed.actif;
    $('trace-actions').hidden = ed.actif;
    $('outil-couper').setAttribute('aria-pressed', ed.outil === 'couper' ? 'true' : 'false');
    $('outil-ajouter').setAttribute('aria-pressed', ed.outil === 'ajouter' ? 'true' : 'false');
    $('ed-defaire').disabled = !ed.historique.length;
    $('ed-origine').disabled = !ed.historique.length;
    $('ed-supprimer').hidden = !(ed.outil === 'couper' && ed.coupe.length === 2);
    $('ed-valider').hidden = !(ed.outil === 'ajouter' && ed.dessin.length >= 2);
    $('ed-point').hidden = !(ed.outil === 'ajouter' && ed.dessin.length >= 1);
    $('ed-abandonner').hidden = !(ed.coupe.length || ed.dessin.length);
    var conteneur = carte.getContainer();
    if (ed.actif && ed.outil) L.DomUtil.addClass(conteneur, 'en-edition'); else L.DomUtil.removeClass(conteneur, 'en-edition');
    dessinerEdition();

    if (!ed.actif) return;
    if (!ed.outil) aide('Choisir un outil. Les longueurs et la redevance sont recalculées après chaque modification.');
    else if (ed.outil === 'couper') {
      if (ed.coupe.length === 0) aide('Cliquer sur le tracé au début du tronçon à supprimer.');
      else if (ed.coupe.length === 1) aide('Cliquer sur le tracé à la fin du tronçon à supprimer.');
      else {
        var sel = portionCoupe();
        var cdl = geo.croiser([sel], etat.index).longueurCdl;
        aide('Tronçon sélectionné : ' + R.distance(longueur(sel)) + ', dont ' + R.nombre(cdl) + ' m sur les terrains du Conservatoire.');
      }
    } else {
      if (!ed.dessin.length) aide('Cliquer sur la carte pour placer les points du nouveau tronçon. Un clic près du tracé s\'y accroche.');
      else aide(ed.dessin.length + ' point' + (ed.dessin.length > 1 ? 's' : '') + ' placé' + (ed.dessin.length > 1 ? 's' : '') +
        (ed.dessin.length > 1 ? ', ' + R.distance(longueur(ed.dessin.map(function (d) { return d.pt; }))) : '') +
        '. Double-cliquer ou « Valider le tronçon » pour terminer.');
    }
  }

  function portionCoupe() {
    var a = ed.coupe[0], b = ed.coupe[1];
    if (a.pos > b.pos) { var x = a; a = b; b = x; }
    var seg = etat.trace.segments[a.s];
    return nettoyer([a.pt].concat(seg.slice(a.i + 1, b.i + 1)).concat([b.pt]));
  }

  function dessinerEdition() {
    coucheEdition.clearLayers();
    var jaune = cfg.couleurs.siteChoisi;
    if (ed.outil === 'couper') {
      if (ed.coupe.length === 2) {
        var sel = latlngs(portionCoupe());
        L.polyline(sel, { color: '#10283A', weight: 11, opacity: 0.85, interactive: false }).addTo(coucheEdition);
        L.polyline(sel, { color: jaune, weight: 6, dashArray: '10 8', interactive: false }).addTo(coucheEdition);
      }
      ed.coupe.forEach(function (c) {
        L.circleMarker([c.pt[1], c.pt[0]], { radius: 7, color: '#10283A', weight: 2.5, fillColor: jaune, fillOpacity: 1, interactive: false }).addTo(coucheEdition);
      });
    } else if (ed.outil === 'ajouter' && ed.dessin.length) {
      var ll = ed.dessin.map(function (d) { return [d.pt[1], d.pt[0]]; });
      L.polyline(ll, { color: '#10283A', weight: 8, opacity: 0.85, interactive: false }).addTo(coucheEdition);
      L.polyline(ll, { color: jaune, weight: 4, interactive: false }).addTo(coucheEdition);
      ed.dessin.forEach(function (d) {
        L.circleMarker([d.pt[1], d.pt[0]], { radius: d.accroche ? 7 : 5, color: '#10283A', weight: 2, fillColor: d.accroche ? jaune : '#FFFFFF', fillOpacity: 1, interactive: false }).addTo(coucheEdition);
      });
    }
  }

  function supprimerTroncon() {
    var a = ed.coupe[0], b = ed.coupe[1];
    if (a.pos > b.pos) { var x = a; a = b; b = x; }
    var segs = copieSegments(etat.trace.segments), seg = segs[a.s];
    var avant = nettoyer(seg.slice(0, a.i + 1).concat([a.pt]));
    var apres = nettoyer([b.pt].concat(seg.slice(b.i + 1)));
    var remplace = [avant, apres].filter(function (p) { return p.length >= 2; });
    segs.splice.apply(segs, [a.s, 1].concat(remplace));
    if (!segs.length) { aide('Ce tronçon correspond à tout le tracé : utiliser plutôt « Retirer le tracé ».'); return; }
    ed.coupe = [];
    appliquerSegments(segs);
  }

  function validerDessin() {
    // dédoublonne les points posés au même endroit (double-clic)
    var pts = ed.dessin.filter(function (d, i) {
      if (i === 0) return true;
      var p = carte.latLngToLayerPoint([d.pt[1], d.pt[0]]), q = carte.latLngToLayerPoint([ed.dessin[i - 1].pt[1], ed.dessin[i - 1].pt[0]]);
      return p.distanceTo(q) > 4;
    });
    if (pts.length < 2) { aide('Placer au moins deux points pour former un tronçon.'); return; }
    var segs = copieSegments(etat.trace.segments), nouveau = pts.map(function (d) { return d.pt; });
    var debut = pts[0].accroche, fin = pts[pts.length - 1].accroche;
    if (debut && debut.fin) {
      // prolonge la fin d'un morceau du tracé
      segs[debut.s] = nettoyer(segs[debut.s].concat(nouveau));
      if (fin && fin.debut && fin.s !== debut.s) { // et rejoint le début d'un autre morceau
        segs[debut.s] = nettoyer(segs[debut.s].concat(segs[fin.s]));
        segs.splice(fin.s, 1);
      }
    } else if (fin && fin.debut) {
      segs[fin.s] = nettoyer(nouveau.concat(segs[fin.s]));
    } else {
      var ou = debut ? debut.s + 1 : segs.length;
      segs.splice(ou, 0, nettoyer(nouveau));
    }
    ed.dessin = [];
    appliquerSegments(segs);
  }

  carte.on('click', function (e) {
    if (!ed.actif || !ed.outil || !etat.trace) return;
    var proche = surLeTrace(e.latlng);
    if (ed.outil === 'couper') {
      if (!proche || proche.d > TOL) { aide('Cliquer plus près du tracé pour placer le point de coupe.'); return; }
      if (ed.coupe.length === 2) ed.coupe = [];
      if (ed.coupe.length === 1 && ed.coupe[0].s !== proche.s) {
        aide('Les deux points doivent être sur le même morceau de tracé.'); return;
      }
      ed.coupe.push(proche);
    } else {
      var accroche = proche && proche.d <= TOL ? proche : null;
      ed.dessin.push({ pt: accroche ? accroche.pt : [e.latlng.lng, e.latlng.lat], accroche: accroche });
    }
    majEdition();
  });
  carte.on('dblclick', function () {
    if (ed.actif && ed.outil === 'ajouter' && ed.dessin.length >= 2) validerDessin();
  });

  function ouvrirEdition() {
    if (!etat.trace) return;
    ed.actif = true; ed.outil = null; ed.coupe = []; ed.dessin = [];
    carte.doubleClickZoom.disable();
    carte.closePopup();
    majEdition();
    $('edition').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function fermerEdition() {
    ed.actif = false; ed.outil = null; ed.coupe = []; ed.dessin = [];
    carte.doubleClickZoom.enable();
    majEdition();
  }

  $('btn-editer').addEventListener('click', ouvrirEdition);
  $('ed-terminer').addEventListener('click', fermerEdition);
  $('outil-couper').addEventListener('click', function () { choisirOutil('couper'); });
  $('outil-ajouter').addEventListener('click', function () { choisirOutil('ajouter'); });
  $('ed-supprimer').addEventListener('click', supprimerTroncon);
  $('ed-valider').addEventListener('click', validerDessin);
  $('ed-point').addEventListener('click', function () { ed.dessin.pop(); majEdition(); });
  $('ed-abandonner').addEventListener('click', function () { ed.coupe = []; ed.dessin = []; majEdition(); });
  $('ed-defaire').addEventListener('click', function () {
    if (!ed.historique.length) return;
    appliquerSegments(ed.historique.pop(), false);
  });
  $('ed-origine').addEventListener('click', function () {
    if (!ed.historique.length) return;
    var origine = ed.historique[0];
    ed.historique = [];
    appliquerSegments(copieSegments(origine), false);
  });
  document.addEventListener('keydown', function (e) {
    if (!ed.actif || fenetre.open) return;
    if (e.key === 'Escape' && (ed.coupe.length || ed.dessin.length)) { ed.coupe = []; ed.dessin = []; majEdition(); }
    else if (e.key === 'Enter' && ed.outil === 'ajouter' && ed.dessin.length >= 2 && e.target === document.body) validerDessin();
  });

  /* -------- Export du tracé en GPX */
  function echapperXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function gpxDuTrace() {
    var nom = echapperXml(etat.params && etat.params.nom || etat.trace.nom);
    var lignes = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<gpx version="1.1" creator="Redevance trail" xmlns="http://www.topografix.com/GPX/1/1">',
      '  <metadata><name>' + nom + '</name>' +
      (etat.trace.modifications ? '<desc>Tracé modifié à la main sur l\'outil Redevance trail.</desc>' : '') + '</metadata>',
      '  <trk><name>' + nom + '</name>'];
    etat.trace.segments.forEach(function (seg) {
      lignes.push('    <trkseg>');
      seg.forEach(function (p) { lignes.push('      <trkpt lat="' + p[1].toFixed(7) + '" lon="' + p[0].toFixed(7) + '"/>'); });
      lignes.push('    </trkseg>');
    });
    lignes.push('  </trk>', '</gpx>', '');
    return lignes.join('\n');
  }
  $('btn-gpx-export').addEventListener('click', function () {
    if (!etat.trace) return;
    var f = exporter.nomFichier(etat.params && etat.params.nom || etat.trace.nom, 'gpx').replace(/^redevance-/, 'trace-');
    exporter.telecharger(new Blob([gpxDuTrace()], { type: 'application/gpx+xml' }), f);
  });

  // Glisser-déposer sur toute la page
  var voile = $('voile-depot'), survols = 0;
  function aDesFichiers(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0; }
  window.addEventListener('dragenter', function (e) { if (aDesFichiers(e)) { survols++; voile.hidden = false; e.preventDefault(); } });
  window.addEventListener('dragover', function (e) { if (aDesFichiers(e)) e.preventDefault(); });
  window.addEventListener('dragleave', function (e) { if (aDesFichiers(e)) { survols = Math.max(0, survols - 1); if (!survols) voile.hidden = true; } });
  window.addEventListener('drop', function (e) {
    if (!aDesFichiers(e)) return;
    e.preventDefault(); survols = 0; voile.hidden = true;
    lireFichier(e.dataTransfer.files[0]);
  });

  /* ========================================================== Paramètres */
  var fenetre = $('fenetre');
  var champsNum = ['jours', 'participants', 'lineaire', 'emprise', 'vehicules'];

  function lireFormulaire() {
    var p = { nom: $('p-nom').value.trim() };
    champsNum.forEach(function (c) {
      var v = Math.round(Number($('p-' + c).value));
      p[c] = isFinite(v) && v > 0 ? v : 0;
    });
    if (p.jours < 1) p.jours = 1;
    return p;
  }

  function ligneDetail(table, titre, sousTitre, calcul, montant, classe) {
    var tr = document.createElement('tr'), th = document.createElement('th'), td = document.createElement('td');
    if (classe) tr.className = classe;
    th.scope = 'row'; th.textContent = titre;
    if (sousTitre) { var s = document.createElement('small'); s.textContent = sousTitre; th.appendChild(s); }
    if (calcul) { var c = document.createElement('span'); c.className = 'calc'; c.textContent = calcul + ' = '; td.appendChild(c); }
    td.appendChild(document.createTextNode(montant));
    tr.appendChild(th); tr.appendChild(td); table.appendChild(tr);
  }

  function remplirDetail(table, res) {
    table.textContent = '';
    ['participants', 'lineaire', 'emprise', 'vehicules'].forEach(function (cle) {
      var p = res.parts[cle];
      ligneDetail(table, p.titre + (p.quantite ? ' (' + R.nombre(p.quantite) + ')' : ''),
        R.detailTranches(p) || 'aucun', '', R.euros(p.montant));
    });
    ligneDetail(table, 'Sous-total', '', '', R.euros(res.sousTotal));
    ligneDetail(table, 'Facteur de durée', res.jours > 1 ? res.jours + ' jours' : '1 jour', '', '× ' + R.decimal(res.facteur));
    ligneDetail(table, 'Redevance', '', '', R.euros(res.total), 'total');
  }

  function afficherBareme(res) {
    var zone = $('bareme'); zone.textContent = '';
    function tableau(titre, lignes) {
      var h = document.createElement('h3'), t = document.createElement('table');
      h.textContent = titre;
      lignes.forEach(function (l) {
        var tr = document.createElement('tr'), a = document.createElement('td'), c = document.createElement('td');
        if (l.atteint) tr.className = 'atteint';
        a.textContent = l.libelle; c.textContent = l.valeur;
        tr.appendChild(a); tr.appendChild(c); t.appendChild(tr);
      });
      zone.appendChild(h); zone.appendChild(t);
    }
    ['participants', 'lineaire', 'emprise', 'vehicules'].forEach(function (cle) {
      var b = cfg.bareme[cle], utilises = res.parts[cle].tranches.map(function (t) { return t.palier; });
      tableau(b.titre + ' (coût par ' + b.unite + ', par tranche)', b.paliers.map(function (pal) {
        return { libelle: pal.libelle, valeur: R.coutUnitaire(pal.cout), atteint: utilises.indexOf(pal) >= 0 };
      }));
    });
    tableau('Facteur de durée', cfg.facteurJours.map(function (f, i) {
      var dernier = i === cfg.facteurJours.length - 1;
      return { libelle: f.jours + (f.jours > 1 ? ' jours' : ' jour') + (dernier ? ' et plus' : ''),
        valeur: '× ' + R.decimal(f.facteur), atteint: res.ligneFacteur === f };
    }));
  }

  function apercu() {
    var p = lireFormulaire(), res = R.calculer(p, cfg.bareme, cfg.facteurJours);
    $('apercu-total').textContent = R.euros(res.total);
    remplirDetail($('apercu-detail'), res);
    ['participants', 'lineaire', 'emprise', 'vehicules'].forEach(function (cle) {
      var part = res.parts[cle];
      $('palier-' + cle).textContent = part.quantite
        ? R.detailTranches(part) + ' = ' + R.euros(part.montant)
        : 'Aucun ' + part.unite + ' : part nulle';
    });
    $('palier-jours').textContent = 'Facteur de durée : × ' + R.decimal(res.facteur);
    afficherBareme(res);
    var mesure = etat.trace ? lineaireRetenu() : null;
    var reprendre = $('p-lineaire-reprendre');
    reprendre.hidden = mesure === null || p.lineaire === mesure;
    if (mesure !== null) reprendre.textContent = 'Reprendre la mesure du tracé (' + R.nombre(mesure) + ' m)';
  }

  function ouvrirFenetre() {
    if (!etat.params) return;
    $('p-nom').value = etat.params.nom || '';
    champsNum.forEach(function (c) { $('p-' + c).value = etat.params[c]; });
    apercu();
    if (fenetre.showModal) { if (!fenetre.open) fenetre.showModal(); } else fenetre.setAttribute('open', '');
    var cible = $('p-participants'); cible.focus(); cible.select();
  }

  function fermerFenetre() { if (fenetre.close) fenetre.close(); else fenetre.removeAttribute('open'); }

  $('formulaire').addEventListener('input', apercu);
  $('p-lineaire-reprendre').addEventListener('click', function () {
    $('p-lineaire').value = lineaireRetenu(); apercu();
  });
  $('f-annuler').addEventListener('click', fermerFenetre);
  $('formulaire').addEventListener('submit', function (e) {
    e.preventDefault();
    etat.params = lireFormulaire();
    if (!etat.params.nom) etat.params.nom = etat.trace ? etat.trace.nom : 'Trail sans nom';
    etat.resultat = R.calculer(etat.params, cfg.bareme, cfg.facteurJours);
    fermerFenetre();
    afficherTrace();
    afficherRedevance();
    $('bloc-redevance').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  $('btn-params').addEventListener('click', ouvrirFenetre);
  $('btn-modifier').addEventListener('click', ouvrirFenetre);

  /* =========================================================== Redevance */
  function afficherRedevance() {
    var res = etat.resultat;
    $('bloc-redevance').hidden = !res;
    $('btn-params').hidden = !!res;
    $('etat-export').textContent = '';
    if (!res) return;
    $('montant-total').textContent = R.euros(res.total);
    $('montant-duree').textContent = etat.params.nom + ', ' + (res.jours > 1 ? res.jours + ' jours' : '1 jour');
    remplirDetail($('detail'), res);
  }

  function exporterEn(format) {
    if (!etat.resultat || !etat.trace) return;
    var note = $('etat-export'), boutons = [$('btn-png'), $('btn-pdf')];
    boutons.forEach(function (b) { b.disabled = true; });
    note.className = 'note'; note.textContent = 'Préparation de la fiche…';
    exporter.composerFiche(etat).then(function (fiche) {
      return exporter[format](fiche.canvas, etat.params.nom).then(function (fichier) {
        note.textContent = 'Fiche téléchargée : ' + fichier + (fiche.avertissement ? ' ' + fiche.avertissement : '');
      });
    }).catch(function (err) {
      note.className = 'alerte';
      note.textContent = 'La fiche n\'a pas pu être produite (' + (err && err.message ? err.message : 'erreur inconnue') + '). Changer de fond de carte puis réessayer.';
    }).then(function () { boutons.forEach(function (b) { b.disabled = false; }); });
  }
  $('btn-png').addEventListener('click', function () { exporterEn('png'); });
  $('btn-pdf').addEventListener('click', function () { exporterEn('pdf'); });

  if (cfg.logo && cfg.logo.fichier) {
    var bandeau = $('bandeau-logo'), logo = $('logo');
    logo.alt = cfg.logo.alt || '';
    logo.onerror = function () { bandeau.hidden = true; };
    logo.src = versionner(cfg.logo.fichier);
    if (cfg.logo.lien) bandeau.href = cfg.logo.lien;
    bandeau.hidden = false;
  }

  $('pied-bareme').textContent = 'Barème : ' + cfg.versionBareme + '.';
  window.addEventListener('resize', function () { carte.invalidateSize(); });
})();
