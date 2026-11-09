/* ============================================================
   Tarot — moteur de règles (règles FFT) pour 3, 4 ou 5 joueurs
   Cartes : 'S01'..'S14' (pique), H, D, C ; 'T01'..'T21' atouts ; 'EX' excuse
   Points comptés en demi-points (×2) pour rester en entiers.
   ============================================================ */
(function (root) {
  'use strict';
  const Net = root.SalleNet;
  const randInt = (n) => (Net ? Net.randInt(n) : Math.floor(Math.random() * n));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const SUITS = ['S', 'H', 'D', 'C'];
  const SUIT_NAME = { S: 'Pique', H: 'Cœur', D: 'Carreau', C: 'Trèfle', T: 'Atout' };
  const SUIT_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const RANK_NAME = { 11: 'Valet', 12: 'Cavalier', 13: 'Dame', 14: 'Roi' };
  const LEVELS = [null, 'Prise', 'Garde', 'Garde sans', 'Garde contre'];
  const MULT = [0, 1, 2, 4, 6];
  const REQUIRED = [56, 51, 41, 36];
  const POIGNEE = { 3: [13, 15, 18], 4: [10, 13, 15], 5: [8, 10, 13] };
  const POIGNEE_BONUS = [0, 20, 30, 40];
  const POIGNEE_NAME = [null, 'Poignée simple', 'Poignée double', 'Poignée triple'];
  const HAND = { 3: 24, 4: 18, 5: 15 };
  const CHIEN = { 3: 6, 4: 6, 5: 3 };

  const suitOf = (c) => (c === 'EX' ? 'EX' : c[0]);
  const rankOf = (c) => (c === 'EX' ? 0 : Number(c.slice(1)));
  const isTrump = (c) => c[0] === 'T';
  const isOudler = (c) => c === 'EX' || c === 'T01' || c === 'T21';
  function halfPoints(c) {
    if (isOudler(c)) return 9;
    if (isTrump(c)) return 1;
    const r = rankOf(c);
    return r === 14 ? 9 : r === 13 ? 7 : r === 12 ? 5 : r === 11 ? 3 : 1;
  }
  function cardLabel(c) {
    if (c === 'EX') return 'Excuse';
    if (isTrump(c)) return rankOf(c) + ' d\'atout';
    const r = rankOf(c);
    return (RANK_NAME[r] || r) + ' de ' + SUIT_NAME[c[0]].toLowerCase();
  }
  function deck() {
    const d = [];
    for (const s of SUITS) for (let r = 1; r <= 14; r++) d.push(s + String(r).padStart(2, '0'));
    for (let r = 1; r <= 21; r++) d.push('T' + String(r).padStart(2, '0'));
    d.push('EX');
    return d;
  }

  function leadSuit(trick) { const f = trick.find((t) => t.card !== 'EX'); return f ? suitOf(f.card) : null; }
  function winnerIndex(trick) {
    const lead = leadSuit(trick);
    if (!lead) return 0;
    let best = -1, bestV = -1;
    trick.forEach((t, i) => {
      if (t.card === 'EX') return;
      const s = suitOf(t.card);
      const v = s === 'T' ? 100 + rankOf(t.card) : s === lead ? rankOf(t.card) : -1;
      if (v > bestV) { bestV = v; best = i; }
    });
    return best;
  }
  function legalCards(hand, trick) {
    if (!trick.length) return hand.slice();
    const lead = leadSuit(trick);
    const hasEx = hand.includes('EX');
    if (!lead) return hand.slice();
    const plain = hand.filter((c) => c !== 'EX');
    const trumps = plain.filter(isTrump);
    const maxT = Math.max(0, ...trick.filter((t) => isTrump(t.card)).map((t) => rankOf(t.card)));
    let res;
    if (lead === 'T') {
      if (trumps.length) { const hi = trumps.filter((c) => rankOf(c) > maxT); res = hi.length ? hi : trumps; }
      else res = plain;
    } else {
      const follow = plain.filter((c) => suitOf(c) === lead);
      if (follow.length) res = follow;
      else if (trumps.length) { const hi = trumps.filter((c) => rankOf(c) > maxT); res = hi.length ? hi : trumps; }
      else res = plain;
    }
    if (hasEx) res = res.concat(['EX']);
    return res;
  }

  // ------------------------------------------------------------------
  function create({ settings, names, n, prev }) {
    const g = {
      n, names, settings: { ...settings }, scores: new Array(n).fill(0), history: [],
      dealer: randInt(n), deal: 0, played: 0, totalDeals: (Number(settings.tours) || 2) * n, phase: 'idle', winner: null,
    };
    const events = newDeal(g, true);
    return { state: g, events };
  }

  function newDeal(g, first) {
    if (!first) g.dealer = (g.dealer + 1) % g.n;
    g.deal = (g.played || 0) + 1;
    const n = g.n;
    let d = shuffle(deck());
    g.hands = [];
    for (let s = 0; s < n; s++) g.hands.push(d.slice(s * HAND[n], (s + 1) * HAND[n]));
    g.chien = d.slice(n * HAND[n]);
    Object.assign(g, {
      bids: [], bidTurn: (g.dealer + 1) % n, contract: null, called: null, partner: null, partnerRevealed: false,
      ecart: [], ecartTrumps: [], trick: [], leader: null, turn: null, trickDone: false, trickWinner: null,
      tricks: [], poignees: [], playedOnce: new Array(n).fill(false), chelem: false, ready: [], lastDeal: null,
      phaseUntil: 0, info: null,
    });
    g.phase = 'bidding';
    const ev = [{ type: 'deal' }];
    // Petit sec : on redistribue
    for (let s = 0; s < n; s++) {
      const tr = g.hands[s].filter(isTrump);
      if (tr.length === 1 && tr[0] === 'T01' && !g.hands[s].includes('EX')) {
        g.phase = 'redeal'; g.info = 'Petit sec chez ' + g.names[s] + ' — on redistribue';
        ev.push({ type: 'info', text: g.info });
        break;
      }
    }
    return ev;
  }

  function campOf(g, seat) {
    if (!g.contract) return null;
    if (seat === g.contract.seat) return 'A';
    if (g.partner != null && seat === g.partner) return 'A';
    return 'D';
  }

  function canEcart(g, cards) {
    const need = g.chien.length;
    const hand = g.hands[g.contract.seat];
    if (!Array.isArray(cards) || cards.length !== need || new Set(cards).size !== need) return 'Choisis exactement ' + need + ' cartes.';
    if (cards.some((c) => !hand.includes(c))) return 'Carte inconnue.';
    if (cards.some((c) => isOudler(c) || (!isTrump(c) && rankOf(c) === 14))) return 'Interdit d\'écarter un roi ou un bout.';
    const plain = hand.filter((c) => !isTrump(c) && c !== 'EX' && rankOf(c) !== 14);
    const trumpsIn = cards.filter(isTrump);
    if (trumpsIn.length && plain.length >= need) return 'Tu ne peux écarter d\'atout que si tu n\'as pas d\'autre choix.';
    if (trumpsIn.length && cards.filter((c) => !isTrump(c)).length < plain.length) return 'Écarte d\'abord toutes tes autres cartes possibles avant un atout.';
    return null;
  }

  function startPlay(g, ev) {
    g.phase = 'playing';
    g.turn = g.chelem ? g.contract.seat : (g.dealer + 1) % g.n;
    g.leader = g.turn;
    ev.push({ type: 'play-start' });
  }

  function apply(g, seat, a) {
    const ev = [];
    const n = g.n;
    switch (a.type) {
      case 'bid': {
        if (g.phase !== 'bidding' || g.bidTurn !== seat) return { error: 'Ce n\'est pas à toi de parler.' };
        const lvl = Number(a.level) || 0;
        const best = g.contract ? g.contract.level : 0;
        if (lvl && (lvl < 1 || lvl > 4 || lvl <= best)) return { error: 'Il faut annoncer plus haut que ' + LEVELS[best] + '.' };
        g.bids.push({ seat, level: lvl });
        if (lvl) g.contract = { seat, level: lvl };
        ev.push({ type: 'bid', seat, level: lvl });
        if (g.bids.length === n || lvl === 4) {
          if (!g.contract) { g.phase = 'redeal'; g.info = 'Tout le monde passe — on redistribue'; ev.push({ type: 'info', text: g.info }); }
          else afterBidding(g, ev);
        } else g.bidTurn = (seat + 1) % n;
        return { events: ev };
      }
      case 'call': {
        if (g.phase !== 'call' || seat !== g.contract.seat) return { error: 'Pas maintenant.' };
        const opts = callOptions(g);
        if (!opts.includes(a.card)) return { error: 'Carte d\'appel invalide.' };
        g.called = a.card;
        g.partner = null;
        for (let s = 0; s < n; s++) if (g.hands[s].includes(a.card)) g.partner = s;
        ev.push({ type: 'call', seat, card: a.card });
        afterCall(g, ev);
        return { events: ev };
      }
      case 'ecart': {
        if (g.phase !== 'ecart' || seat !== g.contract.seat) return { error: 'Pas maintenant.' };
        const err = canEcart(g, a.cards);
        if (err) return { error: err };
        const hand = g.hands[seat];
        for (const c of a.cards) hand.splice(hand.indexOf(c), 1);
        g.ecart = a.cards.slice();
        g.ecartTrumps = a.cards.filter(isTrump);
        g.chelem = !!a.chelem;
        ev.push({ type: 'ecart', seat, trumps: g.ecartTrumps, chelem: g.chelem });
        startPlay(g, ev);
        return { events: ev };
      }
      case 'annonce': {
        if (g.phase !== 'annonce' || seat !== g.contract.seat) return { error: 'Pas maintenant.' };
        g.chelem = !!a.chelem;
        if (g.chelem) ev.push({ type: 'info', text: g.names[seat] + ' annonce le chelem !' });
        startPlay(g, ev);
        return { events: ev };
      }
      case 'poignee': {
        if (g.phase !== 'playing' || g.turn !== seat || g.playedOnce[seat] || g.trickDone) return { error: 'La poignée s\'annonce juste avant de jouer ta première carte.' };
        if (g.poignees.some((p) => p.seat === seat)) return { error: 'Déjà annoncée.' };
        const size = Number(a.size);
        const avail = poigneeOptions(g, seat);
        if (!avail.includes(size)) return { error: 'Pas assez d\'atouts pour cette poignée.' };
        const need = POIGNEE[n][size - 1];
        const trumps = g.hands[seat].filter(isTrump).sort((x, y) => rankOf(x) - rankOf(y));
        const shown = trumps.length >= need ? trumps.slice(0, need) : trumps.concat(['EX']);
        g.poignees.push({ seat, size, cards: shown });
        ev.push({ type: 'poignee', seat, size, cards: shown });
        return { events: ev };
      }
      case 'play': {
        if (g.phase !== 'playing' || g.trickDone || g.turn !== seat) return { error: 'Ce n\'est pas ton tour.' };
        const hand = g.hands[seat];
        if (!hand.includes(a.card)) return { error: 'Tu n\'as pas cette carte.' };
        if (!legalCards(hand, g.trick).includes(a.card)) return { error: explainIllegal(hand, g.trick) };
        hand.splice(hand.indexOf(a.card), 1);
        g.trick.push({ seat, card: a.card });
        g.playedOnce[seat] = true;
        ev.push({ type: 'play', seat, card: a.card });
        if (g.called && a.card === g.called && !g.partnerRevealed) {
          g.partnerRevealed = true;
          ev.push({ type: 'info', text: seat === g.contract.seat ? g.names[seat] + ' joue seul !' : g.names[seat] + ' est le partenaire de ' + g.names[g.contract.seat] + ' !' });
        }
        if (g.trick.length === n) {
          let wi = winnerIndex(g.trick);
          const last = g.tricks.length === HAND[n] - 1;
          const exI = g.trick.findIndex((t) => t.card === 'EX');
          if (last && exI >= 0) {
            const exCamp = campOf(g, g.trick[exI].seat);
            if (g.tricks.every((t) => campOf(g, t.winner) === exCamp)) wi = exI; // chelem : l'excuse gagne le dernier pli
          }
          g.trickWinner = g.trick[wi].seat;
          g.trickDone = true;
          g.turn = null;
          ev.push({ type: 'trickwin', seat: g.trickWinner });
        } else g.turn = (seat + 1) % n;
        return { events: ev };
      }
      case 'ready': {
        if (g.phase !== 'dealEnd') return { error: 'Pas maintenant.' };
        if (!g.ready.includes(seat)) g.ready.push(seat);
        if (g.ready.length === n) ev.push(...newDeal(g, false));
        return { events: ev };
      }
    }
    return { error: 'Action inconnue.' };
  }

  function explainIllegal(hand, trick) {
    const lead = leadSuit(trick);
    if (lead === 'T') return 'À l\'atout, il faut fournir et monter si tu peux.';
    if (hand.some((c) => suitOf(c) === lead)) return 'Il faut fournir à ' + SUIT_NAME[lead].toLowerCase() + '.';
    if (hand.some(isTrump)) return 'Tu dois couper (et surcouper si tu peux).';
    return 'Carte interdite.';
  }

  function callOptions(g) {
    const hand = g.hands[g.contract.seat];
    for (const r of [14, 13, 12, 11]) {
      const all = SUITS.map((s) => s + r);
      if (!all.every((c) => hand.includes(c))) return all;
    }
    return SUITS.map((s) => s + '14');
  }
  function poigneeOptions(g, seat) {
    const hand = g.hands[seat];
    const t = hand.filter(isTrump).length + (hand.includes('EX') ? 1 : 0);
    return [1, 2, 3].filter((k) => t >= POIGNEE[g.n][k - 1]);
  }

  function afterBidding(g, ev) {
    ev.push({ type: 'contract', seat: g.contract.seat, level: g.contract.level });
    if (g.n === 5) { g.phase = 'call'; return; }
    afterCall(g, ev);
  }
  function afterCall(g, ev) {
    const lvl = g.contract.level;
    if (lvl <= 2) { g.phase = 'chien'; g.phaseUntil = 1; }
    else {
      g.ecart = g.chien.slice(); // garde sans : au preneur ; garde contre : à la défense (voir décompte)
      g.phase = 'annonce';
    }
  }

  function tick(g) {
    if (g.phase === 'redeal') return { ms: 2400, run: (s) => newDeal(s, false) };
    if (g.phase === 'chien') return { ms: 3600, run: (s) => { s.hands[s.contract.seat].push(...s.chien); s.phase = 'ecart'; return [{ type: 'chien-taken' }]; } };
    if (g.phase === 'playing' && g.trickDone) return { ms: 1500, run: collect };
    return null;
  }

  function collect(g) {
    const ev = [];
    g.tricks.push({ cards: g.trick.slice(), winner: g.trickWinner, leader: g.trick[0].seat });
    const w = g.trickWinner;
    g.trick = []; g.trickDone = false; g.trickWinner = null;
    if (g.tricks.length === HAND[g.n]) { score(g); ev.push({ type: 'dealend' }); }
    else { g.turn = w; g.leader = w; }
    return ev;
  }

  function score(g) {
    const n = g.n, c = g.contract, last = g.tricks.length - 1;
    const camp = (s) => campOf(g, s);
    const pile = { A: [], D: [] };
    let exchange = null;
    g.tricks.forEach((t, i) => {
      const wc = camp(t.winner);
      for (const x of t.cards) {
        if (x.card === 'EX') {
          const oc = camp(x.seat);
          if (i === last && t.winner !== x.seat) { pile[wc].push('EX'); }
          else { pile[oc].push('EX'); if (oc !== wc) exchange = { from: oc, to: wc }; }
        } else pile[wc].push(x.card);
      }
    });
    if (c.level <= 3) pile.A.push(...g.ecart); else pile.D.push(...g.ecart);
    let half = { A: pile.A.reduce((s, x) => s + halfPoints(x), 0), D: pile.D.reduce((s, x) => s + halfPoints(x), 0) };
    if (exchange) { half[exchange.from] -= 1; half[exchange.to] += 1; }
    const oudlers = pile.A.filter(isOudler).length;
    const req = REQUIRED[oudlers];
    const made = half.A >= req * 2;
    const diff = Math.round(Math.abs(half.A - req * 2) / 2 + 1e-9);
    const mult = MULT[c.level];
    const base = (25 + diff) * mult;
    // Petit au bout
    const lt = g.tricks[last];
    let petit = 0, petitCamp = null;
    if (lt.cards.some((x) => x.card === 'T01')) { petitCamp = camp(lt.winner); petit = 10 * mult * (petitCamp === 'A' ? 1 : -1); }
    // Poignées
    const pBonus = g.poignees.reduce((s, p) => s + POIGNEE_BONUS[p.size], 0);
    // Chelem
    const aTricks = g.tricks.filter((t) => camp(t.winner) === 'A').length;
    let chelem = 0, chelemTxt = null;
    if (g.chelem) { chelem = aTricks === HAND[n] ? 400 : -200; chelemTxt = aTricks === HAND[n] ? 'Chelem annoncé réussi' : 'Chelem annoncé chuté'; }
    else if (aTricks === HAND[n]) { chelem = 200; chelemTxt = 'Chelem non annoncé'; }
    else if (aTricks === 0) { chelem = -200; chelemTxt = 'Chelem de la défense'; }
    const s = (made ? base : -base) + petit + (made ? pBonus : -pBonus) + chelem;
    const alone = g.partner == null || g.partner === c.seat;
    const delta = new Array(n).fill(0);
    for (let p = 0; p < n; p++) {
      if (p === c.seat) delta[p] = s * (n === 3 ? 2 : n === 4 ? 3 : alone ? 4 : 2);
      else if (camp(p) === 'A') delta[p] = s;
      else delta[p] = -s;
    }
    for (let p = 0; p < n; p++) g.scores[p] += delta[p];
    const res = {
      deal: g.deal, taker: c.seat, level: c.level, partner: g.partner, called: g.called, oudlers, required: req, points: half.A / 2, defense: half.D / 2,
      made, diff, mult, base, petit, petitCamp, poignees: g.poignees.map((p) => ({ seat: p.seat, size: p.size })), pBonus, chelem, chelemTxt,
      s, delta, scores: g.scores.slice(), ecart: c.level <= 2 ? g.ecart.slice() : null, chien: g.chien.slice(),
    };
    g.history.push(res);
    g.lastDeal = res;
    g.ready = [];
    g.played++;
    if (g.played >= g.totalDeals) {
      g.phase = 'gameEnd';
      const max = Math.max(...g.scores);
      g.winner = g.scores.indexOf(max);
    } else g.phase = 'dealEnd';
  }

  function waiting(g) {
    if (g.phase === 'bidding') return [g.bidTurn];
    if (['call', 'ecart', 'annonce'].includes(g.phase)) return [g.contract.seat];
    if (g.phase === 'playing' && !g.trickDone) return [g.turn];
    if (g.phase === 'dealEnd') { const r = []; for (let s = 0; s < g.n; s++) if (!g.ready.includes(s)) r.push(s); return r; }
    return [];
  }

  function view(g, seat) {
    const me = seat != null && seat >= 0 && seat < g.n ? seat : null;
    const v = {
      n: g.n, names: g.names, scores: g.scores, history: g.history, dealer: g.dealer, deal: g.deal, totalDeals: g.totalDeals,
      phase: g.phase, bids: g.bids, bidTurn: g.bidTurn, contract: g.contract, called: g.called,
      partner: g.partnerRevealed || g.phase === 'dealEnd' || g.phase === 'gameEnd' ? g.partner : null,
      partnerRevealed: g.partnerRevealed, chelem: g.chelem,
      trick: g.trick, turn: g.turn, trickDone: g.trickDone, trickWinner: g.trickWinner, leader: g.leader,
      lastTrick: g.tricks.length ? g.tricks[g.tricks.length - 1] : null, tricksPlayed: g.tricks.length,
      tricksBy: g.names.map((_, s) => g.tricks.filter((t) => t.winner === s).length),
      handCounts: g.hands.map((h) => h.length), chienCount: g.chien.length,
      chien: g.phase === 'chien' ? g.chien : null, ecartTrumps: g.ecartTrumps,
      poignees: g.poignees, lastDeal: g.lastDeal, ready: g.ready, winner: g.winner, info: g.info,
      handSize: HAND[g.n],
      waiting: g.phase === 'dealEnd' ? [] : waiting(g),
      hand: null, legal: null, callOptions: null, poigneeOptions: null, mine: me,
    };
    if (me != null) {
      v.hand = g.hands[me].slice();
      if (g.phase === 'playing' && g.turn === me && !g.trickDone) {
        v.legal = legalCards(g.hands[me], g.trick);
        if (!g.playedOnce[me] && !g.poignees.some((p) => p.seat === me)) v.poigneeOptions = poigneeOptions(g, me);
      }
      if (g.phase === 'call' && me === g.contract.seat) v.callOptions = callOptions(g);
      if (g.phase === 'ecart' && me === g.contract.seat) v.chienCards = g.chien.slice();
      if (g.phase === 'dealEnd' || g.phase === 'gameEnd') v.myCamp = campOf(g, me);
    }
    return v;
  }

  function isOver(g) { return g.phase === 'gameEnd'; }

  // ------------------------------------------------------------------
  // Robots
  function evalBid(hand, n) {
    const trumps = hand.filter(isTrump);
    let v = 0;
    if (hand.includes('T21')) v += 10;
    if (hand.includes('EX')) v += 8;
    if (hand.includes('T01')) v += trumps.length >= 6 ? 9 : 3;
    v += trumps.length * 2.5;
    v += trumps.filter((c) => rankOf(c) >= 16).length * 2;
    for (const s of SUITS) {
      const cs = hand.filter((c) => c[0] === s);
      if (cs.some((c) => rankOf(c) === 14)) v += 6;
      if (cs.some((c) => rankOf(c) === 13)) v += cs.some((c) => rankOf(c) === 14) ? 3 : 1.5;
      if (cs.length === 0) v += 5; else if (cs.length === 1) v += 2;
      if (cs.length >= 5) v += (cs.length - 4) * 2;
    }
    const scale = n === 3 ? 0.78 : n === 5 ? 1.2 : 1;
    return v * scale;
  }

  function bot(g, seat) {
    const hand = g.hands[seat];
    if (g.phase === 'dealEnd') return { type: 'ready' };
    if (g.phase === 'bidding') {
      const v = evalBid(hand, g.n);
      const best = g.contract ? g.contract.level : 0;
      let lvl = v >= 88 ? 4 : v >= 76 ? 3 : v >= 58 ? 2 : v >= 42 ? 1 : 0;
      if (lvl <= best) lvl = 0;
      return { type: 'bid', level: lvl };
    }
    if (g.phase === 'call') {
      const opts = callOptions(g);
      const notMine = opts.filter((c) => !hand.includes(c));
      const pool = notMine.length ? notMine : opts;
      pool.sort((a, b) => hand.filter((c) => c[0] === b[0]).length - hand.filter((c) => c[0] === a[0]).length);
      return { type: 'call', card: pool[0] };
    }
    if (g.phase === 'ecart') {
      const need = g.chien.length;
      const ok = hand.filter((c) => !isTrump(c) && c !== 'EX' && rankOf(c) !== 14);
      const len = (s) => hand.filter((c) => c[0] === s).length;
      ok.sort((a, b) => len(a[0]) - len(b[0]) || halfPoints(b) - halfPoints(a));
      let cards = ok.slice(0, need);
      if (cards.length < need) cards = cards.concat(hand.filter((c) => isTrump(c) && !isOudler(c)).sort((a, b) => rankOf(a) - rankOf(b)).slice(0, need - cards.length));
      return { type: 'ecart', cards, chelem: false };
    }
    if (g.phase === 'annonce') return { type: 'annonce', chelem: false };
    if (g.phase === 'playing') {
      if (!g.playedOnce[seat] && !g.poignees.some((p) => p.seat === seat)) {
        const opts = poigneeOptions(g, seat);
        if (opts.length && campOf(g, seat) === 'A' || opts.length && randInt(3) > 0) return { type: 'poignee', size: opts[0] };
      }
      return { type: 'play', card: botCard(g, seat) };
    }
    return null;
  }

  function botCard(g, seat) {
    const hand = g.hands[seat];
    const legal = legalCards(hand, g.trick);
    const nonEx = legal.filter((c) => c !== 'EX');
    if (!nonEx.length) return 'EX';
    const tricksLeft = hand.length;
    const myCamp = campOf(g, seat);
    const knownPartner = (s) => {
      if (s === seat) return true;
      if (myCamp === 'A') return s === g.contract.seat || (g.partnerRevealed && s === g.partner);
      // défense : tout le monde sauf le preneur (et le partenaire révélé)
      return s !== g.contract.seat && !(g.partnerRevealed && s === g.partner);
    };
    const played = new Set(g.tricks.flatMap((t) => t.cards.map((x) => x.card)).concat(g.trick.map((t) => t.card)));
    const outTrumps = deck().filter((c) => isTrump(c) && !played.has(c) && !hand.includes(c));
    const low = (cs) => cs.slice().sort((a, b) => halfPoints(a) - halfPoints(b) || rankOf(a) - rankOf(b))[0];
    const highPts = (cs) => cs.slice().sort((a, b) => halfPoints(b) - halfPoints(a) || rankOf(b) - rankOf(a))[0];
    const noPetit = (cs) => { const f = cs.filter((c) => c !== 'T01'); return f.length ? f : cs; };
    // Excuse : à jouer avant le dernier pli, de préférence quand on perdrait des points
    if (legal.includes('EX') && tricksLeft <= 2) return 'EX';

    if (!g.trick.length) {
      // Petit : le jouer si tous les atouts plus forts sont tombés
      if (hand.includes('T01') && outTrumps.length === 0) return 'T01';
      if (myCamp === 'A') {
        const myTrumps = nonEx.filter(isTrump);
        if (myTrumps.length >= 4 && outTrumps.length) return noPetit(myTrumps).sort((a, b) => rankOf(b) - rankOf(a))[0];
      }
      const kings = nonEx.filter((c) => !isTrump(c) && rankOf(c) === 14);
      if (kings.length) return kings[0];
      const plain = nonEx.filter((c) => !isTrump(c));
      if (plain.length) {
        const len = (s) => hand.filter((c) => c[0] === s).length;
        return plain.sort((a, b) => len(a[0]) - len(b[0]) || halfPoints(a) - halfPoints(b))[0];
      }
      return low(noPetit(nonEx));
    }
    const wi = winnerIndex(g.trick);
    const win = g.trick[wi];
    const lastToPlay = g.trick.length === g.n - 1;
    const beats = (c) => { const t = g.trick.concat([{ seat, card: c }]); return winnerIndex(t) === t.length - 1; };
    const partnerWins = win && knownPartner(win.seat) && win.seat !== seat;
    const trickPts = g.trick.reduce((s, t) => s + halfPoints(t.card), 0);
    if (partnerWins) {
      const strong = lastToPlay || (isTrump(win.card) && outTrumps.every((c) => rankOf(c) < rankOf(win.card)));
      if (strong) {
        if (nonEx.includes('T01')) return 'T01';
        return highPts(nonEx);
      }
      return low(noPetit(nonEx));
    }
    const winners = nonEx.filter(beats);
    if (winners.length) {
      if (winners.includes('T01') && lastToPlay) return 'T01';
      const w = noPetit(winners).sort((a, b) => rankOf(a) - rankOf(b));
      if (lastToPlay || trickPts >= 5 || isTrump(w[0])) {
        // si on doit couper, le plus petit atout qui gagne
        return w[0];
      }
      return w[0];
    }
    if (legal.includes('EX') && trickPts >= 9 && !nonEx.some((c) => halfPoints(c) === 1)) return 'EX';
    return low(noPetit(nonEx));
  }

  function fallback(g, seat) {
    if (g.phase === 'playing') return { type: 'play', card: legalCards(g.hands[seat], g.trick)[0] };
    if (g.phase === 'bidding') return { type: 'bid', level: 0 };
    if (g.phase === 'dealEnd') return { type: 'ready' };
    return bot(g, seat);
  }

  const module = {
    id: 'tarot', minPlayers: 3, maxPlayers: 5,
    defaultSettings: { tours: 2 },
    settingsUI: [{ key: 'tours', label: 'Longueur de la partie', options: [{ value: 1, label: '1 tour de table' }, { value: 2, label: '2 tours de table' }, { value: 3, label: '3 tours de table' }, { value: 5, label: '5 tours de table' }] }],
    create, apply, view, waiting, tick, bot, fallback, isOver,
    spyView: (g) => { const v = view(g, null); v.spy = true; v.allHands = g.hands.map((h) => h.slice()); v.spyChien = g.chien.slice(); v.spyEcart = g.ecart.slice(); v.spyPartner = g.partner; return v; },
    botDelay: (g) => (g.phase === 'playing' ? 700 : g.phase === 'dealEnd' ? 300 : 1000),
  };
  const api = { module, legalCards, winnerIndex, halfPoints, cardLabel, isTrump, isOudler, rankOf, suitOf, deck, LEVELS, MULT, REQUIRED, POIGNEE, POIGNEE_NAME, POIGNEE_BONUS, HAND, CHIEN, SUIT_NAME, SUIT_SYM };
  root.TarotEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
