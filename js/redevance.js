/*
 * Calcul de la redevance — reproduit la formule du classeur « Simulation-redevance_MS_08.10.26 » :
 *   = facteur de durée × ( part participants + part linéaire + part emprise + part véhicules )
 * Barème progressif : chaque tranche de la quantité est facturée à son propre coût unitaire
 * (ex. 250 participants = 100 × 0,50 € + 150 × 0,75 €).
 * Facteur de durée : RECHERCHE(ARRONDI.SUP(jours)) dans la table CDL_CONFIG.facteurJours.
 */
(function (global) {
  'use strict';

  function entier(v) {
    var n = Math.round(Number(v));
    return isFinite(n) && n > 0 ? n : 0;
  }

  /** Arrondi au centime, sans piège de virgule flottante (1129,575 -> 1129,58). */
  function arrondi2(x) { return Math.round(Number((x * 100).toPrecision(12))) / 100; }

  /** Découpe une quantité selon les tranches du barème. */
  function tranches(quantite, paliers) {
    var out = [], bas = 0;
    for (var i = 0; i < paliers.length; i++) {
      var haut = paliers[i].max === null || paliers[i].max === undefined ? Infinity : paliers[i].max;
      var n = Math.max(0, Math.min(quantite, haut) - bas);
      if (n > 0) out.push({ palier: paliers[i], quantite: n, cout: paliers[i].cout, montant: n * paliers[i].cout });
      bas = haut;
      if (quantite <= haut) break;
    }
    return out;
  }

  /** Facteur de durée : dernier facteur dont le nombre de jours est ≤ jours (arrondi à l'entier supérieur). */
  function facteurPour(jours, table) {
    var j = Math.ceil(jours), f = null;
    for (var i = 0; i < table.length; i++) { if (j >= table[i].jours) f = table[i]; }
    return f || table[0];
  }

  /**
   * @param {{jours:number, participants:number, lineaire:number, emprise:number, vehicules:number}} p
   * @param {object} bareme        CDL_CONFIG.bareme
   * @param {object[]} tableJours  CDL_CONFIG.facteurJours
   */
  function calculer(p, bareme, tableJours) {
    var q = {
      participants: entier(p.participants),
      lineaire: entier(p.lineaire),
      emprise: entier(p.emprise),
      vehicules: entier(p.vehicules)
    };
    var jours = Math.max(1, entier(p.jours));
    var parts = {};
    var sousTotal = 0;
    ['participants', 'lineaire', 'emprise', 'vehicules'].forEach(function (cle) {
      var t = tranches(q[cle], bareme[cle].paliers);
      var montant = t.reduce(function (s, x) { return s + x.montant; }, 0);
      parts[cle] = {
        cle: cle, titre: bareme[cle].titre, unite: bareme[cle].unite,
        quantite: q[cle], tranches: t, montant: arrondi2(montant)
      };
      sousTotal += montant;
    });
    var f = facteurPour(jours, tableJours);
    return {
      jours: jours,
      facteur: f.facteur,
      ligneFacteur: f,
      parts: parts,
      sousTotal: arrondi2(sousTotal),
      total: arrondi2(f.facteur * sousTotal)
    };
  }

  /* ---------- Mise en forme (français) ---------- */

  function grouper(entierTxt, sep) {
    return entierTxt.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  }

  /** 1234.5 -> « 1 234,50 € » */
  function euros(x, sep) {
    sep = sep === undefined ? ' ' : sep;
    var s = Math.abs(x).toFixed(2).split('.');
    return (x < 0 ? '-' : '') + grouper(s[0], sep) + ',' + s[1] + sep + '€';
  }

  /** Coût unitaire : 0.075 -> « 0,075 € », 50 -> « 50 € » */
  function coutUnitaire(x, sep) {
    sep = sep === undefined ? ' ' : sep;
    var txt = String(Math.round(x * 1000) / 1000).replace('.', ',');
    if (/,\d$/.test(txt)) txt += '0';
    return txt + sep + '€';
  }

  /** 12345 -> « 12 345 » */
  function nombre(x, sep) {
    sep = sep === undefined ? ' ' : sep;
    return grouper(String(Math.round(x)), sep);
  }

  /** Distance lisible : 850 -> « 850 m », 12 340 -> « 12,3 km » */
  function distance(m, sep) {
    sep = sep === undefined ? ' ' : sep;
    if (m < 1000) return Math.round(m) + sep + 'm';
    var km = (Math.round(m / 100) / 10).toFixed(1).split('.');
    return grouper(km[0], sep) + (km[1] === '0' && m >= 100000 ? '' : ',' + km[1]) + sep + 'km';
  }

  global.CDL = global.CDL || {};
  /** 1.2 -> « 1,2 » */
  function decimal(x) { return String(Math.round(x * 1000) / 1000).replace('.', ','); }

  /** Détail des tranches : « 100 × 0,50 € + 150 × 0,75 € » (chaîne vide si quantité nulle). */
  function detailTranches(part, sep) {
    return part.tranches.map(function (t) {
      return nombre(t.quantite, sep) + ' × ' + coutUnitaire(t.cout, sep);
    }).join(' + ');
  }

  global.CDL.redevance = {
    calculer: calculer, tranches: tranches, facteurPour: facteurPour, detailTranches: detailTranches,
    euros: euros, coutUnitaire: coutUnitaire, nombre: nombre, distance: distance, decimal: decimal
  };
})(typeof window !== 'undefined' ? window : globalThis);
