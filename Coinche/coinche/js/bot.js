/* ============================================================
   Coinche — joueur robot (n'utilise que l'info publique + sa main)
   ============================================================ */
(function (root) {
  'use strict';
  const E = root.CoincheEngine || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const { suitOf, rankOf, teamOf, partnerOf, strength, cardPoints, SUITS } = E;

  /** Estimation de la valeur d'une main si `trump` est atout */
  function evalHand(hand, trump) {
    let v = 0;
    const trumps = hand.filter((c) => suitOf(c) === trump);
    const has = (c) => hand.includes(c);
    if (has('J' + trump)) v += 32;
    if (has('9' + trump)) v += has('J' + trump) ? 22 : 12;
    if (has('A' + trump)) v += 10;
    for (const c of trumps) if (!['J', '9', 'A'].includes(rankOf(c))) v += 6;
    if (trumps.length >= 4) v += (trumps.length - 3) * 12;
    if (has('K' + trump) && has('Q' + trump)) v += 18;
    for (const s of SUITS) {
      if (s === trump) continue;
      const side = hand.filter((c) => suitOf(c) === s);
      if (has('A' + s)) v += 13;
      if (has('T' + s) && has('A' + s)) v += 8;
      if (side.length === 0 && trumps.length >= 3) v += 8; // coupe franche
    }
    return v;
  }

  // Tout atout : il faut des valets et des 9 (les plus forts partout)
  function evalTA(hand) {
    let v = 0;
    for (const s of SUITS) {
      const J = hand.includes('J' + s), N = hand.includes('9' + s), A = hand.includes('A' + s);
      const len = hand.filter((c) => suitOf(c) === s).length;
      if (J) v += 19;
      if (N) v += J ? 12 : len >= 3 ? 6 : 2;
      if (A && J && N) v += 4;
    }
    return v;
  }
  // Sans atout : il faut des as, des 10 gardés et des couleurs maîtresses
  function evalSA(hand) {
    let v = 0;
    for (const s of SUITS) {
      const cs = hand.filter((c) => suitOf(c) === s);
      const A = cs.includes('A' + s), T = cs.includes('T' + s), K = cs.includes('K' + s);
      if (A) v += 17;
      if (A && T) v += 10; else if (T && cs.length >= 3) v += 3;
      if (A && T && K) v += 4 + Math.max(0, cs.length - 3) * 5;
      if (!A && cs.length) v -= 3;
    }
    return v;
  }
  function lastBidOf(view, seat) {
    for (let i = view.bids.length - 1; i >= 0; i--) if (view.bids[i].seat === seat && view.bids[i].type === 'bid') return view.bids[i];
    return null;
  }

  function decideBid(view, seat) {
    const opt = view.bidOptions;
    const hand = view.hand;
    if (view.surcoinche) {
      // Surcoinche seulement avec un très gros jeu
      const t = view.contract.suit;
      return evalHand(hand, t) >= 115 ? { type: 'surcoinche' } : { type: 'pass' };
    }
    const c = view.contract;
    const partnerBid = lastBidOf(view, partnerOf(seat));
    let best = null;
    for (const s of SUITS) {
      let v = evalHand(hand, s);
      let bidValue;
      if (partnerBid && partnerBid.suit === s && c && teamOf(c.seat) === teamOf(seat)) {
        // Soutien du partenaire : on ajoute ce qu'on apporte
        let add = 0;
        if (hand.includes('J' + s)) add += 20;
        if (hand.includes('9' + s)) add += 10;
        for (const o of SUITS) if (o !== s && hand.includes('A' + o)) add += 10;
        bidValue = add >= 20 ? Math.floor((partnerBid.value + add - 10) / 10) * 10 : 0;
      } else {
        bidValue = v >= 62 ? Math.min(160, 80 + Math.floor((v - 62) / 12) * 10) : 0;
      }
      if (bidValue && (!best || bidValue > best.value)) best = { value: bidValue, suit: s };
    }
    if (opt.suits && opt.suits.includes('TA')) {
      for (const [s, v, min] of [['TA', evalTA(hand), 70], ['SA', evalSA(hand), 60]]) {
        const bidValue = v >= min ? Math.min(160, 80 + Math.floor((v - min) / 10) * 10) : 0;
        if (bidValue && (!best || bidValue > best.value)) best = { value: bidValue, suit: s };
      }
    }
    if (best) {
      const allowed = opt.values.filter((x) => x <= 160 && x <= best.value);
      // Ne pas surenchérir sur son partenaire sans raison
      const partnerHolds = c && c.seat === partnerOf(seat);
      if (allowed.length && !(partnerHolds && best.suit !== c.suit && best.value - c.value < 20)) {
        const value = partnerHolds ? allowed[0] : allowed[allowed.length - 1] === best.value ? best.value : allowed[0];
        if (!partnerHolds || best.suit === c.suit) return { type: 'bid', value, suit: best.suit };
        return { type: 'bid', value: allowed[0], suit: best.suit };
      }
    }
    if (opt.canCoinche && c) {
      const t = c.suit;
      let d = 0;
      if (hand.includes('J' + t)) d += 2;
      if (hand.includes('9' + t)) d += 1;
      d += hand.filter((x) => suitOf(x) === t).length >= 3 ? 1 : 0;
      for (const s of SUITS) if (s !== t && hand.includes('A' + s)) d += 1;
      if (d >= 5 && c.value >= 100) return { type: 'coinche' };
    }
    return { type: 'pass' };
  }

  /** Cartes encore dehors (ni jouées ni en main) */
  function unseen(view) {
    const out = [];
    const known = new Set([...view.hand, ...(view.playedAll || []), ...view.trick.map((t) => t.card)]);
    for (const c of E.newDeck()) if (!known.has(c)) out.push(c);
    return out;
  }
  function isMaster(card, view, trump) {
    const others = unseen(view).filter((c) => suitOf(c) === suitOf(card));
    return others.every((o) => strength(o, trump) < strength(card, trump));
  }

  function decidePlay(view, seat) {
    const legal = view.legal;
    if (legal.length === 1) return legal[0];
    const trump = view.contract.suit;
    const hand = view.hand;
    const myTeam = teamOf(seat);
    const attacking = teamOf(view.contract.seat) === myTeam;
    const byLow = (a, b) => cardPoints(a, trump) - cardPoints(b, trump) || strength(a, trump) - strength(b, trump);
    const lowest = (cs) => cs.slice().sort(byLow)[0];
    const highestPts = (cs) => cs.slice().sort((a, b) => cardPoints(b, trump) - cardPoints(a, trump) || strength(b, trump) - strength(a, trump))[0];

    if (!view.trick.length) {
      const myTrumps = legal.filter((c) => suitOf(c) === trump);
      const outTrumps = unseen(view).filter((c) => suitOf(c) === trump);
      if (attacking && myTrumps.length && outTrumps.length) {
        const master = myTrumps.find((c) => isMaster(c, view, trump));
        if (master) return master;
        if (myTrumps.length >= 3) return lowest(myTrumps);
      }
      const masters = legal.filter((c) => suitOf(c) !== trump && isMaster(c, view, trump));
      if (masters.length) return highestPts(masters);
      const nonTrump = legal.filter((c) => suitOf(c) !== trump && rankOf(c) !== 'T');
      return lowest(nonTrump.length ? nonTrump : legal);
    }

    const trick = view.trick;
    const wi = E.trickWinnerIndex(trick, trump);
    const winSeat = trick[wi].seat;
    const winCard = trick[wi].card;
    const partnerWinning = winSeat === partnerOf(seat);
    const lastToPlay = trick.length === 3;
    const beats = (c) => {
      const t2 = trick.concat([{ seat, card: c }]);
      return E.trickWinnerIndex(t2, trump) === t2.length - 1;
    };

    // Générale du partenaire : surtout ne pas lui prendre un pli
    if (view.contract.value === E.GENERALE && view.contract.seat === partnerOf(seat)) {
      const losers = legal.filter((c) => !beats(c));
      return lowest(losers.length ? losers : legal);
    }

    if (partnerWinning) {
      const safe = lastToPlay || isMaster(winCard, view, trump) && suitOf(winCard) !== trump || suitOf(winCard) === trump && isMaster(winCard, view, trump);
      const nonTrump = legal.filter((c) => suitOf(c) !== trump);
      if (safe) return highestPts(nonTrump.length ? nonTrump : legal);
      return lowest(nonTrump.length ? nonTrump : legal);
    }
    const winners = legal.filter(beats);
    if (winners.length) {
      if (lastToPlay) return winners.slice().sort(byLow)[0];
      const masterWinners = winners.filter((c) => isMaster(c, view, trump));
      if (masterWinners.length) return masterWinners.slice().sort(byLow)[0];
      const trickPts = trick.reduce((s, t) => s + cardPoints(t.card, trump), 0);
      if (trickPts >= 10) return winners.slice().sort(byLow)[0];
      return lowest(legal);
    }
    return lowest(legal);
  }

  const api = { decideBid, decidePlay, evalHand, evalTA, evalSA };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoincheBot = api;
})(typeof window !== 'undefined' ? window : globalThis);
