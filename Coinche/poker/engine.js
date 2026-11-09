/* ============================================================
   Poker Texas Hold'em sans limite — moteur (2 à 8 joueurs)
   Cartes : 'AS', 'TD', '9H'… (rang + couleur)
   ============================================================ */
(function (root) {
  'use strict';
  const Net = root.SalleNet;
  const randInt = (n) => (Net ? Net.randInt(n) : Math.floor(Math.random() * n));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const RANKS = '23456789TJQKA';
  const SUITS = 'SHDC';
  const rv = (c) => RANKS.indexOf(c[0]) + 2;
  const CAT = ['Carte haute', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush'];
  const BLINDS = [[10, 20], [15, 30], [25, 50], [40, 80], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400], [300, 600], [400, 800], [500, 1000], [750, 1500], [1000, 2000], [1500, 3000], [2000, 4000]];

  function deck() { const d = []; for (const s of SUITS) for (const r of RANKS) d.push(r + s); return d; }

  // ---- Évaluation d'une main de 5 cartes → score comparable ----
  function eval5(cs) {
    const r = cs.map(rv).sort((a, b) => b - a);
    const flush = cs.every((c) => c[1] === cs[0][1]);
    const uniq = [...new Set(r)];
    let straightHi = 0;
    if (uniq.length === 5) {
      if (r[0] - r[4] === 4) straightHi = r[0];
      else if (r[0] === 14 && r[1] === 5) straightHi = 5; // roue A-2-3-4-5
    }
    const cnt = {};
    r.forEach((x) => { cnt[x] = (cnt[x] || 0) + 1; });
    const groups = Object.entries(cnt).map(([k, v]) => [v, Number(k)]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    let cat, kick;
    if (straightHi && flush) { cat = 8; kick = [straightHi]; }
    else if (groups[0][0] === 4) { cat = 7; kick = [groups[0][1], groups[1][1]]; }
    else if (groups[0][0] === 3 && groups[1][0] === 2) { cat = 6; kick = [groups[0][1], groups[1][1]]; }
    else if (flush) { cat = 5; kick = r; }
    else if (straightHi) { cat = 4; kick = [straightHi]; }
    else if (groups[0][0] === 3) { cat = 3; kick = groups.map((g) => g[1]); }
    else if (groups[0][0] === 2 && groups[1][0] === 2) { cat = 2; kick = groups.map((g) => g[1]); }
    else if (groups[0][0] === 2) { cat = 1; kick = groups.map((g) => g[1]); }
    else { cat = 0; kick = r; }
    let score = cat;
    for (let i = 0; i < 5; i++) score = score * 15 + (kick[i] || 0);
    return { score, cat, kick };
  }
  function best7(cards) {
    let best = null;
    const n = cards.length, pick = [];
    (function rec(st) {
      if (pick.length === 5) { const five = pick.map((i) => cards[i]); const e = eval5(five); if (!best || e.score > best.score) best = { ...e, cards: five }; return; }
      for (let i = st; i < n; i++) { pick.push(i); rec(i + 1); pick.pop(); }
    })(0);
    return best;
  }
  const ONE = { 14: 'As', 13: 'Roi', 12: 'Dame', 11: 'Valet' };
  const MANY = { 14: 'As', 13: 'Rois', 12: 'Dames', 11: 'Valets' };
  const one = (r) => ONE[r] || String(r);
  const many = (r) => MANY[r] || String(r);
  const de = (r) => (r === 14 ? "d'As" : 'de ' + many(r));
  function handName(e) {
    const k = e.kick;
    switch (e.cat) {
      case 8: return k[0] === 14 ? 'Quinte flush royale' : 'Quinte flush hauteur ' + one(k[0]);
      case 7: return 'Carré ' + de(k[0]);
      case 6: return 'Full aux ' + many(k[0]) + ' par les ' + many(k[1]);
      case 5: return 'Couleur hauteur ' + one(k[0]);
      case 4: return 'Quinte hauteur ' + one(k[0]);
      case 3: return 'Brelan ' + de(k[0]);
      case 2: return 'Double paire ' + many(k[0]) + ' et ' + many(k[1]);
      case 1: return 'Paire ' + de(k[0]);
      default: return 'Hauteur ' + one(k[0]);
    }
  }

  // ------------------------------------------------------------------
  function create({ settings, names, n }) {
    const g = {
      n, names, settings: { ...settings },
      stacks: new Array(n).fill(Number(settings.chips) || 1000),
      out: new Array(n).fill(false), outOrder: [],
      dealer: randInt(n), hand: 0, level: 0, phase: 'idle', winner: null, lastHand: null, log: [],
    };
    const ev = newHand(g, true);
    return { state: g, events: ev };
  }
  const alive = (g) => g.names.map((_, i) => i).filter((i) => !g.out[i]);
  function nextAlive(g, s) { for (let k = 1; k <= g.n; k++) { const x = (s + k) % g.n; if (!g.out[x]) return x; } return s; }

  function newHand(g, first) {
    g.hand++;
    const every = Number(g.settings.every) || 0;
    if (every) g.level = Math.min(BLINDS.length - 1, Math.floor((g.hand - 1) / every));
    if (!first) g.dealer = nextAlive(g, g.dealer);
    else if (g.out[g.dealer]) g.dealer = nextAlive(g, g.dealer);
    const [sb, bb] = BLINDS[g.level];
    g.sb = sb; g.bb = bb;
    const d = shuffle(deck());
    g.deck = d;
    g.holes = g.names.map(() => null);
    const live = alive(g);
    for (const s of live) g.holes[s] = [d.pop(), d.pop()];
    g.board = [];
    g.bet = new Array(g.n).fill(0); g.total = new Array(g.n).fill(0);
    g.folded = g.names.map((_, i) => g.out[i]); g.allin = new Array(g.n).fill(false);
    g.lastAction = new Array(g.n).fill(null);
    g.showdown = null; g.result = null; g.revealed = new Array(g.n).fill(false);
    const heads = live.length === 2;
    const sbSeat = heads ? g.dealer : nextAlive(g, g.dealer);
    const bbSeat = nextAlive(g, sbSeat);
    g.sbSeat = sbSeat; g.bbSeat = bbSeat;
    post(g, sbSeat, sb); post(g, bbSeat, bb);
    g.lastAction[sbSeat] = { t: 'sb', v: g.bet[sbSeat] }; g.lastAction[bbSeat] = { t: 'bb', v: g.bet[bbSeat] };
    g.currentBet = Math.max(g.bet[sbSeat], g.bet[bbSeat]);
    g.minRaise = bb;
    g.street = 0; g.phase = 'betting';
    g.needAct = new Set(live.filter((s) => !g.allin[s]));
    g.toAct = nextToAct(g, bbSeat);
    const ev = [{ type: 'deal', hand: g.hand }];
    checkRoundEnd(g, ev);
    return ev;
  }
  function post(g, s, amt) {
    const a = Math.min(amt, g.stacks[s]);
    g.stacks[s] -= a; g.bet[s] += a; g.total[s] += a;
    if (g.stacks[s] === 0) g.allin[s] = true;
  }
  function nextToAct(g, from) {
    for (let k = 1; k <= g.n; k++) { const x = (from + k) % g.n; if (g.needAct.has(x) && !g.folded[x] && !g.allin[x]) return x; }
    return null;
  }
  const inHand = (g) => g.names.map((_, i) => i).filter((i) => !g.folded[i]);

  function options(g, s) {
    if (g.phase !== 'betting' || g.toAct !== s) return null;
    const toCall = Math.min(g.currentBet - g.bet[s], g.stacks[s]);
    const maxTo = g.bet[s] + g.stacks[s];
    const minTo = Math.min(maxTo, g.currentBet === 0 ? g.bb : g.currentBet + g.minRaise);
    const othersCanAct = inHand(g).some((x) => x !== s && !g.allin[x]);
    return { toCall, canCheck: toCall === 0, minTo, maxTo, canRaise: maxTo > g.currentBet && (othersCanAct || false), bet: g.bet[s], stack: g.stacks[s], currentBet: g.currentBet };
  }

  function apply(g, s, a) {
    if (a.type === 'next') { return { error: 'Pas maintenant.' }; }
    const o = options(g, s);
    if (!o) return { error: 'Ce n\'est pas à toi de parler.' };
    const ev = [];
    if (a.type === 'fold') {
      g.folded[s] = true; g.lastAction[s] = { t: 'fold' };
      ev.push({ type: 'act', seat: s, t: 'fold' });
    } else if (a.type === 'check') {
      if (!o.canCheck) return { error: 'Tu dois suivre ou te coucher.' };
      g.lastAction[s] = { t: 'check' };
      ev.push({ type: 'act', seat: s, t: 'check' });
    } else if (a.type === 'call') {
      if (o.canCheck) return { error: 'Rien à suivre : parole.' };
      post(g, s, o.toCall);
      g.lastAction[s] = { t: g.allin[s] ? 'allin' : 'call', v: g.bet[s] };
      ev.push({ type: 'act', seat: s, t: 'call', v: o.toCall, chip: true });
    } else if (a.type === 'raise') {
      let to = Math.floor(Number(a.to));
      if (!o.canRaise) return { error: 'Relance impossible.' };
      if (!(to > 0)) return { error: 'Montant invalide.' };
      to = Math.min(to, o.maxTo);
      if (to <= g.currentBet) { if (o.canCheck) return { error: 'Montant invalide.' }; return apply(g, s, { type: 'call' }); }
      if (to < o.minTo && to !== o.maxTo) return { error: 'Relance minimum : ' + o.minTo + '.' };
      const inc = to - g.currentBet;
      post(g, s, to - g.bet[s]);
      if (inc >= g.minRaise) g.minRaise = inc;
      const wasBet = g.currentBet === 0;
      g.currentBet = Math.max(g.currentBet, g.bet[s]);
      g.needAct = new Set(inHand(g).filter((x) => x !== s && !g.allin[x]));
      g.lastAction[s] = { t: g.allin[s] ? 'allin' : wasBet ? 'bet' : 'raise', v: g.bet[s] };
      ev.push({ type: 'act', seat: s, t: g.lastAction[s].t, v: g.bet[s], chip: true });
    } else return { error: 'Action inconnue.' };
    g.needAct.delete(s);
    g.toAct = nextToAct(g, s);
    checkRoundEnd(g, ev);
    return { events: ev };
  }

  function checkRoundEnd(g, ev) {
    const live = inHand(g);
    if (live.length === 1) { award(g, ev, true); return; }
    const pending = [...g.needAct].filter((x) => !g.folded[x] && !g.allin[x]);
    if (g.toAct != null && pending.length) return;
    // fin du tour d'enchères
    const canAct = live.filter((x) => !g.allin[x]);
    if (g.street === 3 || canAct.length <= 1) {
      // plus d'action possible : on déroule le tableau
      if (g.street < 3 && canAct.length <= 1) {
        for (const x of live) g.revealed[x] = true;
        g.phase = 'runout';
        g.toAct = null;
        ev.push({ type: 'runout' });
        return;
      }
      award(g, ev, false);
      return;
    }
    nextStreet(g, ev);
  }
  function nextStreet(g, ev) {
    g.street++;
    for (let i = 0; i < g.n; i++) { g.bet[i] = 0; if (g.lastAction[i] && g.lastAction[i].t !== 'fold' && g.lastAction[i].t !== 'allin') g.lastAction[i] = null; }
    g.currentBet = 0; g.minRaise = g.bb;
    if (g.street === 1) g.board.push(g.deck.pop(), g.deck.pop(), g.deck.pop());
    else g.board.push(g.deck.pop());
    ev.push({ type: 'street', street: g.street });
    g.needAct = new Set(inHand(g).filter((x) => !g.allin[x]));
    g.toAct = nextToAct(g, g.dealer);
    if (g.needAct.size <= 1 && inHand(g).filter((x) => !g.allin[x]).length <= 1) { g.needAct.clear(); g.toAct = null; checkRoundEnd(g, ev); return; }
  }

  function award(g, ev, uncontested) {
    const live = inHand(g);
    for (let i = 0; i < g.n; i++) g.bet[i] = 0;
    const res = { pots: [], uncontested, hands: {} };
    if (uncontested) {
      const w = live[0];
      const amt = g.total.reduce((a, b) => a + b, 0);
      g.stacks[w] += amt;
      res.pots.push({ amount: amt, winners: [w], shares: [amt] });
    } else {
      while (g.board.length < 5) g.board.push(g.deck.pop());
      for (const s of live) { const e = best7(g.holes[s].concat(g.board)); res.hands[s] = { score: e.score, name: handName(e), cards: e.cards }; g.revealed[s] = true; }
      const levels = [...new Set(live.map((s) => g.total[s]))].sort((a, b) => a - b);
      let prev = 0;
      const pots = [];
      levels.forEach((L, li) => {
        let amount = 0;
        for (let i = 0; i < g.n; i++) amount += Math.max(0, Math.min(g.total[i], L) - prev);
        if (li === levels.length - 1) for (let i = 0; i < g.n; i++) amount += Math.max(0, g.total[i] - L);
        const elig = live.filter((s) => g.total[s] >= L);
        if (amount > 0) pots.push({ amount, elig });
        prev = L;
      });
      for (const p of pots) {
        const best = Math.max(...p.elig.map((s) => res.hands[s].score));
        const winners = p.elig.filter((s) => res.hands[s].score === best);
        const share = Math.floor(p.amount / winners.length);
        let rest = p.amount - share * winners.length;
        const order = []; for (let k = 1; k <= g.n; k++) { const x = (g.dealer + k) % g.n; if (winners.includes(x)) order.push(x); }
        const shares = order.map(() => share);
        for (let k = 0; rest > 0; k = (k + 1) % shares.length, rest--) shares[k]++;
        order.forEach((w, k) => { g.stacks[w] += shares[k]; });
        res.pots.push({ amount: p.amount, winners: order, shares });
      }
    }
    g.result = res;
    g.phase = 'handEnd';
    g.toAct = null;
    // éliminations
    for (let i = 0; i < g.n; i++) if (!g.out[i] && g.stacks[i] === 0) { g.out[i] = true; g.outOrder.push(i); ev.push({ type: 'bust', seat: i }); }
    const left = alive(g);
    g.lastHand = { hand: g.hand, result: res, board: g.board.slice() };
    ev.push({ type: 'handend' });
    if (left.length <= 1) { g.phase = 'gameEnd'; g.winner = left[0]; }
  }

  function tick(g) {
    if (g.phase === 'runout') return { ms: 1300, run: (st) => { const ev = []; if (st.street < 3) { nextStreetSilent(st, ev); if (st.street >= 3) { st.phase = 'betting'; award(st, ev, false); } } return ev; } };
    if (g.phase === 'handEnd') return { ms: g.result && g.result.uncontested ? 2600 : 5200, run: (st) => newHand(st, false) };
    return null;
  }
  function nextStreetSilent(g, ev) {
    g.street++;
    for (let i = 0; i < g.n; i++) g.bet[i] = 0;
    if (g.street === 1) g.board.push(g.deck.pop(), g.deck.pop(), g.deck.pop()); else g.board.push(g.deck.pop());
    ev.push({ type: 'street', street: g.street });
  }

  function waiting(g) { return g.phase === 'betting' && g.toAct != null ? [g.toAct] : []; }
  function isOver(g) { return g.phase === 'gameEnd'; }

  function view(g, seat) {
    const me = seat != null && seat < g.n ? seat : null;
    const showAll = g.phase === 'handEnd' || g.phase === 'gameEnd' || g.phase === 'runout';
    return {
      n: g.n, names: g.names, stacks: g.stacks, out: g.out, outOrder: g.outOrder, dealer: g.dealer, sbSeat: g.sbSeat, bbSeat: g.bbSeat,
      hand: g.hand, level: g.level, sb: g.sb, bb: g.bb, every: Number(g.settings.every) || 0, nextBlinds: BLINDS[Math.min(BLINDS.length - 1, g.level + 1)],
      phase: g.phase, street: g.street, board: g.board, bet: g.bet, total: g.total, folded: g.folded, allin: g.allin, lastAction: g.lastAction,
      pot: g.total.reduce((a, b) => a + b, 0), toAct: g.toAct, currentBet: g.currentBet,
      holes: g.names.map((_, i) => (i === me || (showAll && g.revealed[i] && !g.folded[i]) ? g.holes[i] : null)),
      hasCards: g.names.map((_, i) => !!g.holes[i] && !g.folded[i]),
      result: g.phase === 'handEnd' || g.phase === 'gameEnd' ? g.result : null,
      winner: g.winner, waiting: waiting(g), mine: me,
      options: me != null ? options(g, me) : null,
      myHand: me != null && g.holes[me] && g.board.length >= 3 ? handName(best7(g.holes[me].concat(g.board))) : null,
    };
  }

  // ------------------------------------------------------------------
  // Robots
  function preflopScore(h) {
    const a = rv(h[0]), b = rv(h[1]);
    const hi = Math.max(a, b), lo = Math.min(a, b);
    const val = (r) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2);
    let s = val(hi);
    if (a === b) s = Math.max(5, s * 2);
    if (h[0][1] === h[1][1]) s += 2;
    const gap = hi - lo - 1;
    if (a !== b) s -= gap <= 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
    if (a !== b && gap <= 1 && hi < 12) s += 1;
    return s;
  }
  function equity(g, s, sims) {
    const known = new Set(g.holes[s].concat(g.board));
    const rest = deck().filter((c) => !known.has(c));
    const opp = inHand(g).length - 1;
    let win = 0;
    for (let k = 0; k < sims; k++) {
      const d = rest.slice();
      for (let i = d.length - 1; i > d.length - 1 - (5 - g.board.length) - opp * 2 && i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
      let p = d.length;
      const board = g.board.concat(d.slice(p - (5 - g.board.length))); p -= 5 - g.board.length;
      const mine = best7(g.holes[s].concat(board)).score;
      let best = true, tie = 0;
      for (let o = 0; o < opp; o++) {
        const oh = [d[p - 1], d[p - 2]]; p -= 2;
        const os = best7(oh.concat(board)).score;
        if (os > mine) { best = false; break; }
        if (os === mine) tie++;
      }
      if (best) win += tie ? 1 / (tie + 1) : 1;
    }
    return win / sims;
  }
  function bot(g, s) {
    const o = options(g, s);
    if (!o) return null;
    const pot = g.total.reduce((a, b) => a + b, 0);
    const r = Math.random();
    const raiseTo = (amt) => ({ type: 'raise', to: Math.max(o.minTo, Math.min(o.maxTo, Math.round(amt / g.bb) * g.bb || o.minTo)) });
    if (g.street === 0) {
      const sc = preflopScore(g.holes[s]);
      const facing = o.toCall / g.bb;
      if (sc >= 10 && o.canRaise) return r < 0.25 && facing > 3 ? { type: 'call' } : raiseTo(Math.max(o.currentBet * 3, g.bb * 3));
      if (sc >= 7.5) { if (o.canCheck) return o.canRaise && r < 0.35 ? raiseTo(g.bb * 3) : { type: 'check' }; return facing <= 6 || o.toCall <= o.stack * 0.15 ? { type: 'call' } : { type: 'fold' }; }
      if (sc >= 5.5) { if (o.canCheck) return { type: 'check' }; return facing <= 2.5 ? { type: 'call' } : { type: 'fold' }; }
      if (o.canCheck) return r < 0.08 && o.canRaise ? raiseTo(g.bb * 3) : { type: 'check' };
      return o.toCall <= g.bb && r < 0.3 ? { type: 'call' } : { type: 'fold' };
    }
    const eq = equity(g, s, 160);
    const odds = o.toCall / (pot + o.toCall);
    if (eq > 0.72 && o.canRaise) return r < 0.3 && !o.canCheck ? { type: 'call' } : raiseTo(o.currentBet + pot * (0.5 + Math.random() * 0.4));
    if (o.canCheck) {
      if (eq > 0.55 && o.canRaise && r < 0.55) return raiseTo(pot * 0.5);
      if (eq < 0.3 && o.canRaise && r < 0.07) return raiseTo(pot * 0.6);
      return { type: 'check' };
    }
    if (eq > odds + 0.04 || o.toCall <= g.bb && eq > 0.2) return { type: 'call' };
    return { type: 'fold' };
  }
  function fallback(g, s) { const o = options(g, s); return o ? (o.canCheck ? { type: 'check' } : { type: 'fold' }) : null; }

  const module = {
    id: 'poker', minPlayers: 2, maxPlayers: 8,
    defaultSettings: { chips: 1000, every: 10 },
    settingsUI: [
      { key: 'chips', label: 'Jetons de départ', options: [{ value: 500, label: '500' }, { value: 1000, label: '1 000' }, { value: 2000, label: '2 000' }, { value: 5000, label: '5 000' }] },
      { key: 'every', label: 'Les blindes montent', options: [{ value: 6, label: 'toutes les 6 mains' }, { value: 10, label: 'toutes les 10 mains' }, { value: 15, label: 'toutes les 15 mains' }, { value: 0, label: 'jamais' }] },
    ],
    create, apply, view, waiting, tick, bot, fallback, isOver,
    botDelay: () => 1100,
  };
  root.PokerEngine = { module, best7, eval5, handName, deck, BLINDS, CAT };
})(typeof window !== 'undefined' ? window : globalThis);
