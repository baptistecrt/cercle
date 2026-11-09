/* ============================================================
   Coinche — moteur de règles (belote coinchée)
   Fonctionne dans le navigateur (window.CoincheEngine) et dans Node.
   ============================================================ */
(function (root) {
  'use strict';

  const SUITS = ['S', 'H', 'C', 'D'];
  const RANKS = ['7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const SUIT_INFO = {
    S: { name: 'Pique', sym: '♠', red: false },
    H: { name: 'Cœur', sym: '♥', red: true },
    D: { name: 'Carreau', sym: '♦', red: true },
    C: { name: 'Trèfle', sym: '♣', red: false },
    TA: { name: 'Tout atout', sym: 'TA', red: false },
    SA: { name: 'Sans atout', sym: 'SA', red: false },
  };
  const CONTRACT_SUITS = ['S', 'H', 'D', 'C', 'TA', 'SA'];
  const RANK_NAME = { '7': '7', '8': '8', '9': '9', T: '10', J: 'Valet', Q: 'Dame', K: 'Roi', A: 'As' };
  const RANK_SHORT = { '7': '7', '8': '8', '9': '9', T: '10', J: 'V', Q: 'D', K: 'R', A: 'A' };

  // Force des cartes (index = force)
  const TRUMP_ORDER = ['7', '8', 'Q', 'K', 'T', 'A', '9', 'J'];
  const PLAIN_ORDER = ['7', '8', '9', 'J', 'Q', 'K', 'T', 'A'];
  const TRUMP_PTS = { J: 20, '9': 14, A: 11, T: 10, K: 4, Q: 3, '8': 0, '7': 0 };
  const PLAIN_PTS = { A: 11, T: 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 };
  // Tout atout / Sans atout : barèmes ramenés à 162 points comme une donne normale
  const TA_PTS = { J: 14, '9': 9, A: 6, T: 5, K: 3, Q: 1, '8': 0, '7': 0 };
  const SA_PTS = { A: 19, T: 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 };

  const BID_VALUES = [80, 90, 100, 110, 120, 130, 140, 150, 160, 250]; // 250 = Capot
  const CAPOT = 250;
  const CAPOT_POINTS = 252; // points d'un capot (162 + 90)
  const BELOTE_PTS = 20;
  const DIX_DE_DER = 10;

  const rankOf = (c) => c[0];
  const suitOf = (c) => c[1];
  const teamOf = (seat) => seat % 2;
  const partnerOf = (seat) => (seat + 2) % 4;
  const nextSeat = (seat) => (seat + 1) % 4;

  function cardPoints(card, trump) {
    if (trump === 'TA') return TA_PTS[rankOf(card)];
    if (trump === 'SA') return SA_PTS[rankOf(card)];
    return suitOf(card) === trump ? TRUMP_PTS[rankOf(card)] : PLAIN_PTS[rankOf(card)];
  }
  function strength(card, trump) {
    if (trump === 'TA') return TRUMP_ORDER.indexOf(rankOf(card));
    return suitOf(card) === trump ? 100 + TRUMP_ORDER.indexOf(rankOf(card)) : PLAIN_ORDER.indexOf(rankOf(card));
  }
  function cardLabel(card) {
    return RANK_NAME[rankOf(card)] + ' de ' + SUIT_INFO[suitOf(card)].name.toLowerCase();
  }
  function bidLabel(value, suit) {
    const v = value === CAPOT ? 'Capot' : String(value);
    if (suit === 'TA' || suit === 'SA') return v + ' ' + SUIT_INFO[suit].name.toLowerCase();
    return suit ? v + ' ' + SUIT_INFO[suit].sym : v;
  }

  function newDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push(r + s);
    return d;
  }
  function randInt(n) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return a[0] % n;
    }
    return Math.floor(Math.random() * n);
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Carte gagnante d'un pli (liste {seat, card}) → index dans le pli */
  function trickWinnerIndex(trick, trump) {
    const lead = suitOf(trick[0].card);
    let best = 0;
    for (let i = 1; i < trick.length; i++) {
      const c = trick[i].card, b = trick[best].card;
      const cT = suitOf(c) === trump, bT = suitOf(b) === trump;
      if (cT && !bT) best = i;
      else if (cT && bT) { if (strength(c, trump) > strength(b, trump)) best = i; }
      else if (!cT && !bT && suitOf(c) === lead && strength(c, trump) > strength(b, trump)) best = i;
    }
    return best;
  }

  /**
   * Cartes jouables selon les règles officielles :
   * - fournir à la couleur demandée ;
   * - à l'atout demandé : monter si possible (même sur son partenaire) ;
   * - sans la couleur : si le partenaire est maître, on joue ce qu'on veut ;
   *   sinon on doit couper, et surcouper si un adversaire a déjà coupé ;
   *   si on ne peut pas surcouper, on doit quand même sous-couper ;
   *   sans atout, on se défausse librement.
   */
  function legalCards(hand, trick, trump) {
    if (!trick.length) return hand.slice();
    const lead = suitOf(trick[0].card);
    if (trump === 'SA' || trump === 'TA') {
      // Sans atout : fournir, sinon défausse libre. Tout atout : fournir ET monter si possible.
      const f = hand.filter((c) => suitOf(c) === lead);
      if (!f.length) return hand.slice();
      if (trump === 'SA') return f;
      const best = Math.max(...trick.filter((t) => suitOf(t.card) === lead).map((t) => strength(t.card, trump)));
      const hi = f.filter((c) => strength(c, trump) > best);
      return hi.length ? hi : f;
    }
    const follow = hand.filter((c) => suitOf(c) === lead);
    const trumps = hand.filter((c) => suitOf(c) === trump);
    const trickTrumps = trick.filter((t) => suitOf(t.card) === trump);
    const highestTrump = trickTrumps.length ? Math.max(...trickTrumps.map((t) => strength(t.card, trump))) : -1;

    if (lead === trump) {
      if (!follow.length) return hand.slice();
      const higher = follow.filter((c) => strength(c, trump) > highestTrump);
      return higher.length ? higher : follow;
    }
    if (follow.length) return follow;

    const winnerSeat = trick[trickWinnerIndex(trick, trump)].seat;
    const mySeat = (trick[0].seat + trick.length) % 4;
    if (winnerSeat === partnerOf(mySeat)) return hand.slice();
    if (!trumps.length) return hand.slice();
    if (highestTrump >= 0) {
      const higher = trumps.filter((c) => strength(c, trump) > highestTrump);
      return higher.length ? higher : trumps;
    }
    return trumps;
  }

  // ------------------------------------------------------------------
  // Partie
  // ------------------------------------------------------------------
  function createGame(opts) {
    opts = opts || {};
    return {
      phase: 'idle',
      target: opts.target || 1000,
      taSa: opts.taSa !== false,
      coincheAnytime: opts.coincheAnytime !== false,
      scores: [0, 0],
      history: [],          // une entrée par donne
      round: 0,
      dealer: opts.dealer != null ? opts.dealer : randInt(4),
      hands: [[], [], [], []],
      bids: [],             // {seat, type:'bid'|'pass'|'coinche'|'surcoinche', value, suit}
      contract: null,       // {seat, value, suit}
      coinche: 0,           // 0, 1 = coinché, 2 = surcoinché
      coincheSeat: null,
      surcoincheQueue: null,
      passCount: 0,
      turn: null,
      trick: [],
      trickDone: false,
      trickWinner: null,
      leader: null,
      tricksPlayed: 0,
      wonCards: [[], []],
      tricksWon: [0, 0],
      lastTrick: null,
      played: [],
      belote: null,         // {seat, step:0|1|2}
      lastRound: null,
      winner: null,
      seq: 0,
    };
  }

  function startRound(g) {
    g.round += 1;
    g.dealer = g.round === 1 ? g.dealer : nextSeat(g.dealer);
    const deck = shuffle(newDeck());
    g.hands = [[], [], [], []];
    // Distribution 3-2-3 en commençant à droite du donneur
    let k = 0;
    for (const n of [3, 2, 3]) {
      for (let i = 1; i <= 4; i++) {
        const s = (g.dealer + i) % 4;
        for (let j = 0; j < n; j++) g.hands[s].push(deck[k++]);
      }
    }
    g.bids = [];
    g.contract = null;
    g.coinche = 0;
    g.coincheSeat = null;
    g.surcoincheQueue = null;
    g.passCount = 0;
    g.turn = nextSeat(g.dealer);
    g.trick = [];
    g.trickDone = false;
    g.trickWinner = null;
    g.leader = null;
    g.tricksPlayed = 0;
    g.wonCards = [[], []];
    g.tricksWon = [0, 0];
    g.lastTrick = null;
    g.played = [];
    g.belote = null;
    g.lastRound = null;
    g.phase = 'bidding';
    g.seq++;
    return [{ type: 'deal', dealer: g.dealer }];
  }

  /** Actions d'enchère possibles pour un siège */
  function biddingOptions(g, seat) {
    if (g.phase !== 'bidding' || seat == null) return null;
    const c = g.contract;
    const myTurn = g.turn === seat;
    const suits = g.taSa ? CONTRACT_SUITS : SUITS;
    if (g.surcoincheQueue) {
      // Après une coinche : les preneurs peuvent surcoincher (à tout moment si l'option est active)
      const attacker = !!c && teamOf(seat) === teamOf(c.seat);
      if (myTurn) return { myTurn, values: [], canPass: true, canCoinche: false, canSurcoinche: true, suits };
      if (attacker && g.coincheAnytime) return { myTurn, values: [], canPass: false, canCoinche: false, canSurcoinche: true, suits };
      return null;
    }
    const canCoinche = !!c && teamOf(c.seat) !== teamOf(seat) && g.coinche === 0 && (myTurn || g.coincheAnytime);
    if (!myTurn) return canCoinche ? { myTurn, values: [], canPass: false, canCoinche: true, canSurcoinche: false, suits } : null;
    const min = c ? c.value : 0;
    const values = BID_VALUES.filter((v) => v > min);
    return { myTurn, values, canPass: true, canCoinche, canSurcoinche: false, suits };
  }

  function beginPlay(g, events) {
    g.phase = 'playing';
    g.turn = nextSeat(g.dealer);
    g.leader = g.turn;
    const t = g.contract.suit;
    for (let s = 0; s < 4; s++) {
      if (g.hands[s].includes('K' + t) && g.hands[s].includes('Q' + t)) g.belote = { seat: s, step: 0 };
    }
    events.push({ type: 'contract', contract: g.contract, coinche: g.coinche });
  }

  function applyBid(g, seat, a) {
    const ev = [];
    const opt = biddingOptions(g, seat);
    if (!opt) return { error: "Ce n'est pas ton tour." };
    if (!opt.myTurn && !((a.type === 'coinche' && opt.canCoinche) || (a.type === 'surcoinche' && opt.canSurcoinche))) return { error: "Ce n'est pas ton tour." };

    if (g.surcoincheQueue) {
      if (a.type === 'surcoinche') {
        g.coinche = 2;
        g.bids.push({ seat, type: 'surcoinche' });
        ev.push({ type: 'bid', seat, bid: { type: 'surcoinche' } });
        g.surcoincheQueue = null;
        beginPlay(g, ev);
      } else if (a.type === 'pass') {
        g.bids.push({ seat, type: 'pass' });
        ev.push({ type: 'bid', seat, bid: { type: 'pass' } });
        g.surcoincheQueue.shift();
        if (g.surcoincheQueue.length) g.turn = g.surcoincheQueue[0];
        else { g.surcoincheQueue = null; beginPlay(g, ev); }
      } else return { error: 'Seule la surcoinche ou passe est possible.' };
      g.seq++;
      return { events: ev };
    }

    if (a.type === 'pass') {
      g.bids.push({ seat, type: 'pass' });
      g.passCount++;
      ev.push({ type: 'bid', seat, bid: { type: 'pass' } });
      if (!g.contract && g.passCount >= 4) {
        g.phase = 'redeal';
        g.turn = null;
        ev.push({ type: 'allpass' });
      } else if (g.contract && g.passCount >= 3) {
        beginPlay(g, ev);
      } else g.turn = nextSeat(seat);
    } else if (a.type === 'bid') {
      const v = Number(a.value);
      if (!opt.values.includes(v)) return { error: 'Enchère invalide.' };
      if (!(g.taSa ? CONTRACT_SUITS : SUITS).includes(a.suit)) return { error: 'Couleur invalide.' };
      g.contract = { seat, value: v, suit: a.suit };
      g.bids.push({ seat, type: 'bid', value: v, suit: a.suit });
      g.passCount = 0;
      ev.push({ type: 'bid', seat, bid: { type: 'bid', value: v, suit: a.suit } });
      g.turn = nextSeat(seat);
    } else if (a.type === 'coinche') {
      if (!opt.canCoinche) return { error: 'Coinche impossible.' };
      g.coinche = 1;
      g.coincheSeat = seat;
      g.bids.push({ seat, type: 'coinche' });
      ev.push({ type: 'bid', seat, bid: { type: 'coinche' } });
      // Les preneurs (dans l'ordre de jeu) peuvent surcoincher
      const q = [];
      for (let i = 1; i <= 3; i++) {
        const s = (seat + i) % 4;
        if (teamOf(s) === teamOf(g.contract.seat)) q.push(s);
      }
      g.surcoincheQueue = q;
      g.turn = q[0];
    } else return { error: 'Action inconnue.' };
    g.seq++;
    return { events: ev };
  }

  function applyPlay(g, seat, card) {
    if (g.phase !== 'playing' || g.trickDone) return { error: 'Pas maintenant.' };
    if (g.turn !== seat) return { error: "Ce n'est pas ton tour." };
    const hand = g.hands[seat];
    if (!hand.includes(card)) return { error: "Tu n'as pas cette carte." };
    const legal = legalCards(hand, g.trick, g.contract.suit);
    if (!legal.includes(card)) return { error: 'Carte interdite : ' + explainIllegal(hand, g.trick, g.contract.suit) };
    const ev = [];
    hand.splice(hand.indexOf(card), 1);
    g.trick.push({ seat, card });
    g.played.push(card);
    ev.push({ type: 'play', seat, card });

    // Belote / Rebelote
    const t = g.contract.suit;
    if (g.belote && g.belote.seat === seat && (card === 'K' + t || card === 'Q' + t)) {
      g.belote.step++;
      ev.push({ type: 'belote', seat, word: g.belote.step === 1 ? 'Belote !' : 'Rebelote !' });
    }

    if (g.trick.length === 4) {
      const wi = trickWinnerIndex(g.trick, t);
      g.trickWinner = g.trick[wi].seat;
      g.trickDone = true;
      g.turn = null;
      ev.push({ type: 'trickwin', seat: g.trickWinner });
    } else g.turn = nextSeat(seat);
    g.seq++;
    return { events: ev };
  }

  function explainIllegal(hand, trick, trump) {
    const lead = suitOf(trick[0].card);
    const has = (s) => hand.some((c) => suitOf(c) === s);
    if (trump === 'TA') return 'à tout atout, il faut fournir et monter si tu peux.';
    if (trump === 'SA') return 'il faut fournir à ' + SUIT_INFO[lead].name.toLowerCase() + '.';
    if (lead === trump) return 'il faut monter à l\'atout si tu peux.';
    if (has(lead)) return 'il faut fournir à ' + SUIT_INFO[lead].name.toLowerCase() + '.';
    if (has(trump)) {
      const trickTrumps = trick.some((x) => suitOf(x.card) === trump);
      return trickTrumps ? 'il faut surcouper (ou sous-couper si tu ne peux pas monter).' : 'il faut couper.';
    }
    return 'coup non autorisé.';
  }

  /** Ramasse le pli terminé (appelé par l'hôte après une petite pause) */
  function collectTrick(g) {
    if (!g.trickDone) return { events: [] };
    const ev = [];
    const w = g.trickWinner;
    const team = teamOf(w);
    g.wonCards[team].push(...g.trick.map((x) => x.card));
    g.tricksWon[team]++;
    g.tricksPlayed++;
    g.lastTrick = { cards: g.trick.slice(), winner: w };
    g.trick = [];
    g.trickDone = false;
    g.trickWinner = null;
    if (g.tricksPlayed === 8) {
      g.lastTrickTeam = team;
      scoreRound(g);
      ev.push({ type: 'roundend' });
    } else {
      g.turn = w;
      g.leader = w;
    }
    g.seq++;
    return { events: ev };
  }

  function scoreRound(g) {
    const c = g.contract;
    const trump = c.suit;
    const att = teamOf(c.seat), def = 1 - att;
    const card = [0, 0];
    for (let t = 0; t < 2; t++) card[t] = g.wonCards[t].reduce((s, x) => s + cardPoints(x, trump), 0);
    card[g.lastTrickTeam] += DIX_DE_DER;
    const capotTeam = g.tricksWon[0] === 8 ? 0 : g.tricksWon[1] === 8 ? 1 : null;
    const raw = card.slice();
    if (capotTeam != null) { card[capotTeam] = CAPOT_POINTS; card[1 - capotTeam] = 0; }
    const belote = [0, 0];
    let beloteTeam = null;
    if (g.belote && g.belote.step >= 2) { beloteTeam = teamOf(g.belote.seat); belote[beloteTeam] = BELOTE_PTS; }
    const total = [card[0] + belote[0], card[1] + belote[1]];

    let made;
    if (c.value === CAPOT) made = g.tricksWon[att] === 8;
    else made = total[att] >= c.value && total[att] > total[def];

    const mult = g.coinche === 2 ? 4 : g.coinche === 1 ? 2 : 1;
    const gain = [0, 0];
    if (g.coinche === 0) {
      if (made) { gain[att] = c.value + card[att]; gain[def] = card[def]; }
      else { gain[att] = 0; gain[def] = 160 + c.value; }
    } else {
      if (made) gain[att] = 160 + c.value * mult;
      else gain[def] = 160 + c.value * mult;
    }
    gain[0] += belote[0];
    gain[1] += belote[1];

    g.scores[0] += gain[0];
    g.scores[1] += gain[1];
    const entry = {
      round: g.round, dealer: g.dealer, contract: { ...c }, coinche: g.coinche, coincheSeat: g.coincheSeat,
      made, cardPoints: card, rawPoints: raw, belote, beloteTeam, total, capotTeam, mult, gain,
      tricksWon: g.tricksWon.slice(), scores: g.scores.slice(), lastTrickTeam: g.lastTrickTeam,
    };
    g.history.push(entry);
    g.lastRound = entry;

    const reached = g.scores.map((s) => s >= g.target);
    if (reached[0] || reached[1]) {
      if (g.scores[0] === g.scores[1]) g.phase = 'roundEnd'; // égalité : on rejoue une donne
      else { g.phase = 'gameEnd'; g.winner = g.scores[0] > g.scores[1] ? 0 : 1; }
    } else g.phase = 'roundEnd';
    g.turn = null;
  }

  function apply(g, seat, a) {
    if (!a || typeof a !== 'object') return { error: 'Action vide.' };
    if (a.type === 'play') return applyPlay(g, seat, a.card);
    if (['bid', 'pass', 'coinche', 'surcoinche'].includes(a.type)) {
      if (g.phase !== 'bidding') return { error: 'Les enchères sont terminées.' };
      return applyBid(g, seat, a);
    }
    return { error: 'Action inconnue.' };
  }

  /** Vue envoyée à un joueur : uniquement SA main */
  function viewFor(g, seat) {
    const v = {
      phase: g.phase, target: g.target, taSa: g.taSa, coincheAnytime: g.coincheAnytime, scores: g.scores, history: g.history, round: g.round, dealer: g.dealer,
      bids: g.bids, contract: g.contract, coinche: g.coinche, coincheSeat: g.coincheSeat, turn: g.turn,
      trick: g.trick, trickDone: g.trickDone, trickWinner: g.trickWinner, leader: g.leader,
      tricksWon: g.tricksWon, tricksPlayed: g.tricksPlayed, lastTrick: g.lastTrick,
      belote: g.belote && g.belote.step > 0 ? { seat: g.belote.seat, step: g.belote.step } : null,
      lastRound: g.lastRound, winner: g.winner, seq: g.seq,
      handCounts: g.hands.map((h) => h.length),
      surcoinche: !!g.surcoincheQueue,
      hand: null, legal: null, bidOptions: null,
    };
    if (seat != null && seat >= 0) {
      v.hand = g.hands[seat].slice();
      if (g.phase === 'playing' && g.turn === seat && !g.trickDone) v.legal = legalCards(g.hands[seat], g.trick, g.contract.suit);
      v.bidOptions = biddingOptions(g, seat);
    }
    return v;
  }

  const api = {
    SUITS, CONTRACT_SUITS, RANKS, SUIT_INFO, TA_PTS, SA_PTS, RANK_NAME, RANK_SHORT, TRUMP_ORDER, PLAIN_ORDER, TRUMP_PTS, PLAIN_PTS,
    BID_VALUES, CAPOT, CAPOT_POINTS, BELOTE_PTS, DIX_DE_DER,
    rankOf, suitOf, teamOf, partnerOf, nextSeat, cardPoints, strength, cardLabel, bidLabel,
    newDeck, shuffle, trickWinnerIndex, legalCards, createGame, startRound, biddingOptions,
    apply, collectTrick, viewFor, randInt,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoincheEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
