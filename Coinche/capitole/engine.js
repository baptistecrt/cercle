/* ============================================================
   Capitole — jeu d'immobilier (règles du Monopoly), plateau toulousain
   ============================================================ */
(function (root) {
  'use strict';
  const Net = root.SalleNet;
  const randInt = (n) => (Net ? Net.randInt(n) : Math.floor(Math.random() * n));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------- Plateau ----------
  const G = { brun: '#8b5a2b', ciel: '#7cc6e3', rose: '#c2437a', orange: '#ec8b2e', rouge: '#d63b30', jaune: '#f2cf3a', vert: '#2f9a55', bleu: '#2b4c9b' };
  const HOUSE = { brun: 50, ciel: 50, rose: 100, orange: 100, rouge: 150, jaune: 150, vert: 200, bleu: 200 };
  const P = (name, group, price, rent) => ({ type: 'prop', name, group, price, rent });
  const BOARD = [
    { type: 'go', name: 'Départ' },
    P('Avenue de Reynerie', 'brun', 60, [2, 10, 30, 90, 160, 250]),
    { type: 'quartier', name: 'Quartier' },
    P('Rue de Bagatelle', 'brun', 60, [4, 20, 60, 180, 320, 450]),
    { type: 'tax', name: 'Taxe foncière', amount: 200 },
    { type: 'station', name: 'Gare Matabiau', price: 200 },
    P('Avenue de Muret', 'ciel', 100, [6, 30, 90, 270, 400, 550]),
    { type: 'hasard', name: 'Hasard' },
    P('Rue des Fontaines', 'ciel', 100, [6, 30, 90, 270, 400, 550]),
    P('Allées de Barcelone', 'ciel', 120, [8, 40, 100, 300, 450, 600]),
    { type: 'jail', name: 'Prison Saint-Michel' },
    P('Boulevard de Strasbourg', 'rose', 140, [10, 50, 150, 450, 625, 750]),
    { type: 'util', name: 'Usine du Bazacle', price: 150 },
    P('Rue Bayard', 'rose', 140, [10, 50, 150, 450, 625, 750]),
    P('Allées Jean-Jaurès', 'rose', 160, [12, 60, 180, 500, 700, 900]),
    { type: 'station', name: 'Station Jean-Jaurès', price: 200 },
    P('Rue de la Colombette', 'orange', 180, [14, 70, 200, 550, 750, 950]),
    { type: 'quartier', name: 'Quartier' },
    P('Rue des Filatiers', 'orange', 180, [14, 70, 200, 550, 750, 950]),
    P('Rue Pargaminières', 'orange', 200, [16, 80, 220, 600, 800, 1000]),
    { type: 'free', name: 'Jardin des Plantes' },
    P('Rue de Metz', 'rouge', 220, [18, 90, 250, 700, 875, 1050]),
    { type: 'hasard', name: 'Hasard' },
    P('Rue des Changes', 'rouge', 220, [18, 90, 250, 700, 875, 1050]),
    P('Place Saint-Georges', 'rouge', 240, [20, 100, 300, 750, 925, 1100]),
    { type: 'station', name: 'Tram des Arènes', price: 200 },
    P('Rue Croix-Baragnon', 'jaune', 260, [22, 110, 330, 800, 975, 1150]),
    P('Rue d\'Alsace-Lorraine', 'jaune', 260, [22, 110, 330, 800, 975, 1150]),
    { type: 'util', name: 'Eaux de la Garonne', price: 150 },
    P('Place Wilson', 'jaune', 280, [24, 120, 360, 850, 1025, 1200]),
    { type: 'gotojail', name: 'Au poste !' },
    P('Allées François-Verdier', 'vert', 300, [26, 130, 390, 900, 1100, 1275]),
    P('Rue Ozenne', 'vert', 300, [26, 130, 390, 900, 1100, 1275]),
    { type: 'quartier', name: 'Quartier' },
    P('Le Grand Rond', 'vert', 320, [28, 150, 450, 1000, 1200, 1400]),
    { type: 'station', name: 'Aéroport de Blagnac', price: 200 },
    { type: 'hasard', name: 'Hasard' },
    P('Place de la Daurade', 'bleu', 350, [35, 175, 500, 1100, 1300, 1500]),
    { type: 'tax', name: 'Amende du capitoul', amount: 100 },
    P('Place du Capitole', 'bleu', 400, [50, 200, 600, 1400, 1700, 2000]),
  ];
  const OWNABLE = BOARD.map((b, i) => (b.price ? i : -1)).filter((i) => i >= 0);
  const GROUPS = {};
  BOARD.forEach((b, i) => { if (b.type === 'prop') (GROUPS[b.group] = GROUPS[b.group] || []).push(i); });
  const STATIONS = [5, 15, 25, 35], UTILS = [12, 28];

  // ---------- Cartes ----------
  const HASARD = [
    { t: 'Avance jusqu\'à la case Départ. Reçois 200 €.', k: 'goto', to: 0 },
    { t: 'Rendez-vous Place du Capitole.', k: 'goto', to: 39 },
    { t: 'Rendez-vous Place Saint-Georges. Si tu passes par Départ, reçois 200 €.', k: 'goto', to: 24 },
    { t: 'Rendez-vous Boulevard de Strasbourg. Si tu passes par Départ, reçois 200 €.', k: 'goto', to: 11 },
    { t: 'Prends la ligne la plus proche (gare, métro, tram ou avion). Si elle appartient à quelqu\'un, paie-lui le double du loyer.', k: 'nearStation' },
    { t: 'Prends la ligne la plus proche (gare, métro, tram ou avion). Si elle appartient à quelqu\'un, paie-lui le double du loyer.', k: 'nearStation' },
    { t: 'Va à la compagnie la plus proche. Si elle appartient à quelqu\'un, lance les dés et paie 10 fois le résultat.', k: 'nearUtil' },
    { t: 'La banque te verse un dividende de 50 €.', k: 'money', v: 50 },
    { t: 'Libéré de prison ! Garde cette carte jusqu\'à ce que tu en aies besoin.', k: 'jailcard' },
    { t: 'Recule de trois cases.', k: 'back', v: 3 },
    { t: 'Garde à vue : va directement à la prison Saint-Michel, sans passer par Départ.', k: 'jail' },
    { t: 'Ravalement de façade en brique : paie 25 € par maison et 100 € par hôtel.', k: 'repairs', h: 25, H: 100 },
    { t: 'Excès de vitesse sur la rocade : paie 15 €.', k: 'money', v: -15 },
    { t: 'Prends le train à la gare Matabiau. Si tu passes par Départ, reçois 200 €.', k: 'goto', to: 5 },
    { t: 'Tu es élu capitoul : verse 50 € à chaque joueur.', k: 'payEach', v: 50 },
    { t: 'Ton prêt immobilier arrive à échéance : reçois 150 €.', k: 'money', v: 150 },
  ];
  const QUARTIER = [
    { t: 'Avance jusqu\'à la case Départ. Reçois 200 €.', k: 'goto', to: 0 },
    { t: 'Erreur de la banque en ta faveur : reçois 200 €.', k: 'money', v: 200 },
    { t: 'Visite chez le médecin : paie 50 €.', k: 'money', v: -50 },
    { t: 'Tu revends tes places pour le Stade Toulousain : reçois 50 €.', k: 'money', v: 50 },
    { t: 'Libéré de prison ! Garde cette carte jusqu\'à ce que tu en aies besoin.', k: 'jailcard' },
    { t: 'Tapage nocturne place Saint-Pierre : va directement en prison.', k: 'jail' },
    { t: 'Ton livret d\'épargne arrive à terme : reçois 100 €.', k: 'money', v: 100 },
    { t: 'Remboursement des impôts : reçois 20 €.', k: 'money', v: 20 },
    { t: 'C\'est ton anniversaire : chaque joueur te donne 10 €.', k: 'collectEach', v: 10 },
    { t: 'Ton assurance vie te verse 100 €.', k: 'money', v: 100 },
    { t: 'Frais d\'hôpital : paie 100 €.', k: 'money', v: -100 },
    { t: 'Frais de scolarité : paie 50 €.', k: 'money', v: -50 },
    { t: 'Tu donnes un coup de main au marché Victor-Hugo : reçois 25 €.', k: 'money', v: 25 },
    { t: 'Travaux de voirie : paie 40 € par maison et 115 € par hôtel.', k: 'repairs', h: 40, H: 115 },
    { t: 'Ton cassoulet finit deuxième au concours du quartier : reçois 10 €.', k: 'money', v: 10 },
    { t: 'Tu hérites d\'une tante de Castelnaudary : reçois 100 €.', k: 'money', v: 100 },
  ];

  // ------------------------------------------------------------------
  function create({ settings, names, n }) {
    const start = Number(settings.cash) || 1500;
    const g = {
      n, names, settings: { ...settings }, cash: new Array(n).fill(start), pos: new Array(n).fill(0),
      inJail: new Array(n).fill(false), jailTurns: new Array(n).fill(0), jailCards: new Array(n).fill(0), bankrupt: new Array(n).fill(false), outOrder: [],
      owner: BOARD.map(() => null), houses: BOARD.map(() => 0), mortgaged: BOARD.map(() => false),
      housesLeft: 32, hotelsLeft: 12, pot: 0,
      turn: randInt(n), phase: 'roll', dice: [0, 0], doubles: 0, rolledDouble: false, round: 1, maxRounds: Number(settings.rounds) || 0,
      decks: { hasard: shuffle(HASARD.map((_, i) => i)), quartier: shuffle(QUARTIER.map((_, i) => i)) }, held: { hasard: [], quartier: [] },
      auction: null, debt: null, trade: null, lastCard: null, log: [], winner: null, seq: 0,
    };
    log(g, 'La partie commence. ' + names[g.turn] + ' lance les dés en premier.');
    return { state: g, events: [] };
  }
  function log(g, t) { g.log.push(t); if (g.log.length > 60) g.log.shift(); }
  const alive = (g) => g.names.map((_, i) => i).filter((i) => !g.bankrupt[i]);

  function ownsGroup(g, s, group) { return GROUPS[group].every((i) => g.owner[i] === s); }
  function rentOf(g, sq, diceSum) {
    const b = BOARD[sq], o = g.owner[sq];
    if (o == null || g.mortgaged[sq]) return 0;
    if (b.type === 'station') { const k = STATIONS.filter((i) => g.owner[i] === o).length; return 25 * Math.pow(2, k - 1); }
    if (b.type === 'util') { const k = UTILS.filter((i) => g.owner[i] === o).length; return diceSum * (k === 2 ? 10 : 4); }
    const h = g.houses[sq];
    if (h > 0) return b.rent[h];
    return ownsGroup(g, o, b.group) ? b.rent[0] * 2 : b.rent[0];
  }
  function worth(g, s) {
    let w = g.cash[s];
    for (const i of OWNABLE) if (g.owner[i] === s) { w += g.mortgaged[i] ? BOARD[i].price / 2 : BOARD[i].price; if (BOARD[i].type === 'prop') w += g.houses[i] * HOUSE[BOARD[i].group]; }
    return w;
  }
  function liquidity(g, s) {
    let w = g.cash[s];
    for (const i of OWNABLE) if (g.owner[i] === s) {
      if (BOARD[i].type === 'prop') w += g.houses[i] * HOUSE[BOARD[i].group] / 2;
      if (!g.mortgaged[i]) w += BOARD[i].price / 2;
    }
    return w;
  }

  // ---------- Paiements ----------
  // Retourne true si payé, sinon ouvre une dette pour le joueur courant (ou liquide automatiquement pour les autres)
  function pay(g, s, amount, to, ev, why) {
    if (amount <= 0) return true;
    if (g.cash[s] >= amount) { transfer(g, s, to, amount); return true; }
    if (s !== g.turn) {
      // Paiement hors tour (anniversaire…) : liquidation automatique
      autoLiquidate(g, s, amount);
      if (g.cash[s] >= amount) { transfer(g, s, to, amount); return true; }
      bankrupt(g, s, to, ev);
      return true;
    }
    g.debt = { seat: s, amount, to, why: why || '', resume: g.phase === 'roll' ? 'roll' : null };
    g.phase = 'debt';
    ev.push({ type: 'debt', seat: s, amount });
    return false;
  }
  function transfer(g, s, to, amount) {
    g.cash[s] -= amount;
    if (to === 'pot') g.pot += amount;
    else if (to != null && to !== 'bank') g.cash[to] += amount;
  }
  function autoLiquidate(g, s, need) {
    // vend les maisons puis hypothèque, en commençant par les moins chères
    const mine = OWNABLE.filter((i) => g.owner[i] === s);
    let guard = 0;
    while (g.cash[s] < need && guard++ < 200) {
      const withH = mine.filter((i) => g.houses[i] > 0 && canSell(g, s, i) === null).sort((a, b) => HOUSE[BOARD[a].group] - HOUSE[BOARD[b].group]);
      if (withH.length) { doSell(g, s, withH[0]); continue; }
      const m = mine.filter((i) => canMortgage(g, s, i) === null).sort((a, b) => BOARD[a].price - BOARD[b].price);
      if (m.length) { doMortgage(g, s, m[0]); continue; }
      break;
    }
  }
  function bankrupt(g, s, to, ev) {
    g.bankrupt[s] = true; g.outOrder.push(s);
    const toPlayer = to != null && to !== 'bank' && to !== 'pot' && to !== 'all';
    // les maisons retournent à la banque (moitié du prix au créancier)
    for (const i of OWNABLE) {
      if (g.owner[i] !== s) continue;
      if (BOARD[i].type === 'prop' && g.houses[i] > 0) {
        if (toPlayer) g.cash[s] += g.houses[i] * HOUSE[BOARD[i].group] / 2;
        if (g.houses[i] === 5) g.hotelsLeft++; else g.housesLeft += g.houses[i];
        g.houses[i] = 0;
      }
      if (toPlayer) g.owner[i] = to;
      else { g.owner[i] = null; g.mortgaged[i] = false; }
    }
    if (toPlayer) { g.cash[to] += Math.max(0, g.cash[s]); g.jailCards[to] += g.jailCards[s]; }
    g.cash[s] = 0; g.jailCards[s] = 0;
    if (g.trade && (g.trade.from === s || g.trade.to === s)) g.trade = null;
    log(g, g.names[s] + ' fait faillite' + (toPlayer ? ' au profit de ' + g.names[to] : '') + '.');
    ev.push({ type: 'bankrupt', seat: s });
    if (alive(g).length <= 1) { g.phase = 'gameEnd'; g.winner = alive(g)[0]; }
  }

  // ---------- Déplacements ----------
  function moveTo(g, s, to, ev, passGo) {
    const from = g.pos[s];
    if (passGo && to < from) { g.cash[s] += 200; log(g, g.names[s] + ' passe par Départ et reçoit 200 €.'); ev.push({ type: 'salary', seat: s }); }
    g.pos[s] = to;
    ev.push({ type: 'move', seat: s, from, to, steps: (to - from + 40) % 40 });
  }
  function sendToJail(g, s, ev) {
    const from = g.pos[s];
    g.pos[s] = 10; g.inJail[s] = true; g.jailTurns[s] = 0; g.doubles = 0; g.rolledDouble = false;
    log(g, g.names[s] + ' part en prison.');
    ev.push({ type: 'move', seat: s, from, to: 10, jail: true });
    ev.push({ type: 'jail', seat: s });
  }

  function afterLanding(g, ev) {
    if (g.phase === 'gameEnd' || g.phase === 'debt' || g.phase === 'auction' || g.phase === 'buy') return;
    const s = g.turn;
    if (g.bankrupt[s]) { endTurn(g, ev); return; }
    g.phase = g.rolledDouble && !g.inJail[s] ? 'roll' : 'end';
  }

  function land(g, s, ev, opts) {
    opts = opts || {};
    const sq = g.pos[s];
    const b = BOARD[sq];
    if (b.type === 'gotojail') { sendToJail(g, s, ev); g.phase = 'end'; return; }
    if (b.type === 'tax') {
      log(g, g.names[s] + ' paie ' + b.amount + ' € (' + b.name + ').');
      if (!pay(g, s, b.amount, g.settings.pot ? 'pot' : 'bank', ev, b.name)) return;
    } else if (b.type === 'free') {
      if (g.settings.pot && g.pot > 0) { g.cash[s] += g.pot; log(g, g.names[s] + ' ramasse la cagnotte du Jardin des Plantes : ' + g.pot + ' €.'); ev.push({ type: 'pot', seat: s, amount: g.pot }); g.pot = 0; }
    } else if (b.type === 'hasard' || b.type === 'quartier') {
      drawCard(g, s, b.type, ev); return;
    } else if (b.price) {
      const o = g.owner[sq];
      if (o == null) { g.phase = 'buy'; return; }
      if (o !== s && !g.mortgaged[sq]) {
        let rent;
        if (opts.utilMult) rent = (g.dice[0] + g.dice[1]) * 10;
        else rent = rentOf(g, sq, g.dice[0] + g.dice[1]) * (opts.stationDouble ? 2 : 1);
        log(g, g.names[s] + ' paie un loyer de ' + rent + ' € à ' + g.names[o] + ' (' + b.name + ').');
        ev.push({ type: 'rent', seat: s, to: o, amount: rent });
        if (!pay(g, s, rent, o, ev, 'Loyer ' + b.name)) return;
      }
    }
    afterLanding(g, ev);
  }

  function drawCard(g, s, deck, ev) {
    const d = g.decks[deck];
    if (!d.length) g.decks[deck] = shuffle((deck === 'hasard' ? HASARD : QUARTIER).map((_, i) => i).filter((i) => !g.held[deck].includes(i)));
    const idx = g.decks[deck].shift();
    const c = (deck === 'hasard' ? HASARD : QUARTIER)[idx];
    g.lastCard = { deck, text: c.t, seat: s, id: g.seq++ };
    log(g, g.names[s] + ' tire une carte ' + (deck === 'hasard' ? 'Hasard' : 'Quartier') + ' : « ' + c.t + ' »');
    ev.push({ type: 'card', seat: s, deck, text: c.t });
    let back = true;
    switch (c.k) {
      case 'goto': moveTo(g, s, c.to, ev, true); land(g, s, ev); return;
      case 'money':
        if (c.v > 0) g.cash[s] += c.v;
        else if (!pay(g, s, -c.v, g.settings.pot ? 'pot' : 'bank', ev, 'Carte')) back = false;
        break;
      case 'jailcard': g.jailCards[s]++; g.held[deck].push(idx); back = false; break;
      case 'back': { const to = (g.pos[s] - c.v + 40) % 40; g.pos[s] = to; ev.push({ type: 'move', seat: s, to, jump: true }); g.decks[deck].push(idx); land(g, s, ev); return; }
      case 'jail': sendToJail(g, s, ev); g.decks[deck].push(idx); g.phase = 'end'; return;
      case 'repairs': {
        let h = 0, H = 0;
        for (const i of OWNABLE) if (g.owner[i] === s && BOARD[i].type === 'prop') { if (g.houses[i] === 5) H++; else h += g.houses[i]; }
        const amt = h * c.h + H * c.H;
        if (amt && !pay(g, s, amt, g.settings.pot ? 'pot' : 'bank', ev, 'Travaux')) back = false;
        break;
      }
      case 'payEach': {
        const others = alive(g).filter((x) => x !== s);
        const amt = c.v * others.length;
        if (g.cash[s] >= amt) others.forEach((x) => transfer(g, s, x, c.v));
        else { g.decks[deck].push(idx); g.debt = { seat: s, amount: amt, to: 'all', why: 'Élu capitoul' }; g.phase = 'debt'; ev.push({ type: 'debt', seat: s, amount: amt }); return; }
        break;
      }
      case 'collectEach': {
        for (const x of alive(g)) if (x !== s) pay(g, x, c.v, s, ev, 'Anniversaire');
        break;
      }
      case 'nearStation': {
        let to = STATIONS.find((i) => i > g.pos[s]); if (to == null) to = 5;
        moveTo(g, s, to, ev, true); g.decks[deck].push(idx); land(g, s, ev, { stationDouble: true }); return;
      }
      case 'nearUtil': {
        let to = UTILS.find((i) => i > g.pos[s]); if (to == null) to = 12;
        moveTo(g, s, to, ev, true); g.decks[deck].push(idx); land(g, s, ev, { utilMult: true }); return;
      }
    }
    if (c.k !== 'jailcard') g.decks[deck].push(idx);
    if (g.phase !== 'debt' && g.phase !== 'gameEnd') afterLanding(g, ev);
  }

  function endTurn(g, ev) {
    g.doubles = 0; g.rolledDouble = false;
    const prev = g.turn;
    let nx = prev;
    for (let k = 1; k <= g.n; k++) { const x = (prev + k) % g.n; if (!g.bankrupt[x]) { nx = x; break; } }
    if (nx <= prev) g.round++;
    g.turn = nx;
    g.phase = 'roll';
    if (g.maxRounds && g.round > g.maxRounds) {
      const al = alive(g);
      g.winner = al.sort((a, b) => worth(g, b) - worth(g, a))[0];
      g.phase = 'gameEnd';
      log(g, 'Fin de la partie au bout de ' + g.maxRounds + ' tours.');
      ev.push({ type: 'timeup' });
      return;
    }
    ev.push({ type: 'turn', seat: nx });
  }

  // ---------- Construction / hypothèques ----------
  function canBuild(g, s, i) {
    const b = BOARD[i];
    if (!b || b.type !== 'prop' || g.owner[i] !== s) return 'Ce n\'est pas ta rue.';
    if (!ownsGroup(g, s, b.group)) return 'Il te faut toutes les rues de la couleur.';
    if (GROUPS[b.group].some((j) => g.mortgaged[j])) return 'Lève d\'abord les hypothèques de ce groupe.';
    if (g.houses[i] >= 5) return 'Déjà un hôtel.';
    const min = Math.min(...GROUPS[b.group].map((j) => g.houses[j]));
    if (g.houses[i] > min) return 'Construis de façon équilibrée sur le groupe.';
    if (g.cash[s] < HOUSE[b.group]) return 'Pas assez d\'argent.';
    if (g.houses[i] === 4 && g.hotelsLeft <= 0) return 'Plus d\'hôtel disponible à la banque.';
    if (g.houses[i] < 4 && g.housesLeft <= 0) return 'Plus de maison disponible à la banque.';
    return null;
  }
  function doBuild(g, s, i) {
    const b = BOARD[i];
    g.cash[s] -= HOUSE[b.group];
    if (g.houses[i] === 4) { g.hotelsLeft--; g.housesLeft += 4; } else g.housesLeft--;
    g.houses[i]++;
  }
  function canSell(g, s, i) {
    const b = BOARD[i];
    if (!b || b.type !== 'prop' || g.owner[i] !== s) return 'Ce n\'est pas ta rue.';
    if (g.houses[i] <= 0) return 'Aucune maison ici.';
    const max = Math.max(...GROUPS[b.group].map((j) => g.houses[j]));
    if (g.houses[i] < max) return 'Vends de façon équilibrée sur le groupe.';
    if (g.houses[i] === 5 && g.housesLeft < 4) return 'La banque n\'a pas assez de maisons pour remplacer l\'hôtel.';
    return null;
  }
  function doSell(g, s, i) {
    const b = BOARD[i];
    g.cash[s] += HOUSE[b.group] / 2;
    if (g.houses[i] === 5) { g.hotelsLeft++; g.housesLeft -= 4; } else g.housesLeft++;
    g.houses[i]--;
  }
  function canMortgage(g, s, i) {
    const b = BOARD[i];
    if (!b || !b.price || g.owner[i] !== s) return 'Ce n\'est pas à toi.';
    if (g.mortgaged[i]) return 'Déjà hypothéquée.';
    if (b.type === 'prop' && GROUPS[b.group].some((j) => g.houses[j] > 0)) return 'Vends d\'abord les maisons du groupe.';
    return null;
  }
  function doMortgage(g, s, i) { g.mortgaged[i] = true; g.cash[s] += BOARD[i].price / 2; }
  const unmortgageCost = (i) => Math.ceil(BOARD[i].price / 2 * 1.1);
  function canUnmortgage(g, s, i) {
    if (g.owner[i] !== s || !g.mortgaged[i]) return 'Rien à lever.';
    if (g.cash[s] < unmortgageCost(i)) return 'Pas assez d\'argent.';
    return null;
  }

  // ---------- Enchères ----------
  function startAuction(g, sq, ev) {
    const order = [];
    for (let k = 0; k < g.n; k++) { const x = (g.turn + k) % g.n; if (!g.bankrupt[x]) order.push(x); }
    g.auction = { sq, bid: 0, bidder: null, active: order, idx: 0 };
    g.phase = 'auction';
    log(g, BOARD[sq].name + ' est mis aux enchères.');
    ev.push({ type: 'auction', sq });
  }
  function auctionNext(g, ev) {
    const a = g.auction;
    if (a.active.length === 0 || (a.active.length === 1 && a.bidder === a.active[0])) return finishAuction(g, ev);
    a.idx = a.idx % a.active.length;
    if (a.active[a.idx] === a.bidder && a.active.length === 1) return finishAuction(g, ev);
  }
  function finishAuction(g, ev) {
    const a = g.auction;
    if (a.bidder != null) {
      g.cash[a.bidder] -= a.bid; g.owner[a.sq] = a.bidder;
      log(g, g.names[a.bidder] + ' remporte ' + BOARD[a.sq].name + ' pour ' + a.bid + ' €.');
      ev.push({ type: 'bought', seat: a.bidder, sq: a.sq });
    } else log(g, 'Personne ne veut de ' + BOARD[a.sq].name + '.');
    g.auction = null;
    g.phase = 'end';
    afterLanding(g, ev);
  }

  // ---------- Échanges ----------
  function validSide(g, s, side) {
    if (!side) return 'Offre vide.';
    const cash = Math.max(0, Math.floor(Number(side.cash) || 0));
    if (cash > g.cash[s]) return g.names[s] + ' n\'a pas assez d\'argent.';
    if ((side.jail || 0) > g.jailCards[s]) return 'Carte « libéré de prison » manquante.';
    for (const i of side.props || []) {
      if (g.owner[i] !== s) return 'Propriété invalide.';
      if (BOARD[i].type === 'prop' && GROUPS[BOARD[i].group].some((j) => g.houses[j] > 0)) return 'Vends d\'abord les maisons de ' + BOARD[i].name + '.';
    }
    return null;
  }
  function applyTrade(g, t) {
    const move = (from, to, side) => {
      const cash = Math.max(0, Math.floor(Number(side.cash) || 0));
      g.cash[from] -= cash; g.cash[to] += cash;
      for (const i of side.props || []) g.owner[i] = to;
      g.jailCards[from] -= side.jail || 0; g.jailCards[to] += side.jail || 0;
    };
    move(t.from, t.to, t.give); move(t.to, t.from, t.want);
  }

  // ---------- Actions ----------
  function apply(g, s, a) {
    const ev = [];
    if (g.phase === 'gameEnd') return { error: 'La partie est finie.' };
    if (g.bankrupt[s]) return { error: 'Tu as fait faillite.' };
    const mine = s === g.turn;
    switch (a.type) {
      case 'roll': {
        if (!mine || g.phase !== 'roll') return { error: 'Pas maintenant.' };
        const d = [1 + randInt(6), 1 + randInt(6)];
        g.dice = d;
        const dbl = d[0] === d[1];
        ev.push({ type: 'dice', seat: s, dice: d });
        if (g.inJail[s]) {
          g.jailTurns[s]++;
          if (dbl) { g.inJail[s] = false; log(g, g.names[s] + ' fait un double et sort de prison.'); g.rolledDouble = false; }
          else if (g.jailTurns[s] >= 3) {
            log(g, g.names[s] + ' paie 50 € pour sortir de prison (3e essai).');
            g.inJail[s] = false;
            if (!pay(g, s, 50, g.settings.pot ? 'pot' : 'bank', ev, 'Sortie de prison')) { g.debt.thenMove = d[0] + d[1]; return { events: ev }; }
          } else { log(g, g.names[s] + ' reste en prison (' + d[0] + '-' + d[1] + ').'); g.phase = 'end'; return { events: ev }; }
          g.rolledDouble = false;
        } else {
          if (dbl) { g.doubles++; if (g.doubles === 3) { log(g, g.names[s] + ' fait trois doubles d\'affilée !'); sendToJail(g, s, ev); g.phase = 'end'; return { events: ev }; } }
          g.rolledDouble = dbl;
        }
        const to = (g.pos[s] + d[0] + d[1]) % 40;
        moveTo(g, s, to, ev, true);
        land(g, s, ev);
        return { events: ev };
      }
      case 'payJail': {
        if (!mine || g.phase !== 'roll' || !g.inJail[s]) return { error: 'Pas maintenant.' };
        if (g.cash[s] < 50) return { error: 'Pas assez d\'argent.' };
        g.cash[s] -= 50; if (g.settings.pot) g.pot += 50;
        g.inJail[s] = false; g.jailTurns[s] = 0;
        log(g, g.names[s] + ' paie 50 € et sort de prison.');
        return { events: ev };
      }
      case 'useCard': {
        if (!mine || g.phase !== 'roll' || !g.inJail[s] || g.jailCards[s] <= 0) return { error: 'Pas maintenant.' };
        g.jailCards[s]--; g.inJail[s] = false; g.jailTurns[s] = 0;
        for (const dk of ['hasard', 'quartier']) if (g.held[dk].length) { g.decks[dk].push(g.held[dk].shift()); break; }
        log(g, g.names[s] + ' utilise sa carte et sort de prison.');
        return { events: ev };
      }
      case 'buy': {
        if (!mine || g.phase !== 'buy') return { error: 'Pas maintenant.' };
        const sq = g.pos[s], b = BOARD[sq];
        if (g.cash[s] < b.price) return { error: 'Pas assez d\'argent : mets-la aux enchères ou hypothèque.' };
        g.cash[s] -= b.price; g.owner[sq] = s;
        log(g, g.names[s] + ' achète ' + b.name + ' pour ' + b.price + ' €.');
        ev.push({ type: 'bought', seat: s, sq });
        g.phase = 'end';
        afterLanding(g, ev);
        return { events: ev };
      }
      case 'decline': {
        if (!mine || g.phase !== 'buy') return { error: 'Pas maintenant.' };
        if (g.settings.auction === 0 || g.settings.auction === '0') { log(g, g.names[s] + ' n\'achète pas ' + BOARD[g.pos[s]].name + '.'); g.phase = 'end'; afterLanding(g, ev); return { events: ev }; }
        startAuction(g, g.pos[s], ev);
        return { events: ev };
      }
      case 'bid':
      case 'pass': {
        const A = g.auction;
        if (g.phase !== 'auction' || !A || A.active[A.idx] !== s) return { error: 'Ce n\'est pas ton tour d\'enchérir.' };
        if (a.type === 'bid') {
          const v = Math.floor(Number(a.amount));
          if (!(v > A.bid)) return { error: 'Il faut enchérir au-dessus de ' + A.bid + ' €.' };
          if (v > g.cash[s]) return { error: 'Tu n\'as que ' + g.cash[s] + ' €.' };
          A.bid = v; A.bidder = s;
          ev.push({ type: 'abid', seat: s, amount: v });
          A.idx = (A.idx + 1) % A.active.length;
        } else {
          A.active.splice(A.idx, 1);
          ev.push({ type: 'apass', seat: s });
          if (A.active.length) A.idx = A.idx % A.active.length;
        }
        if (A.active.length === 0 || (A.active.length === 1 && A.bidder === A.active[0])) finishAuction(g, ev);
        else if (A.active.length === 1 && A.bidder == null) { /* le dernier peut encore enchérir */ }
        return { events: ev };
      }
      case 'endTurn': {
        if (!mine || g.phase !== 'end') return { error: 'Pas maintenant.' };
        endTurn(g, ev);
        return { events: ev };
      }
      case 'payDebt': {
        if (g.phase !== 'debt' || !g.debt || g.debt.seat !== s) return { error: 'Pas de dette.' };
        const D = g.debt;
        if (g.cash[s] < D.amount) return { error: 'Il te manque ' + (D.amount - g.cash[s]) + ' €. Vends des maisons ou hypothèque.' };
        if (D.to === 'all') alive(g).filter((x) => x !== s).forEach((x) => transfer(g, s, x, D.amount / (alive(g).length - 1)));
        else transfer(g, s, D.to, D.amount);
        log(g, g.names[s] + ' règle sa dette de ' + D.amount + ' €.');
        g.debt = null;
        g.phase = 'end';
        if (D.thenMove) { const to = (g.pos[s] + D.thenMove) % 40; moveTo(g, s, to, ev, true); land(g, s, ev); }
        else afterLanding(g, ev);
        return { events: ev };
      }
      case 'giveUp': {
        if (g.phase !== 'debt' || !g.debt || g.debt.seat !== s) return { error: 'Pas maintenant.' };
        const D = g.debt; g.debt = null;
        bankrupt(g, s, D.to === 'all' ? 'bank' : D.to, ev);
        if (g.phase !== 'gameEnd') endTurn(g, ev);
        return { events: ev };
      }
      case 'build': case 'sell': case 'mortgage': case 'unmortgage': {
        if (g.phase === 'auction') return { error: 'Attends la fin des enchères.' };
        const i = Number(a.sq);
        const chk = { build: canBuild, sell: canSell, mortgage: canMortgage, unmortgage: canUnmortgage }[a.type](g, s, i);
        if (chk) return { error: chk };
        if (a.type === 'build') { doBuild(g, s, i); log(g, g.names[s] + ' construit ' + (g.houses[i] === 5 ? 'un hôtel' : 'une maison') + ' : ' + BOARD[i].name + '.'); ev.push({ type: 'build', seat: s, sq: i }); }
        else if (a.type === 'sell') { doSell(g, s, i); log(g, g.names[s] + ' revend une construction sur ' + BOARD[i].name + '.'); }
        else if (a.type === 'mortgage') { doMortgage(g, s, i); log(g, g.names[s] + ' hypothèque ' + BOARD[i].name + '.'); }
        else { g.cash[s] -= unmortgageCost(i); g.mortgaged[i] = false; log(g, g.names[s] + ' lève l\'hypothèque de ' + BOARD[i].name + '.'); }
        return { events: ev };
      }
      case 'propose': {
        if (g.trade) return { error: 'Un échange est déjà en cours.' };
        const to = Number(a.to);
        if (to === s || !(to >= 0 && to < g.n) || g.bankrupt[to]) return { error: 'Joueur invalide.' };
        const t = { from: s, to, give: norm(a.give), want: norm(a.want), id: g.seq++ };
        if (!t.give.cash && !t.give.props.length && !t.give.jail && !t.want.cash && !t.want.props.length && !t.want.jail) return { error: 'Échange vide.' };
        const e1 = validSide(g, s, t.give), e2 = validSide(g, to, t.want);
        if (e1 || e2) return { error: e1 || e2 };
        g.trade = t;
        log(g, g.names[s] + ' propose un échange à ' + g.names[to] + '.');
        ev.push({ type: 'trade', from: s, to });
        return { events: ev };
      }
      case 'acceptTrade': case 'rejectTrade': case 'cancelTrade': {
        const t = g.trade;
        if (!t) return { error: 'Pas d\'échange en cours.' };
        if (a.type === 'cancelTrade') { if (t.from !== s) return { error: 'Pas ton échange.' }; g.trade = null; return { events: ev }; }
        if (t.to !== s) return { error: 'Cet échange ne t\'est pas destiné.' };
        if (a.type === 'rejectTrade') { g.trade = null; log(g, g.names[s] + ' refuse l\'échange.'); ev.push({ type: 'tradeNo', from: t.from }); return { events: ev }; }
        const e1 = validSide(g, t.from, t.give), e2 = validSide(g, t.to, t.want);
        if (e1 || e2) { g.trade = null; return { error: e1 || e2 }; }
        applyTrade(g, t); g.trade = null;
        log(g, g.names[s] + ' accepte l\'échange avec ' + g.names[t.from] + '.');
        ev.push({ type: 'tradeOk', from: t.from, to: t.to });
        return { events: ev };
      }
    }
    return { error: 'Action inconnue.' };
  }
  function norm(side) {
    side = side || {};
    return { cash: Math.max(0, Math.floor(Number(side.cash) || 0)), props: Array.isArray(side.props) ? [...new Set(side.props.map(Number))] : [], jail: Math.max(0, Math.floor(Number(side.jail) || 0)) };
  }

  function waiting(g) {
    if (g.phase === 'gameEnd') return [];
    const w = [];
    if (g.phase === 'auction' && g.auction) w.push(g.auction.active[g.auction.idx]);
    else if (g.phase === 'debt' && g.debt) w.push(g.debt.seat);
    else w.push(g.turn);
    if (g.trade && !w.includes(g.trade.to)) w.push(g.trade.to);
    return w;
  }
  function isOver(g) { return g.phase === 'gameEnd'; }

  function view(g, seat) {
    return {
      n: g.n, names: g.names, cash: g.cash, pos: g.pos, inJail: g.inJail, jailTurns: g.jailTurns, jailCards: g.jailCards, bankrupt: g.bankrupt, outOrder: g.outOrder,
      owner: g.owner, houses: g.houses, mortgaged: g.mortgaged, housesLeft: g.housesLeft, hotelsLeft: g.hotelsLeft, pot: g.pot, potOn: !!Number(g.settings.pot),
      turn: g.turn, phase: g.phase, dice: g.dice, auction: g.auction, debt: g.debt, trade: g.trade, lastCard: g.lastCard, log: g.log.slice(-25),
      round: g.round, maxRounds: g.maxRounds, winner: g.winner, worth: g.names.map((_, i) => worth(g, i)), liquidity: g.names.map((_, i) => liquidity(g, i)),
      rolledDouble: g.rolledDouble, waiting: g.phase === 'auction' || g.phase === 'debt' || ['roll', 'buy', 'end'].includes(g.phase) ? waiting(g) : [], mine: seat != null && seat < g.n ? seat : null,
    };
  }

  // ------------------------------------------------------------------
  // Robots
  const RESERVE = 120;
  function groupProgress(g, s, sq) {
    const b = BOARD[sq];
    if (b.type === 'station') return STATIONS.filter((i) => g.owner[i] === s).length;
    if (b.type === 'util') return UTILS.filter((i) => g.owner[i] === s).length;
    return GROUPS[b.group].filter((i) => g.owner[i] === s).length;
  }
  function blocksOpponent(g, s, sq) {
    const b = BOARD[sq];
    if (b.type !== 'prop') return false;
    const owners = GROUPS[b.group].map((i) => g.owner[i]).filter((o) => o != null && o !== s);
    return owners.length === GROUPS[b.group].length - 1 && new Set(owners).size === 1;
  }
  function propValue(g, s, sq) {
    const b = BOARD[sq];
    let v = b.price;
    const prog = groupProgress(g, s, sq);
    if (b.type === 'prop') { const size = GROUPS[b.group].length; if (prog === size - 1) v *= 1.9; else if (prog > 0) v *= 1.3; }
    if (blocksOpponent(g, s, sq)) v *= 1.5;
    if (b.type === 'station') v *= 1 + prog * 0.25;
    return Math.round(v);
  }
  function bot(g, s) {
    if (g.trade && g.trade.to === s) {
      const t = g.trade;
      const val = (side, who) => (side.cash || 0) + (side.jail || 0) * 50 + (side.props || []).reduce((a, i) => a + propValue(g, who, i), 0);
      const completes = (i) => BOARD[i].type === 'prop' && GROUPS[BOARD[i].group].every((j) => j === i || g.owner[j] === t.from);
      const gain = val(t.give, s), loss = (t.want.cash || 0) + (t.want.jail || 0) * 50 + (t.want.props || []).reduce((a, i) => a + BOARD[i].price * (completes(i) ? 2.4 : 1.3) * (1 + groupProgress(g, s, i) * 0.1), 0);
      return { type: gain >= loss * 1.1 ? 'acceptTrade' : 'rejectTrade' };
    }
    if (g.phase === 'auction') {
      const A = g.auction;
      const limit = Math.min(g.cash[s] - RESERVE / 2, propValue(g, s, A.sq) * (0.75 + Math.random() * 0.2));
      const next = A.bid + (A.bid < 100 ? 10 : 20);
      return next <= limit ? { type: 'bid', amount: next } : { type: 'pass' };
    }
    if (g.phase === 'debt') {
      const D = g.debt;
      if (g.cash[s] >= D.amount) return { type: 'payDebt' };
      const act = liquidateStep(g, s);
      return act || { type: 'giveUp' };
    }
    if (s !== g.turn) return null;
    if (g.phase === 'roll') {
      if (g.inJail[s]) {
        if (g.jailCards[s] > 0) return { type: 'useCard' };
        const owned = OWNABLE.filter((i) => g.owner[i] == null).length;
        if (owned > 12 && g.cash[s] > 300) return { type: 'payJail' };
      }
      return { type: 'roll' };
    }
    if (g.phase === 'buy') {
      const b = BOARD[g.pos[s]];
      const want = g.cash[s] - b.price >= RESERVE || (groupProgress(g, s, g.pos[s]) > 0 && g.cash[s] >= b.price) || (blocksOpponent(g, s, g.pos[s]) && g.cash[s] >= b.price);
      return want ? { type: 'buy' } : { type: 'decline' };
    }
    if (g.phase === 'end') {
      // lever des hypothèques, construire, puis finir
      if (g.cash[s] > 600) {
        const m = OWNABLE.find((i) => g.owner[i] === s && g.mortgaged[i] && g.cash[s] - unmortgageCost(i) > 400);
        if (m != null) return { type: 'unmortgage', sq: m };
      }
      const order = ['orange', 'rouge', 'jaune', 'rose', 'ciel', 'vert', 'bleu', 'brun'];
      for (const grp of order) {
        if (!ownsGroup(g, s, grp)) continue;
        const cost = HOUSE[grp];
        if (g.cash[s] - cost < 200) continue;
        const sq = GROUPS[grp].filter((i) => canBuild(g, s, i) === null).sort((a, b) => g.houses[a] - g.houses[b])[0];
        if (sq != null) return { type: 'build', sq };
      }
      const tr = botTradeIdea(g, s);
      if (tr) return tr;
      return { type: 'endTurn' };
    }
    return null;
  }
  function botTradeIdea(g, s) {
    if (g.trade) return null;
    g.botTrade = g.botTrade || {};
    if (g.botTrade[s] && g.round - g.botTrade[s] < 3) return null;
    for (const grp of Object.keys(GROUPS)) {
      const sqs = GROUPS[grp];
      const mineN = sqs.filter((i) => g.owner[i] === s).length;
      if (mineN !== sqs.length - 1) continue;
      const miss = sqs.find((i) => g.owner[i] !== s);
      const o = g.owner[miss];
      if (o == null || g.bankrupt[o] || g.mortgaged[miss]) continue;
      if (sqs.some((i) => g.houses[i] > 0)) continue;
      const offer = Math.round(BOARD[miss].price * (1.8 + g.round / 12 + Math.random() * 0.4) / 10) * 10;
      if (g.cash[s] - offer < 150) continue;
      g.botTrade[s] = g.round;
      return { type: 'propose', to: o, give: { cash: offer }, want: { props: [miss] } };
    }
    return null;
  }
  function liquidateStep(g, s) {
    const mine = OWNABLE.filter((i) => g.owner[i] === s);
    const h = mine.filter((i) => canSell(g, s, i) === null).sort((a, b) => HOUSE[BOARD[a].group] - HOUSE[BOARD[b].group]);
    if (h.length) return { type: 'sell', sq: h[0] };
    const m = mine.filter((i) => canMortgage(g, s, i) === null).sort((a, b) => propValue(g, s, a) - propValue(g, s, b));
    if (m.length) return { type: 'mortgage', sq: m[0] };
    return null;
  }
  function fallback(g, s) {
    if (g.trade && g.trade.to === s) return { type: 'rejectTrade' };
    if (g.phase === 'auction') return { type: 'pass' };
    if (g.phase === 'debt') return g.cash[s] >= g.debt.amount ? { type: 'payDebt' } : liquidateStep(g, s) || { type: 'giveUp' };
    if (g.phase === 'roll') return { type: 'roll' };
    if (g.phase === 'buy') return { type: 'decline' };
    if (g.phase === 'end') return { type: 'endTurn' };
    return null;
  }

  const module = {
    id: 'capitole', minPlayers: 2, maxPlayers: 6,
    defaultSettings: { cash: 1500, rounds: 0, pot: 0, auction: 1 },
    settingsUI: [
      { key: 'rounds', label: 'Fin de partie', options: [{ value: 0, label: 'Dernier survivant' }, { value: 20, label: 'Après 20 tours' }, { value: 35, label: 'Après 35 tours' }, { value: 50, label: 'Après 50 tours' }] },
      { key: 'cash', label: 'Argent de départ', options: [{ value: 1000, label: '1 000 €' }, { value: 1500, label: '1 500 €' }, { value: 2000, label: '2 000 €' }] },
      { key: 'auction', label: 'Rue refusée', options: [{ value: 1, label: 'Mise aux enchères' }, { value: 0, label: 'Reste à la banque' }] },
      { key: 'pot', label: 'Cagnotte au Jardin', options: [{ value: 0, label: 'Non (règle officielle)' }, { value: 1, label: 'Oui (taxes et amendes)' }] },
    ],
    create, apply, view, waiting, bot, fallback, isOver, tick: () => null,
    botDelay: (g) => (g.phase === 'auction' ? 700 : g.phase === 'end' ? 600 : 1100),
  };
  root.CapitoleEngine = { module, BOARD, GROUPS, G, HOUSE, STATIONS, UTILS, rentOf, canBuild, canSell, canMortgage, canUnmortgage, unmortgageCost, ownsGroup, OWNABLE };
})(typeof window !== 'undefined' ? window : globalThis);
