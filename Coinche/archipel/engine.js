/* ============================================================
   Archipel — jeu de colonisation (règles de Catan), 3 ou 4 joueurs
   ============================================================ */
(function (root) {
  'use strict';
  const Net = root.SalleNet;
  const randInt = (n) => (Net ? Net.randInt(n) : Math.floor(Math.random() * n));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const RES = ['bois', 'brique', 'laine', 'ble', 'minerai'];
  const RES_NAME = { bois: 'Bois', brique: 'Brique', laine: 'Laine', ble: 'Blé', minerai: 'Minerai' };
  const TERRAIN = { foret: 'bois', colline: 'brique', pre: 'laine', champ: 'ble', montagne: 'minerai', desert: null };
  const TERRAIN_NAME = { foret: 'Forêt', colline: 'Colline', pre: 'Pré', champ: 'Champ', montagne: 'Montagne', desert: 'Désert' };
  const COST = {
    road: { bois: 1, brique: 1 },
    settlement: { bois: 1, brique: 1, laine: 1, ble: 1 },
    city: { ble: 2, minerai: 3 },
    dev: { laine: 1, ble: 1, minerai: 1 },
  };
  const DEV_NAME = { knight: 'Chevalier', vp: 'Point de victoire', road: 'Construction de routes', plenty: 'Abondance', monopoly: 'Monopole' };
  const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

  // ---------- Géométrie fixe ----------
  const HEXES = [];
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.abs(q + r) <= 2) HEXES.push({ q, r, x: Math.sqrt(3) * (q + r / 2), y: 1.5 * r });
  const VERTS = [], VKEY = {}, EDGES = [], EKEY = {};
  HEXES.forEach((h, hi) => {
    h.verts = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 180) * (60 * k - 30);
      const x = h.x + Math.cos(a), y = h.y + Math.sin(a);
      const key = Math.round(x * 100) + ',' + Math.round(y * 100);
      if (VKEY[key] == null) { VKEY[key] = VERTS.length; VERTS.push({ x, y, hexes: [], adj: [], edges: [] }); }
      const vi = VKEY[key];
      VERTS[vi].hexes.push(hi);
      h.verts.push(vi);
    }
    for (let k = 0; k < 6; k++) {
      const a = h.verts[k], b = h.verts[(k + 1) % 6];
      const key = Math.min(a, b) + '-' + Math.max(a, b);
      if (EKEY[key] == null) { EKEY[key] = EDGES.length; EDGES.push({ a: Math.min(a, b), b: Math.max(a, b), hexes: [] }); }
      EDGES[EKEY[key]].hexes.push(hi);
    }
  });
  EDGES.forEach((e, ei) => { VERTS[e.a].adj.push(e.b); VERTS[e.b].adj.push(e.a); VERTS[e.a].edges.push(ei); VERTS[e.b].edges.push(ei); });
  const HEX_ADJ = HEXES.map((h) => HEXES.map((o, j) => j).filter((j) => { const o = HEXES[j]; const d = Math.hypot(o.x - h.x, o.y - h.y); return d > 0.1 && d < 1.9; }));
  // Arêtes côtières triées autour de l'île → emplacements des ports
  const COAST = EDGES.map((e, i) => i).filter((i) => EDGES[i].hexes.length === 1)
    .sort((i, j) => angleOf(i) - angleOf(j));
  function angleOf(i) { const e = EDGES[i]; const x = (VERTS[e.a].x + VERTS[e.b].x) / 2, y = (VERTS[e.a].y + VERTS[e.b].y) / 2; return Math.atan2(y, x); }
  const PORT_SLOTS = [0, 3, 7, 10, 13, 17, 20, 23, 27].map((k) => COAST[k]);

  function makeBoard() {
    for (let tries = 0; tries < 500; tries++) {
      const terr = shuffle(['foret', 'foret', 'foret', 'foret', 'pre', 'pre', 'pre', 'pre', 'champ', 'champ', 'champ', 'champ', 'colline', 'colline', 'colline', 'montagne', 'montagne', 'montagne', 'desert']);
      const nums = shuffle([2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]);
      const tiles = terr.map((t) => ({ terrain: t, num: t === 'desert' ? null : nums.pop() }));
      const bad = tiles.some((t, i) => (t.num === 6 || t.num === 8) && HEX_ADJ[i].some((j) => tiles[j].num === 6 || tiles[j].num === 8));
      if (!bad) return tiles;
    }
    return null;
  }

  // ------------------------------------------------------------------
  function create({ settings, names, n }) {
    const tiles = makeBoard();
    const portTypes = shuffle(['3', '3', '3', '3', 'bois', 'brique', 'laine', 'ble', 'minerai']);
    const ports = PORT_SLOTS.map((e, i) => ({ edge: e, type: portTypes[i] }));
    const vPort = VERTS.map(() => null);
    ports.forEach((p) => { vPort[EDGES[p.edge].a] = p.type; vPort[EDGES[p.edge].b] = p.type; });
    const g = {
      n, names, settings: { ...settings }, target: Number(settings.vp) || 10,
      tiles, ports, vPort, robber: tiles.findIndex((t) => t.terrain === 'desert'),
      vOwner: VERTS.map(() => null), vCity: VERTS.map(() => false), eOwner: EDGES.map(() => null),
      hand: names.map(() => ({ bois: 0, brique: 0, laine: 0, ble: 0, minerai: 0 })),
      bank: { bois: 19, brique: 19, laine: 19, ble: 19, minerai: 19 },
      dev: names.map(() => []), devNew: names.map(() => []), knights: new Array(n).fill(0),
      devDeck: shuffle([].concat(Array(14).fill('knight'), Array(5).fill('vp'), Array(2).fill('road'), Array(2).fill('plenty'), Array(2).fill('monopoly'))),
      pieces: names.map(() => ({ road: 15, settlement: 5, city: 4 })),
      longest: null, army: null, roadLen: new Array(n).fill(0),
      turn: 0, phase: 'setup', setupOrder: [], setupIdx: 0, setupSub: 'settle', lastSettle: null,
      dice: [0, 0], devPlayed: false, discard: null, afterRobber: 'main', stealFrom: null, freeRoads: 0,
      offer: null, log: [], winner: null, round: 1, seq: 0, lastProd: null,
    };
    const first = randInt(n);
    for (let k = 0; k < n; k++) g.setupOrder.push((first + k) % n);
    for (let k = n - 1; k >= 0; k--) g.setupOrder.push((first + k) % n);
    g.turn = g.setupOrder[0];
    log(g, 'Placement initial : chacun pose une colonie et une route, puis on repart dans l\'autre sens.');
    return { state: g, events: [] };
  }
  function log(g, t) { g.log.push(t); if (g.log.length > 60) g.log.shift(); }
  const total = (h) => RES.reduce((s, r) => s + h[r], 0);
  const has = (h, cost) => Object.entries(cost).every(([r, k]) => h[r] >= k);
  function payCost(g, s, cost) { for (const [r, k] of Object.entries(cost)) { g.hand[s][r] -= k; g.bank[r] += k; } }
  function resList(o) { return Object.entries(o).filter(([, k]) => k > 0).map(([r, k]) => k + ' ' + RES_NAME[r].toLowerCase()).join(', '); }

  // ---------- Règles de placement ----------
  function vertexFree(g, v) { return g.vOwner[v] == null && VERTS[v].adj.every((a) => g.vOwner[a] == null); }
  function canSettle(g, s, v, setup) {
    if (!(v >= 0 && v < VERTS.length)) return 'Emplacement invalide.';
    if (!vertexFree(g, v)) return 'Trop près d\'une autre colonie (il faut au moins deux routes d\'écart).';
    if (!setup && !VERTS[v].edges.some((e) => g.eOwner[e] === s)) return 'Une colonie doit toucher une de tes routes.';
    if (g.pieces[s].settlement <= 0) return 'Plus de colonies disponibles.';
    return null;
  }
  function canRoad(g, s, e, mustTouch) {
    if (!(e >= 0 && e < EDGES.length)) return 'Emplacement invalide.';
    if (g.eOwner[e] != null) return 'Il y a déjà une route.';
    if (g.pieces[s].road <= 0) return 'Plus de routes disponibles.';
    const E = EDGES[e];
    if (mustTouch != null) return E.a === mustTouch || E.b === mustTouch ? null : 'La route doit partir de ta nouvelle colonie.';
    const ok = [E.a, E.b].some((v) => g.vOwner[v] === s || (g.vOwner[v] == null && VERTS[v].edges.some((x) => x !== e && g.eOwner[x] === s)));
    return ok ? null : 'Une route doit prolonger ton réseau.';
  }
  function canCity(g, s, v) {
    if (g.vOwner[v] !== s || g.vCity[v]) return 'Il faut une de tes colonies.';
    if (g.pieces[s].city <= 0) return 'Plus de villes disponibles.';
    return null;
  }

  // ---------- Route la plus longue ----------
  function longestRoad(g, s) {
    const mine = EDGES.map((_, i) => i).filter((i) => g.eOwner[i] === s);
    let best = 0;
    const used = new Set();
    function dfs(v, len) {
      if (len > best) best = len;
      if (len > 0 && g.vOwner[v] != null && g.vOwner[v] !== s) return;
      for (const e of VERTS[v].edges) {
        if (g.eOwner[e] !== s || used.has(e)) continue;
        used.add(e);
        const E = EDGES[e];
        dfs(E.a === v ? E.b : E.a, len + 1);
        used.delete(e);
      }
    }
    const starts = new Set(); mine.forEach((e) => { starts.add(EDGES[e].a); starts.add(EDGES[e].b); });
    for (const v of starts) dfs(v, 0);
    return best;
  }
  function updateLongest(g, ev) {
    for (let s = 0; s < g.n; s++) g.roadLen[s] = longestRoad(g, s);
    const max = Math.max(...g.roadLen);
    const prev = g.longest;
    if (max < 5) g.longest = null;
    else {
      const leaders = g.roadLen.map((l, s) => (l === max ? s : -1)).filter((s) => s >= 0);
      if (prev != null && leaders.includes(prev)) g.longest = prev;
      else if (leaders.length === 1) g.longest = leaders[0];
      else g.longest = null;
    }
    if (g.longest !== prev && g.longest != null) { log(g, g.names[g.longest] + ' prend la route la plus longue (' + max + ').'); ev && ev.push({ type: 'longest', seat: g.longest }); }
  }
  function updateArmy(g, s, ev) {
    const k = g.knights[s];
    if (k < 3) return;
    if (g.army === s) return;
    if (g.army == null || k > g.knights[g.army]) { g.army = s; log(g, g.names[s] + ' prend l\'armée la plus puissante (' + k + ' chevaliers).'); ev.push({ type: 'army', seat: s }); }
  }
  function vp(g, s, hidden) {
    let v = 0;
    g.vOwner.forEach((o, i) => { if (o === s) v += g.vCity[i] ? 2 : 1; });
    if (g.longest === s) v += 2;
    if (g.army === s) v += 2;
    if (hidden) v += g.dev[s].filter((c) => c === 'vp').length + g.devNew[s].filter((c) => c === 'vp').length;
    return v;
  }
  function checkWin(g, ev) {
    const s = g.turn;
    if (vp(g, s, true) >= g.target) { g.phase = 'gameEnd'; g.winner = s; log(g, g.names[s] + ' atteint ' + vp(g, s, true) + ' points et gagne !'); ev.push({ type: 'win', seat: s }); return true; }
    return false;
  }

  // ---------- Production ----------
  function produce(g, sum, ev) {
    const gains = g.names.map(() => ({ bois: 0, brique: 0, laine: 0, ble: 0, minerai: 0 }));
    g.tiles.forEach((t, hi) => {
      if (t.num !== sum || hi === g.robber) return;
      const r = TERRAIN[t.terrain];
      for (const v of HEXES[hi].verts) { const o = g.vOwner[v]; if (o != null) gains[o][r] += g.vCity[v] ? 2 : 1; }
    });
    for (const r of RES) {
      const need = gains.reduce((a, x) => a + x[r], 0);
      if (!need) continue;
      const who = gains.map((x, s) => (x[r] ? s : -1)).filter((s) => s >= 0);
      if (need > g.bank[r]) {
        if (who.length > 1) { who.forEach((s) => { gains[s][r] = 0; }); log(g, 'La banque n\'a plus assez de ' + RES_NAME[r].toLowerCase() + ' : personne n\'en reçoit.'); continue; }
        gains[who[0]][r] = g.bank[r];
      }
      for (const s of who) { g.hand[s][r] += gains[s][r]; g.bank[r] -= gains[s][r]; }
    }
    g.lastProd = gains;
    const parts = gains.map((x, s) => (total(x) ? g.names[s] + ' : ' + resList(x) : null)).filter(Boolean);
    log(g, parts.length ? 'Production — ' + parts.join(' · ') : 'Personne ne produit rien.');
    ev.push({ type: 'prod', gains });
  }

  function victims(g, s) {
    return [...new Set(HEXES[g.robber].verts.map((v) => g.vOwner[v]).filter((o) => o != null && o !== s && total(g.hand[o]) > 0))];
  }
  function steal(g, s, from, ev) {
    const pool = [];
    for (const r of RES) for (let k = 0; k < g.hand[from][r]; k++) pool.push(r);
    if (pool.length) {
      const r = pool[randInt(pool.length)];
      g.hand[from][r]--; g.hand[s][r]++;
      log(g, g.names[s] + ' vole une carte à ' + g.names[from] + '.');
      ev.push({ type: 'steal', seat: s, from, res: r });
    }
  }
  function afterRobberMove(g, s, ev) {
    const vs = victims(g, s);
    if (vs.length === 0) { g.phase = g.afterRobber; }
    else if (vs.length === 1) { steal(g, s, vs[0], ev); g.phase = g.afterRobber; }
    else { g.phase = 'steal'; g.stealFrom = vs; }
  }

  function startTurn(g, ev) {
    g.phase = 'roll'; g.devPlayed = false; g.offer = null;
    for (let s = 0; s < g.n; s++) { g.dev[s].push(...g.devNew[s]); g.devNew[s] = []; }
    ev.push({ type: 'turn', seat: g.turn });
  }

  // ---------- Actions ----------
  function apply(g, s, a) {
    const ev = [];
    if (g.phase === 'gameEnd') return { error: 'La partie est finie.' };
    const mine = s === g.turn;
    const name = g.names[s];
    switch (a.type) {
      case 'setupSettle': {
        if (g.phase !== 'setup' || !mine || g.setupSub !== 'settle') return { error: 'Pas maintenant.' };
        const v = Number(a.v);
        const err = canSettle(g, s, v, true); if (err) return { error: err };
        g.vOwner[v] = s; g.pieces[s].settlement--; g.lastSettle = v; g.setupSub = 'road';
        ev.push({ type: 'build', seat: s, kind: 'settlement', at: v });
        if (g.setupIdx >= g.n) {
          const got = { bois: 0, brique: 0, laine: 0, ble: 0, minerai: 0 };
          for (const hi of VERTS[v].hexes) { const r = TERRAIN[g.tiles[hi].terrain]; if (r) { got[r]++; g.hand[s][r]++; g.bank[r]--; } }
          log(g, name + ' pose sa deuxième colonie et reçoit ' + (resList(got) || 'rien') + '.');
        } else log(g, name + ' pose sa première colonie.');
        return { events: ev };
      }
      case 'setupRoad': {
        if (g.phase !== 'setup' || !mine || g.setupSub !== 'road') return { error: 'Pas maintenant.' };
        const e = Number(a.e);
        const err = canRoad(g, s, e, g.lastSettle); if (err) return { error: err };
        g.eOwner[e] = s; g.pieces[s].road--;
        ev.push({ type: 'build', seat: s, kind: 'road', at: e });
        g.setupIdx++; g.setupSub = 'settle';
        if (g.setupIdx >= g.setupOrder.length) { g.turn = g.setupOrder[0]; updateLongest(g); log(g, 'Placement terminé. ' + g.names[g.turn] + ' lance les dés.'); startTurn(g, ev); }
        else g.turn = g.setupOrder[g.setupIdx];
        return { events: ev };
      }
      case 'roll': {
        if (g.phase !== 'roll' || !mine) return { error: 'Pas maintenant.' };
        const d = [1 + randInt(6), 1 + randInt(6)], sum = d[0] + d[1];
        g.dice = d;
        log(g, name + ' fait ' + sum + '.');
        ev.push({ type: 'dice', seat: s, dice: d });
        if (sum === 7) {
          const need = g.hand.map((h) => (total(h) > 7 ? Math.floor(total(h) / 2) : 0));
          g.afterRobber = 'main';
          if (need.some((k) => k > 0)) { g.discard = need; g.phase = 'discard'; log(g, 'Le voleur ! Ceux qui ont plus de 7 cartes en défaussent la moitié.'); }
          else g.phase = 'robber';
          ev.push({ type: 'seven' });
        } else { produce(g, sum, ev); g.phase = 'main'; }
        return { events: ev };
      }
      case 'discard': {
        if (g.phase !== 'discard' || !g.discard || !g.discard[s]) return { error: 'Tu n\'as rien à défausser.' };
        const d = a.res || {};
        const cnt = RES.reduce((x, r) => x + (Math.max(0, Math.floor(Number(d[r]) || 0))), 0);
        if (cnt !== g.discard[s]) return { error: 'Défausse exactement ' + g.discard[s] + ' cartes.' };
        if (RES.some((r) => (Number(d[r]) || 0) > g.hand[s][r])) return { error: 'Tu n\'as pas ces cartes.' };
        for (const r of RES) { const k = Math.floor(Number(d[r]) || 0); g.hand[s][r] -= k; g.bank[r] += k; }
        g.discard[s] = 0;
        log(g, name + ' défausse ' + cnt + ' cartes.');
        if (g.discard.every((k) => !k)) { g.discard = null; g.phase = 'robber'; }
        return { events: ev };
      }
      case 'robber': {
        if (g.phase !== 'robber' || !mine) return { error: 'Pas maintenant.' };
        const h = Number(a.hex);
        if (!(h >= 0 && h < HEXES.length) || h === g.robber) return { error: 'Déplace le voleur sur une autre case.' };
        g.robber = h;
        log(g, name + ' place le voleur sur ' + TERRAIN_NAME[g.tiles[h].terrain].toLowerCase() + (g.tiles[h].num ? ' (' + g.tiles[h].num + ')' : '') + '.');
        ev.push({ type: 'robber', hex: h });
        afterRobberMove(g, s, ev);
        return { events: ev };
      }
      case 'steal': {
        if (g.phase !== 'steal' || !mine || !g.stealFrom.includes(Number(a.from))) return { error: 'Choisis un joueur touché par le voleur.' };
        steal(g, s, Number(a.from), ev);
        g.phase = g.afterRobber; g.stealFrom = null;
        return { events: ev };
      }
      case 'build': {
        const free = g.phase === 'roadbuild' && a.kind === 'road';
        if (!mine || (g.phase !== 'main' && !free)) return { error: 'Pas maintenant.' };
        const kind = a.kind, at = Number(a.at);
        const err = kind === 'road' ? canRoad(g, s, at) : kind === 'settlement' ? canSettle(g, s, at, false) : kind === 'city' ? canCity(g, s, at) : 'Construction inconnue.';
        if (err) return { error: err };
        if (!free && !has(g.hand[s], COST[kind])) return { error: 'Il te manque des ressources.' };
        if (!free) payCost(g, s, COST[kind]);
        if (kind === 'road') { g.eOwner[at] = s; g.pieces[s].road--; }
        else if (kind === 'settlement') { g.vOwner[at] = s; g.pieces[s].settlement--; }
        else { g.vCity[at] = true; g.pieces[s].city--; g.pieces[s].settlement++; }
        log(g, name + (kind === 'road' ? ' construit une route' : kind === 'settlement' ? ' fonde une colonie' : ' bâtit une ville') + (free ? ' (gratuite)' : '') + '.');
        ev.push({ type: 'build', seat: s, kind, at });
        if (kind !== 'city') updateLongest(g, ev);
        if (free) { g.freeRoads--; if (g.freeRoads <= 0 || g.pieces[s].road <= 0) { g.phase = g.afterRobber; g.freeRoads = 0; } }
        checkWin(g, ev);
        return { events: ev };
      }
      case 'endRoads': {
        if (!mine || g.phase !== 'roadbuild') return { error: 'Pas maintenant.' };
        g.freeRoads = 0; g.phase = g.afterRobber;
        return { events: ev };
      }
      case 'buyDev': {
        if (!mine || g.phase !== 'main') return { error: 'Pas maintenant.' };
        if (!g.devDeck.length) return { error: 'Plus de cartes développement.' };
        if (!has(g.hand[s], COST.dev)) return { error: 'Il te manque des ressources.' };
        payCost(g, s, COST.dev);
        const c = g.devDeck.pop();
        g.devNew[s].push(c);
        log(g, name + ' achète une carte développement.');
        ev.push({ type: 'devbuy', seat: s });
        checkWin(g, ev);
        return { events: ev };
      }
      case 'playDev': {
        if (!mine || !['roll', 'main'].includes(g.phase)) return { error: 'Pas maintenant.' };
        if (g.devPlayed) return { error: 'Une seule carte développement par tour.' };
        const c = a.card;
        const i = g.dev[s].indexOf(c);
        if (i < 0 || c === 'vp') return { error: c === 'vp' ? 'Les points de victoire restent cachés.' : 'Tu n\'as pas cette carte (ou tu viens de l\'acheter).' };
        if (c !== 'knight' && g.phase !== 'main') return { error: 'Lance d\'abord les dés.' };
        if (c === 'plenty') {
          const r1 = a.res, r2 = a.res2;
          if (!RES.includes(r1) || !RES.includes(r2)) return { error: 'Choisis deux ressources.' };
          if (g.bank[r1] < 1 || g.bank[r2] < (r1 === r2 ? 2 : 1)) return { error: 'La banque n\'en a plus assez.' };
        }
        if (c === 'monopoly' && !RES.includes(a.res)) return { error: 'Choisis une ressource.' };
        if (c === 'road' && g.pieces[s].road <= 0) return { error: 'Plus de routes disponibles.' };
        g.dev[s].splice(i, 1);
        g.devPlayed = true;
        ev.push({ type: 'devplay', seat: s, card: c });
        if (c === 'knight') {
          g.knights[s]++;
          log(g, name + ' joue un Chevalier.');
          updateArmy(g, s, ev);
          g.afterRobber = g.phase; g.phase = 'robber';
          checkWin(g, ev);
        } else if (c === 'road') {
          log(g, name + ' joue Construction de routes.');
          g.afterRobber = 'main'; g.freeRoads = 2; g.phase = 'roadbuild';
        } else if (c === 'plenty') {
          g.hand[s][a.res]++; g.bank[a.res]--; g.hand[s][a.res2]++; g.bank[a.res2]--;
          log(g, name + ' joue Abondance et prend ' + RES_NAME[a.res].toLowerCase() + ' et ' + RES_NAME[a.res2].toLowerCase() + '.');
        } else if (c === 'monopoly') {
          let k = 0;
          for (let o = 0; o < g.n; o++) if (o !== s) { k += g.hand[o][a.res]; g.hand[s][a.res] += g.hand[o][a.res]; g.hand[o][a.res] = 0; }
          log(g, name + ' joue Monopole sur le ' + RES_NAME[a.res].toLowerCase() + ' et récupère ' + k + ' cartes.');
        }
        return { events: ev };
      }
      case 'bankTrade': {
        if (!mine || g.phase !== 'main') return { error: 'Pas maintenant.' };
        const give = a.give, get = a.get;
        if (!RES.includes(give) || !RES.includes(get) || give === get) return { error: 'Échange invalide.' };
        const rate = tradeRate(g, s, give);
        if (g.hand[s][give] < rate) return { error: 'Il te faut ' + rate + ' ' + RES_NAME[give].toLowerCase() + '.' };
        if (g.bank[get] < 1) return { error: 'La banque n\'en a plus.' };
        g.hand[s][give] -= rate; g.bank[give] += rate; g.hand[s][get]++; g.bank[get]--;
        log(g, name + ' échange ' + rate + ' ' + RES_NAME[give].toLowerCase() + ' contre 1 ' + RES_NAME[get].toLowerCase() + ' avec la banque.');
        ev.push({ type: 'trade' });
        return { events: ev };
      }
      case 'offer': {
        if (!mine || g.phase !== 'main') return { error: 'Pas maintenant.' };
        const give = cleanRes(a.give), get = cleanRes(a.get);
        if (!total(give) || !total(get)) return { error: 'Indique ce que tu donnes et ce que tu veux.' };
        if (RES.some((r) => give[r] > g.hand[s][r])) return { error: 'Tu n\'as pas ces cartes.' };
        g.offer = { from: s, give, get, declined: [], id: g.seq++ };
        log(g, name + ' propose ' + resList(give) + ' contre ' + resList(get) + '.');
        ev.push({ type: 'offer', seat: s });
        return { events: ev };
      }
      case 'acceptOffer': case 'declineOffer': {
        const o = g.offer;
        if (!o || s === o.from) return { error: 'Pas d\'offre pour toi.' };
        if (a.type === 'declineOffer') { if (!o.declined.includes(s)) o.declined.push(s); if (o.declined.length >= g.n - 1) { log(g, 'Personne n\'accepte l\'offre de ' + g.names[o.from] + '.'); g.offer = null; } return { events: ev }; }
        if (RES.some((r) => o.get[r] > g.hand[s][r])) return { error: 'Tu n\'as pas les cartes demandées.' };
        if (RES.some((r) => o.give[r] > g.hand[o.from][r])) { g.offer = null; return { error: 'L\'offre n\'est plus valable.' }; }
        for (const r of RES) { g.hand[o.from][r] += o.get[r] - o.give[r]; g.hand[s][r] += o.give[r] - o.get[r]; }
        log(g, name + ' accepte l\'échange avec ' + g.names[o.from] + '.');
        ev.push({ type: 'tradeok', from: o.from, to: s });
        g.offer = null;
        return { events: ev };
      }
      case 'cancelOffer': {
        if (!g.offer || g.offer.from !== s) return { error: 'Pas d\'offre.' };
        g.offer = null;
        return { events: ev };
      }
      case 'endTurn': {
        if (!mine || g.phase !== 'main') return { error: 'Pas maintenant.' };
        if (checkWin(g, ev)) return { events: ev };
        g.turn = (g.turn + 1) % g.n;
        if (g.turn === g.setupOrder[0]) g.round++;
        startTurn(g, ev);
        return { events: ev };
      }
    }
    return { error: 'Action inconnue.' };
  }
  function cleanRes(o) { const r = {}; for (const k of RES) r[k] = Math.max(0, Math.floor(Number((o || {})[k]) || 0)); return r; }
  function tradeRate(g, s, res) {
    let rate = 4;
    g.vOwner.forEach((o, v) => { if (o !== s || !g.vPort[v]) return; if (g.vPort[v] === '3') rate = Math.min(rate, 3); else if (g.vPort[v] === res) rate = 2; });
    return rate;
  }

  function waiting(g) {
    if (g.phase === 'gameEnd') return [];
    if (g.phase === 'discard') return g.discard.map((k, s) => (k ? s : -1)).filter((s) => s >= 0);
    const w = [g.turn];
    if (g.offer) for (let s = 0; s < g.n; s++) if (s !== g.offer.from && !g.offer.declined.includes(s)) w.push(s);
    return w;
  }
  function isOver(g) { return g.phase === 'gameEnd'; }

  function view(g, seat) {
    const me = seat != null && seat < g.n ? seat : null;
    const end = g.phase === 'gameEnd';
    return {
      n: g.n, names: g.names, target: g.target, tiles: g.tiles, ports: g.ports, robber: g.robber,
      vOwner: g.vOwner, vCity: g.vCity, eOwner: g.eOwner, bank: g.bank, devLeft: g.devDeck.length,
      cards: g.hand.map(total), devCount: g.names.map((_, s) => g.dev[s].length + g.devNew[s].length), knights: g.knights,
      pieces: g.pieces, longest: g.longest, army: g.army, roadLen: g.roadLen,
      vp: g.names.map((_, s) => vp(g, s, end || s === me)),
      turn: g.turn, phase: g.phase, setupSub: g.setupSub, setupIdx: g.setupIdx, lastSettle: g.lastSettle, dice: g.dice, devPlayed: g.devPlayed,
      discard: g.discard, stealFrom: g.stealFrom, freeRoads: g.freeRoads, offer: g.offer, log: g.log.slice(-25), winner: g.winner, round: g.round,
      lastProd: g.lastProd,
      waiting: g.phase === 'discard' ? waiting(g) : [g.turn].concat(g.offer ? waiting(g).slice(1) : []),
      mine: me,
      hand: me != null ? g.hand[me] : null,
      dev: me != null ? g.dev[me] : null, devNew: me != null ? g.devNew[me] : null,
      rates: me != null ? Object.fromEntries(RES.map((r) => [r, tradeRate(g, me, r)])) : null,
      legal: me != null && me === g.turn ? legalSpots(g, me) : null,
      allDev: end ? g.names.map((_, s) => g.dev[s].concat(g.devNew[s])) : null,
    };
  }
  function legalSpots(g, s) {
    const L = { settle: [], road: [], city: [] };
    if (g.phase === 'setup') {
      if (g.setupSub === 'settle') L.settle = VERTS.map((_, v) => v).filter((v) => !canSettle(g, s, v, true));
      else L.road = EDGES.map((_, e) => e).filter((e) => !canRoad(g, s, e, g.lastSettle));
    } else if (g.phase === 'main' || g.phase === 'roadbuild') {
      L.road = EDGES.map((_, e) => e).filter((e) => !canRoad(g, s, e));
      if (g.phase === 'main') {
        L.settle = VERTS.map((_, v) => v).filter((v) => !canSettle(g, s, v, false));
        L.city = VERTS.map((_, v) => v).filter((v) => !canCity(g, s, v));
      }
    }
    return L;
  }

  // ------------------------------------------------------------------
  // Robots
  function vScore(g, v, s) {
    let sc = 0;
    const kinds = new Set();
    for (const hi of VERTS[v].hexes) { const t = g.tiles[hi]; if (t.num && hi !== g.robber) { sc += PIPS[t.num]; kinds.add(t.terrain); } }
    sc += kinds.size * 1.2;
    if (g.vPort[v]) sc += 1;
    if (s != null) { // diversité par rapport à ce qu'on a déjà
      const mine = new Set();
      g.vOwner.forEach((o, w) => { if (o === s) VERTS[w].hexes.forEach((hi) => mine.add(g.tiles[hi].terrain)); });
      for (const k of kinds) if (!mine.has(k)) sc += 1.5;
    }
    return sc;
  }
  function bestRoadToward(g, s, edges) {
    let best = null, bs = -1;
    for (const e of edges) {
      const E = EDGES[e];
      for (const v of [E.a, E.b]) {
        let sc = vertexFree(g, v) ? vScore(g, v, s) : 0;
        for (const w of VERTS[v].adj) if (vertexFree(g, w)) sc = Math.max(sc, vScore(g, w, s) * 0.8);
        if (sc > bs) { bs = sc; best = e; }
      }
    }
    return best;
  }
  function bot(g, s) {
    if (g.offer && g.offer.from !== s && !g.offer.declined.includes(s) && g.phase !== 'discard') {
      const o = g.offer;
      const h = g.hand[s];
      const can = RES.every((r) => h[r] >= o.get[r]);
      const wantIt = RES.some((r) => o.give[r] > 0 && h[r] === 0);
      const spare = RES.every((r) => !o.get[r] || h[r] - o.get[r] >= 1);
      const leader = vp(g, o.from, false) >= g.target - 2;
      return can && wantIt && spare && !leader && total(o.give) >= total(o.get) ? { type: 'acceptOffer' } : { type: 'declineOffer' };
    }
    if (g.phase === 'discard') {
      const need = g.discard[s]; if (!need) return null;
      const h = { ...g.hand[s] }; const d = {};
      for (let k = 0; k < need; k++) { const r = RES.slice().sort((a, b) => h[b] - h[a])[0]; h[r]--; d[r] = (d[r] || 0) + 1; }
      return { type: 'discard', res: d };
    }
    if (s !== g.turn) return null;
    const L = legalSpots(g, s);
    const h = g.hand[s];
    if (g.phase === 'setup') {
      if (g.setupSub === 'settle') return { type: 'setupSettle', v: L.settle.sort((a, b) => vScore(g, b, s) - vScore(g, a, s))[0] };
      return { type: 'setupRoad', e: bestRoadToward(g, s, L.road) };
    }
    if (g.phase === 'roll') {
      const onMe = HEXES[g.robber].verts.some((v) => g.vOwner[v] === s);
      if (!g.devPlayed && g.dev[s].includes('knight') && onMe) return { type: 'playDev', card: 'knight' };
      return { type: 'roll' };
    }
    if (g.phase === 'robber') {
      let best = null, bs = -1e9;
      g.tiles.forEach((t, hi) => {
        if (hi === g.robber || !t.num) return;
        let sc = 0;
        for (const v of HEXES[hi].verts) { const o = g.vOwner[v]; if (o == null) continue; const w = (g.vCity[v] ? 2 : 1) * PIPS[t.num]; sc += o === s ? -w * 3 : w * (1 + vp(g, o, false) / 5); }
        if (sc > bs) { bs = sc; best = hi; }
      });
      return { type: 'robber', hex: best != null ? best : (g.robber + 1) % 19 };
    }
    if (g.phase === 'steal') return { type: 'steal', from: g.stealFrom.slice().sort((a, b) => g.hand.map(total)[b] - g.hand.map(total)[a])[0] };
    if (g.phase === 'roadbuild') return L.road.length ? { type: 'build', kind: 'road', at: bestRoadToward(g, s, L.road) } : { type: 'endRoads' };
    if (g.phase === 'main') {
      if (g.offer && g.offer.from === s) return { type: 'cancelOffer' };
      // cartes développement
      if (!g.devPlayed) {
        if (g.dev[s].includes('road') && L.road.length >= 2 && g.pieces[s].road >= 2) return { type: 'playDev', card: 'road' };
        if (g.dev[s].includes('plenty')) {
          const goal = h.minerai >= 1 && h.ble >= 1 ? COST.city : COST.settlement;
          const miss = RES.filter((r) => (goal[r] || 0) > h[r]);
          if (miss.length) return { type: 'playDev', card: 'plenty', res: miss[0], res2: miss[1] || miss[0] };
        }
        if (g.dev[s].includes('knight') && HEXES[g.robber].verts.some((v) => g.vOwner[v] === s)) return { type: 'playDev', card: 'knight' };
        if (g.dev[s].includes('knight') && g.army !== s && g.knights[s] >= 2) return { type: 'playDev', card: 'knight' };
      }
      if (L.city.length && has(h, COST.city)) return { type: 'build', kind: 'city', at: L.city.sort((a, b) => vScore(g, b, s) - vScore(g, a, s))[0] };
      if (L.settle.length && has(h, COST.settlement)) return { type: 'build', kind: 'settlement', at: L.settle.sort((a, b) => vScore(g, b, s) - vScore(g, a, s))[0] };
      if (!L.settle.length && L.road.length && has(h, COST.road) && g.pieces[s].road > 0) return { type: 'build', kind: 'road', at: bestRoadToward(g, s, L.road) };
      if (has(h, COST.dev) && g.devDeck.length && !(L.city.length && h.minerai < 3 && h.ble >= 2) && Math.random() < 0.7) return { type: 'buyDev' };
      // échange avec la banque vers l'objectif
      const goal = L.city.length && (h.minerai >= 2 || h.ble >= 2) ? COST.city : L.settle.length ? COST.settlement : COST.road;
      const miss = RES.filter((r) => (goal[r] || 0) > h[r]);
      if (miss.length) {
        for (const r of RES) {
          const rate = tradeRate(g, s, r);
          if (h[r] - (goal[r] || 0) >= rate && g.bank[miss[0]] > 0) return { type: 'bankTrade', give: r, get: miss[0] };
        }
      }
      return { type: 'endTurn' };
    }
    return null;
  }
  function fallback(g, s) {
    if (g.offer && g.offer.from !== s) return { type: 'declineOffer' };
    if (g.phase === 'main' && s === g.turn) return { type: 'endTurn' };
    if (g.phase === 'roadbuild') return { type: 'endRoads' };
    return bot(g, s);
  }

  const module = {
    id: 'archipel', minPlayers: 3, maxPlayers: 4,
    defaultSettings: { vp: 10 },
    settingsUI: [{ key: 'vp', label: 'Points pour gagner', options: [{ value: 8, label: '8 points (partie courte)' }, { value: 10, label: '10 points (classique)' }, { value: 12, label: '12 points (partie longue)' }] }],
    create, apply, view, waiting, bot, fallback, isOver, tick: () => null,
    spyView: (g) => { const v = view(g, null); v.spy = true; v.spyHands = g.hand.map((h) => ({ ...h })); v.spyDev = g.names.map((_, s) => g.dev[s].concat(g.devNew[s])); v.vp = g.names.map((_, s) => vp(g, s, true)); return v; },
    botDelay: (g) => (g.phase === 'setup' ? 900 : g.phase === 'main' ? 750 : 900),
  };
  root.ArchipelEngine = { module, HEXES, VERTS, EDGES, RES, RES_NAME, TERRAIN, TERRAIN_NAME, COST, DEV_NAME, PIPS };
})(typeof window !== 'undefined' ? window : globalThis);
