/* Tarot — interface */
(function () {
  'use strict';
  const T = window.TarotEngine;
  const C = window.TarotCards;
  const esc = window.SalleRoom.esc;
  const SLOTS = { 3: ['bottom', 'right', 'left'], 4: ['bottom', 'right', 'top', 'left'], 5: ['bottom', 'right', 'topright', 'topleft', 'left'] };
  const ui = { built: false, sel: new Set(), handDeal: null, flash: {}, flashTimer: null, pending: null, lastDealShown: null, chienSeen: null };

  function cardEl(c, cls) {
    const d = document.createElement('div');
    d.className = 'card' + (cls ? ' ' + cls : '');
    d.dataset.card = c;
    d.innerHTML = C.cardInner(c);
    d.title = T.cardLabel(c);
    return d;
  }
  const cardHtml = (c, extra) => '<div class="card"' + (extra || '') + ' title="' + esc(T.cardLabel(c)) + '">' + C.cardInner(c) + '</div>';
  const suitHtml = (c) => { const s = c[0]; const red = s === 'H' || s === 'D'; return '<span class="' + (red ? 's-red' : '') + '">' + T.SUIT_SYM[s] + '</span>'; };
  const calledLabel = (c) => ({ 14: 'Roi', 13: 'Dame', 12: 'Cavalier', 11: 'Valet' }[T.rankOf(c)]) + ' de ' + suitHtml(c);

  const ICON = {
    last: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sheet: '<svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  function build(api) {
    const root = document.getElementById('game-root');
    root.innerHTML = `<div class="felt-bg tt" id="tt">
      <button class="carnet" id="t-carnet" title="Feuille de marque"></button>
      <div class="contract" id="t-contract" hidden></div>
      <nav class="ttools"><button id="t-last" title="Dernier pli">${ICON.last}<span>Dernier pli</span></button><button id="t-sheet" title="Feuille de marque">${ICON.sheet}<span>Marque</span></button></nav>
      <div id="t-seats"></div>
      <div class="ttrick" id="t-trick"></div>
      <div class="tcenter" id="t-center"></div>
      <div class="flash" id="t-flash" hidden></div>
      <div class="poig" id="t-poig" hidden></div>
      <div class="thand-zone"><div class="thand" id="t-hand"></div><button class="tveil" id="t-veil" hidden>Cartes cachées — clique ou appuie sur H pour les voir</button></div>
      <p class="tpill" id="t-pill" hidden>À toi de jouer</p>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="r-modal" id="tm-end" data-sticky="1" hidden><div class="r-sheet r-paper tsum" id="tm-end-c"></div></div>
      <div class="r-modal" id="tm-sheet" hidden><div class="r-sheet r-paper" style="width:min(760px,100%)"><button class="r-close" data-rclose>&times;</button><h2>La marque</h2><div style="overflow-x:auto" id="tm-sheet-c"></div></div></div>
      <div class="r-modal" id="tm-last" hidden><div class="r-sheet r-paper"><button class="r-close" data-rclose>&times;</button><h2>Dernier pli</h2><div class="ltrow" id="tm-last-c"></div><p class="r-dim-ink" id="tm-last-w"></p></div></div>`);
    const $ = (s) => document.querySelector(s);
    $('#t-carnet').onclick = () => openSheet(api);
    $('#t-sheet').onclick = () => openSheet(api);
    $('#t-last').onclick = () => openLast(api);
    $('#t-veil').onclick = () => api.setHidden(false);
    $('#t-hand').addEventListener('click', (e) => onHandClick(e, api));
    $('#t-center').addEventListener('click', (e) => onCenterClick(e, api));
    $('#t-poig').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) api.act({ type: 'poignee', size: Number(b.dataset.p) }); });
    $('#tm-end').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'ready') api.act({ type: 'ready' });
      else if (b.dataset.a === 'again') api.host('newGame');
      else if (b.dataset.a === 'lobby') api.host('toLobby');
      else if (b.dataset.a === 'sheet') openSheet(api);
    });
    window.addEventListener('resize', () => { cw = 0; if (api.msg() && api.msg().game) { document.getElementById('t-trick').innerHTML = ''; api.rerender(); } });
    ui.built = true;
  }

  let cw = 0;
  function measure() {
    if (cw) return cw;
    const p = document.createElement('div'); p.className = 'card'; p.style.visibility = 'hidden';
    document.getElementById('tt').appendChild(p); cw = p.offsetWidth || 80; p.remove(); return cw;
  }

  // ---------------------------------------------------------------
  function render(msg, api) {
    if (!ui.built) build(api);
    const g = msg.game;
    const me = g.mine;
    const base = me == null ? 0 : me;
    const pos = (s) => SLOTS[g.n][(s - base + g.n) % g.n];
    renderCarnet(g, api, me);
    renderContract(g, api);
    renderSeats(g, api, pos, me);
    renderTrick(g, pos);
    renderCenter(g, api, me);
    renderHand(g, api, me);
    renderModal(g, api, me);
    document.getElementById('t-last').disabled = !g.lastTrick;
  }

  function renderCarnet(g, api, me) {
    const order = g.names.map((n, i) => i).sort((a, b) => g.scores[b] - g.scores[a]);
    document.getElementById('t-carnet').innerHTML = order.map((i) => `<span class="crow${i === me ? ' me' : ''}"><span class="nm">${esc(g.names[i])}</span><b>${g.scores[i] > 0 ? '+' : ''}${g.scores[i]}</b></span>`).join('') +
      `<span class="cdeal">donne ${Math.min(g.deal, g.totalDeals)} / ${g.totalDeals}</span>`;
  }

  function renderContract(g, api) {
    const el = document.getElementById('t-contract');
    if (!g.contract) { el.hidden = true; return; }
    el.hidden = false;
    const bidding = g.phase === 'bidding';
    let h = `<div class="cl">${bidding ? 'Enchère en cours' : 'Contrat'}</div><div class="cv">${T.LEVELS[g.contract.level]}</div><div class="cb">${esc(g.names[g.contract.seat])}</div>`;
    if (g.called) h += `<div class="cc">appelle le ${calledLabel(g.called)}${g.partnerRevealed ? (g.partner === g.contract.seat || g.partner == null ? ' — seul' : ' — ' + esc(g.names[g.partner])) : ''}</div>`;
    if (g.chelem) h += '<div class="cc"><b>Chelem annoncé</b></div>';
    el.innerHTML = h;
  }

  function lastBid(g, s) { for (let i = g.bids.length - 1; i >= 0; i--) if (g.bids[i].seat === s) return g.bids[i]; return null; }

  function renderSeats(g, api, pos, me) {
    const wrap = document.getElementById('t-seats');
    const now = Date.now();
    let next = Infinity, h = '';
    for (let s = 0; s < g.n; s++) {
      const p = api.playerOf(s);
      const tags = [];
      if (g.dealer === s) tags.push('<span class="tag lt">Donneur</span>');
      if (g.contract && g.phase !== 'bidding' && g.contract.seat === s) tags.push('<span class="tag hl">Preneur</span>');
      if (g.partnerRevealed && g.partner === s && g.partner !== g.contract.seat) tags.push('<span class="tag hl">Partenaire</span>');
      if (p && (p.isBot || p.botControl)) tags.push('<span class="tag">Robot</span>');
      if (p && !p.connected) tags.push('<span class="tag" style="background:#a33">Hors ligne</span>');
      const turn = (g.waiting || []).includes(s);
      let bubble = '';
      const f = ui.flash[s];
      if (f && f.until > now) { bubble = `<span class="bubble ${f.cls || ''}">${f.html}</span>`; next = Math.min(next, f.until); }
      else if (g.phase === 'bidding' || g.phase === 'redeal') {
        const b = lastBid(g, s);
        if (b) bubble = `<span class="bubble${b.level ? '' : ''}">${b.level ? T.LEVELS[b.level] : 'Passe'}</span>`;
      }
      const sub = g.phase === 'playing' || g.phase === 'dealEnd' ? `<span class="sub">${g.tricksBy[s]} pli${g.tricksBy[s] > 1 ? 's' : ''}</span>` : '';
      h += `<div class="tseat pos-${pos(s)}"><div class="plate${turn ? ' turn' : ''}${p && !p.connected ? ' off' : ''}" style="--pc:var(--p${s})"><span class="r-av${p && p.isBot ? ' bot' : ''}">${esc((g.names[s] || '?')[0].toUpperCase())}</span><span><span class="pn">${esc(g.names[s])}${s === me ? ' (toi)' : ''}</span> ${sub}</span>${tags.length ? '<span class="tags">' + tags.join('') + '</span>' : ''}</div>${bubble}</div>`;
    }
    wrap.innerHTML = h;
    clearTimeout(ui.flashTimer);
    if (next < Infinity) ui.flashTimer = setTimeout(() => api.rerender(), next - now + 30);
  }

  function geom(n) {
    const w = measure(), hgt = w * 1.395, W = window.innerWidth, H = window.innerHeight;
    const to = { bottom: [0, hgt * .36], top: [0, -hgt * .36], left: [-w * .7, 0], right: [w * .7, 0], topleft: [-w * .5, -hgt * .3], topright: [w * .5, -hgt * .3] };
    const from = { bottom: [0, H * .45], top: [0, -H * .45], left: [-W * .45, 0], right: [W * .45, 0], topleft: [-W * .25, -H * .45], topright: [W * .25, -H * .45] };
    return { to, from };
  }
  let sweepT;
  function renderTrick(g, pos) {
    const el = document.getElementById('t-trick');
    const geo = geom(g.n);
    if (!g.trick.length) {
      const kids = Array.from(el.children);
      if (kids.length && g.lastTrick && !el.dataset.sw && kids.every((k) => g.lastTrick.cards.some((c) => c.card === k.dataset.card))) {
        el.dataset.sw = '1';
        const [wx, wy] = geo.from[pos(g.lastTrick.winner)];
        kids.forEach((k) => { k.style.setProperty('--wx', wx + 'px'); k.style.setProperty('--wy', wy + 'px'); k.classList.remove('enter'); });
        requestAnimationFrame(() => kids.forEach((k) => k.classList.add('sweep')));
        clearTimeout(sweepT); sweepT = setTimeout(() => { el.innerHTML = ''; delete el.dataset.sw; }, 520);
      } else if (!el.dataset.sw) el.innerHTML = '';
      return;
    }
    clearTimeout(sweepT); delete el.dataset.sw;
    const keys = g.trick.map((t) => t.card);
    Array.from(el.children).forEach((k) => { if (!keys.includes(k.dataset.card) || k.classList.contains('sweep')) k.remove(); });
    g.trick.forEach(({ seat, card }, i) => {
      let c = el.querySelector('[data-card="' + card + '"]');
      if (!c) {
        c = cardEl(card, 'enter');
        const p = pos(seat);
        const [tx, ty] = geo.to[p], [fx, fy] = geo.from[p];
        c.style.setProperty('--tx', tx + 'px'); c.style.setProperty('--ty', ty + 'px');
        c.style.setProperty('--fx', fx + 'px'); c.style.setProperty('--fy', fy + 'px');
        c.style.setProperty('--rot', ((card.charCodeAt(1) * 7 + card.charCodeAt(2) * 3) % 11 - 5) + 'deg');
        c.style.zIndex = i + 1;
        el.appendChild(c);
      }
      c.classList.toggle('win', g.trickDone && g.trickWinner === seat);
    });
  }

  // ----- Panneaux centraux -----
  function renderCenter(g, api, me) {
    const el = document.getElementById('t-center');
    let h = '', key = g.phase + '|' + (g.waiting || []).join(',') + '|' + g.bids.length;
    const name = (s) => esc(g.names[s]);
    if (g.phase === 'bidding') {
      if (g.bidTurn === me) {
        const best = g.contract ? g.contract.level : 0;
        h = `<div class="tpanel"><h3>À toi de parler${g.contract ? ' — ' + T.LEVELS[best] + ' par ' + name(g.contract.seat) : ''}</h3><div class="row">
          <button class="lvl" data-bid="0">Passe<small>&nbsp;</small></button>
          ${[1, 2, 3, 4].map((l) => `<button class="lvl" data-bid="${l}"${l <= best ? ' disabled' : ''}>${T.LEVELS[l]}<small>× ${T.MULT[l]}</small></button>`).join('')}
        </div></div>`;
      } else h = `<p class="cmsg">${name(g.bidTurn)} réfléchit…</p>`;
    } else if (g.phase === 'redeal') h = `<p class="cmsg">${esc(g.info || 'On redistribue')}</p>`;
    else if (g.phase === 'call') {
      if (g.callOptions) h = `<div class="tpanel"><h3>Appelle un partenaire</h3><p>Celui qui a cette carte joue avec toi (en secret jusqu'à ce qu'elle tombe).</p><div class="calls">${g.callOptions.map((c) => `<button data-call="${c}">${cardHtml(c)}</button>`).join('')}</div></div>`;
      else h = `<p class="cmsg">${name(g.contract.seat)} appelle un partenaire…</p>`;
    } else if (g.phase === 'chien') {
      h = `<div class="tpanel"><h3>Le chien</h3><div class="chienrow">${(g.chien || []).map((c) => cardHtml(c)).join('')}</div><p>${name(g.contract.seat)} le prend et va faire son écart.</p></div>`;
    } else if (g.phase === 'ecart') {
      if (g.contract.seat === me) {
        const need = g.chienCount;
        h = `<div class="tpanel"><h3>Fais ton écart : <span id="t-ecount">0</span> / ${need}</h3><p>Choisis ${need} cartes dans ta main. Pas de roi ni de bout ; un atout seulement si tu n'as pas le choix.</p>
          <label class="r-check" style="margin:0"><input type="checkbox" id="t-chelem"${ui.chelem ? ' checked' : ''}> Annoncer le chelem (faire tous les plis)</label>
          <button class="r-btn r-btn-accent" data-ecart="1" disabled>Valider l'écart</button></div>`;
      } else h = `<p class="cmsg">${name(g.contract.seat)} fait son écart…</p>`;
    } else if (g.phase === 'annonce') {
      if (g.contract.seat === me) h = `<div class="tpanel"><h3>${T.LEVELS[g.contract.level]}</h3><p>${g.contract.level === 3 ? 'Le chien reste caché et compte pour toi.' : 'Le chien reste caché et compte pour la défense.'}</p><div class="row"><button class="r-btn r-btn-accent" data-annonce="0">Commencer à jouer</button><button class="r-btn r-btn-ghost" data-annonce="1">Annoncer le chelem</button></div></div>`;
      else h = `<p class="cmsg">${name(g.contract.seat)} se prépare…</p>`;
    } else if (g.phase === 'playing' && !g.trick.length && g.tricksPlayed === 0 && g.turn !== me) h = `<p class="cmsg">${name(g.turn)} entame</p>`;
    key += h.length;
    if (el.dataset.key !== key) { el.dataset.key = key; el.innerHTML = h; }
    const ec = document.getElementById('t-ecount');
    if (ec) { ec.textContent = ui.sel.size; el.querySelector('[data-ecart]').disabled = ui.sel.size !== g.chienCount; }
    // Poignée
    const pg = document.getElementById('t-poig');
    if (g.poigneeOptions && g.poigneeOptions.length) {
      pg.hidden = false;
      pg.innerHTML = 'Tu peux annoncer :' + g.poigneeOptions.map((k) => `<button class="r-btn r-btn-accent r-btn-sm" data-p="${k}">${T.POIGNEE_NAME[k]} (${T.POIGNEE[g.n][k - 1]})</button>`).join('');
    } else pg.hidden = true;
    document.getElementById('t-pill').hidden = !(g.phase === 'playing' && g.turn === me && !g.trickDone);
  }

  function onCenterClick(e, api) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.bid != null) api.act({ type: 'bid', level: Number(b.dataset.bid) });
    else if (b.dataset.call) api.act({ type: 'call', card: b.dataset.call });
    else if (b.dataset.annonce != null) api.act({ type: 'annonce', chelem: b.dataset.annonce === '1' });
    else if (b.dataset.ecart) {
      const ch = document.getElementById('t-chelem');
      api.act({ type: 'ecart', cards: Array.from(ui.sel), chelem: !!(ch && ch.checked) });
    }
  }
  document.addEventListener('change', (e) => { if (e.target.id === 't-chelem') ui.chelem = e.target.checked; });

  // ----- Main -----
  function sortHand(hand) {
    const order = { T: 0, S: 1, H: 2, C: 3, D: 4, E: 5 };
    return hand.slice().sort((a, b) => {
      const sa = a === 'EX' ? 'E' : a[0], sb = b === 'EX' ? 'E' : b[0];
      return order[sa] - order[sb] || T.rankOf(b) - T.rankOf(a);
    });
  }
  function ecartOk(g, c) {
    if (T.isOudler(c) || (!T.isTrump(c) && T.rankOf(c) === 14)) return false;
    if (!T.isTrump(c)) return true;
    const plain = g.hand.filter((x) => !T.isTrump(x) && x !== 'EX' && T.rankOf(x) !== 14);
    return plain.length < g.chienCount;
  }

  function renderHand(g, api, me) {
    const el = document.getElementById('t-hand');
    if (!g.hand) { el.innerHTML = ''; return; }
    const sorted = sortHand(g.hand);
    const dealKey = g.deal + '/' + (g.phase === 'redeal' ? 'r' : '');
    const fresh = ui.handDeal !== g.deal;
    if (fresh) { el.innerHTML = ''; ui.handDeal = g.deal; ui.sel.clear(); ui.pending = null; ui.chelem = false; }
    const existing = new Map(Array.from(el.children).map((c) => [c.dataset.card, c]));
    for (const [k, c] of existing) if (!sorted.includes(k)) { c.remove(); ui.sel.delete(k); }
    sorted.forEach((card, i) => {
      let c = existing.get(card);
      if (!c) {
        c = cardEl(card);
        if (fresh) { c.classList.add('deal'); c.style.animationDelay = (i * 35) + 'ms'; c.addEventListener('animationend', () => c.classList.remove('deal'), { once: true }); }
      }
      el.appendChild(c);
    });
    const play = g.phase === 'playing' && g.turn === me && !g.trickDone && !!g.legal && !api.hidden();
    const pick = g.phase === 'ecart' && g.contract && g.contract.seat === me && !api.hidden();
    el.classList.toggle('play', play);
    el.classList.toggle('pick', pick);
    const chien = g.chienCards || [];
    Array.from(el.children).forEach((c) => {
      const k = c.dataset.card;
      const ok = play ? g.legal.includes(k) : pick ? ecartOk(g, k) : false;
      c.classList.toggle('ok', ok);
      c.classList.toggle('no', (play || pick) && !ok);
      c.classList.toggle('sel', pick && ui.sel.has(k));
      c.classList.toggle('new', pick && chien.includes(k));
    });
    document.getElementById('t-veil').hidden = !api.hidden();
    layout(el);
  }
  function layout(el) {
    const cards = Array.from(el.children), n = cards.length;
    if (!n) return;
    const w = measure();
    // Téléphone : au-delà de 12 cartes, la main passe sur deux rangées pour rester lisible
    const two = window.innerWidth < 640 && n > 12;
    el.parentElement.classList.toggle('two', two);
    document.getElementById('tt').classList.toggle('two-rows', two);
    if (two) {
      const per = Math.ceil(n / 2);
      const avail2 = window.innerWidth - 24;
      cards.forEach((c, i) => {
        const row = i < per ? 0 : 1, k = row ? n - per : per, j = row ? i - per : i;
        const sp = k > 1 ? Math.min(w * .78, (avail2 - w) / (k - 1)) : 0;
        c.style.setProperty('--x', (j - (k - 1) / 2) * sp + 'px');
        c.style.setProperty('--y', (row ? 0 : -w * 1.395 * .62) + 'px');
        c.style.setProperty('--r', '0deg');
        c.style.zIndex = (row ? 100 : 0) + j + 1;
      });
      return;
    }
    const avail = Math.min(window.innerWidth - 40, w * 11);
    const sp = n > 1 ? Math.min(w * .62, (avail - w) / (n - 1)) : 0;
    cards.forEach((c, i) => {
      const d = i - (n - 1) / 2;
      c.style.setProperty('--x', d * sp + 'px');
      c.style.setProperty('--y', (d * d * w * (n > 18 ? .004 : .007)) + 'px');
      c.style.setProperty('--r', (d * (n > 18 ? 1.1 : 1.6)) + 'deg');
      c.style.zIndex = i + 1;
    });
  }
  function onHandClick(e, api) {
    const c = e.target.closest('.card'); if (!c || api.hidden()) return;
    const msg = api.msg(); const g = msg && msg.game; if (!g) return;
    const k = c.dataset.card;
    if (g.phase === 'ecart' && g.contract.seat === g.mine) {
      if (!c.classList.contains('ok')) { api.toast('Interdit d\'écarter un roi ou un bout (atout seulement si pas le choix).'); return; }
      if (ui.sel.has(k)) ui.sel.delete(k); else if (ui.sel.size < g.chienCount) ui.sel.add(k);
      api.rerender();
      return;
    }
    if (g.phase === 'playing' && g.turn === g.mine && g.legal) {
      if (!g.legal.includes(k)) {
        const lead = g.trick.find((t) => t.card !== 'EX');
        api.toast(lead ? 'Carte interdite : ' + (lead.card[0] === 'T' ? 'il faut monter à l\'atout.' : 'il faut fournir, sinon couper.') : 'Carte interdite.');
        return;
      }
      if (ui.pending === k) return;
      ui.pending = k;
      api.act({ type: 'play', card: k });
    }
  }

  // ----- Fin de donne / partie -----
  function renderModal(g, api, me) {
    const m = document.getElementById('tm-end');
    if (g.phase !== 'dealEnd' && g.phase !== 'gameEnd') { m.hidden = true; return; }
    m.hidden = false;
    const r = g.lastDeal;
    const n = (s) => esc(g.names[s]);
    let h = '';
    if (g.phase === 'gameEnd') {
      const order = g.names.map((_, i) => i).sort((a, b) => g.scores[b] - g.scores[a]);
      h += `<p class="r-dim-ink" style="margin:0">Partie terminée</p><h2>${order[0] === me ? 'Victoire !' : 'Victoire de ' + n(order[0])}</h2><ol class="rank">${order.map((i) => `<li><span>${n(i)}${i === me ? ' (toi)' : ''}</span><span>${g.scores[i] > 0 ? '+' : ''}${g.scores[i]}</span></li>`).join('')}</ol>`;
    }
    const partnerTxt = g.n === 5 ? (r.partner == null || r.partner === r.taker ? ' — seul' : ' avec ' + n(r.partner)) : '';
    h += `<div><span class="stamp${r.made ? ' ok' : ''}">${r.made ? 'Contrat réussi' : 'Chuté'}</span></div>
      <p style="margin:4px 0 0"><b>${n(r.taker)}</b> — ${T.LEVELS[r.level]} (× ${r.mult})${partnerTxt}</p>
      <table><tbody>
        <tr><td>Bouts</td><td>${r.oudlers} → il fallait ${r.required} points</td></tr>
        <tr><td>Points de l'attaque</td><td>${r.points} <span class="calc">(défense ${r.defense})</span></td></tr>
        <tr><td class="calc">(25 + ${r.diff}) × ${r.mult}</td><td class="${r.made ? 'plus' : 'minus'}">${r.made ? '+' : '−'}${r.base}</td></tr>
        ${r.petit ? `<tr><td>Petit au bout (${r.petitCamp === 'A' ? 'attaque' : 'défense'})</td><td class="${r.petit > 0 ? 'plus' : 'minus'}">${r.petit > 0 ? '+' : '−'}${Math.abs(r.petit)}</td></tr>` : ''}
        ${r.poignees.length ? `<tr><td>${r.poignees.map((p) => T.POIGNEE_NAME[p.size] + ' (' + n(p.seat) + ')').join(', ')}</td><td class="${r.made ? 'plus' : 'minus'}">${r.made ? '+' : '−'}${r.pBonus}</td></tr>` : ''}
        ${r.chelem ? `<tr><td>${esc(r.chelemTxt)}</td><td class="${r.chelem > 0 ? 'plus' : 'minus'}">${r.chelem > 0 ? '+' : '−'}${Math.abs(r.chelem)}</td></tr>` : ''}
        <tr><td><b>Par défenseur</b></td><td>${-r.s > 0 ? '+' : ''}${-r.s}</td></tr>
      </tbody></table>
      <table><tbody>${g.names.map((_, i) => `<tr><td>${n(i)}${i === me ? ' (toi)' : ''}</td><td class="${r.delta[i] >= 0 ? 'plus' : 'minus'}">${r.delta[i] > 0 ? '+' : ''}${r.delta[i]} <span class="calc">→ ${r.scores[i]}</span></td></tr>`).join('')}</tbody></table>`;
    if (r.ecart) h += `<p class="calc" style="margin:0">Chien : ${r.chien.map((c) => esc(T.cardLabel(c))).join(', ')}</p>`;
    if (g.phase === 'dealEnd') {
      const humans = api.players().filter((p) => p.gseat != null && !p.isBot && !p.botControl && p.connected);
      const ready = humans.filter((p) => g.ready.includes(p.gseat)).length;
      const iReady = me != null && g.ready.includes(me);
      h += `<div class="tfoot"><span class="dim">${ready} / ${humans.length} prêt${ready > 1 ? 's' : ''}</span><button class="r-btn r-btn-ink" data-a="sheet">Marque</button>${me != null ? `<button class="r-btn r-btn-accent r-btn-big" data-a="ready"${iReady ? ' disabled' : ''}>${iReady ? 'En attente…' : 'Donne suivante'}</button>` : ''}</div>`;
    } else {
      h += `<div class="tfoot"><button class="r-btn r-btn-ink" data-a="sheet">Marque</button>${api.isHost() ? '<button class="r-btn r-btn-ink" data-a="lobby">Retour au salon</button><button class="r-btn r-btn-accent r-btn-big" data-a="again">Nouvelle partie</button>' : '<span class="dim">L\'hôte peut relancer une partie.</span>'}</div>`;
    }
    const c = document.getElementById('tm-end-c');
    if (c.dataset.h !== h) { c.dataset.h = h; c.innerHTML = h; }
  }

  function openSheet(api) {
    const g = api.msg().game;
    let h = `<table class="sheet-tbl"><thead><tr><th>Donne</th>${g.names.map((n) => `<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>`;
    if (!g.history.length) h += `<tr><td colspan="${g.n + 1}">Aucune donne terminée.</td></tr>`;
    g.history.forEach((r) => {
      h += `<tr><td>${r.deal}. ${esc(g.names[r.taker])} — ${T.LEVELS[r.level]} ${r.made ? '✓' : '✗'}</td>${r.delta.map((d) => `<td>${d > 0 ? '+' : ''}${d}</td>`).join('')}</tr>`;
    });
    h += `</tbody><tfoot><tr><td>Total</td>${g.scores.map((s) => `<td>${s}</td>`).join('')}</tr></tfoot></table>`;
    document.getElementById('tm-sheet-c').innerHTML = h;
    document.getElementById('tm-sheet').hidden = false;
  }
  function openLast(api) {
    const g = api.msg().game;
    if (!g.lastTrick) return;
    document.getElementById('tm-last-c').innerHTML = g.lastTrick.cards.map((x) => `<div class="lt${x.seat === g.lastTrick.winner ? ' win' : ''}">${cardHtml(x.card)}<span>${esc(g.names[x.seat])}</span></div>`).join('');
    document.getElementById('tm-last-w').textContent = 'Remporté par ' + g.names[g.lastTrick.winner] + '.';
    document.getElementById('tm-last').hidden = false;
  }

  function onEvent(ev, msg, api) {
    const g = msg.game, now = Date.now();
    const S = api.Sound;
    if (ev.type === 'play') S.play('card');
    else if (ev.type === 'deal') S.play('deal');
    else if (ev.type === 'trickwin') setTimeout(() => S.play('trick'), 500);
    else if (ev.type === 'contract') S.play('alert');
    else if (ev.type === 'info') api.toast(ev.text, 3200);
    else if (ev.type === 'call') api.toast(g.names[ev.seat] + ' appelle le ' + (({ 14: 'Roi', 13: 'Dame', 12: 'Cavalier', 11: 'Valet' })[T.rankOf(ev.card)]) + ' de ' + T.SUIT_NAME[ev.card[0]].toLowerCase(), 3200);
    else if (ev.type === 'ecart' && ev.trumps && ev.trumps.length) api.toast(g.names[ev.seat] + ' écarte de l\'atout : ' + ev.trumps.map((c) => T.rankOf(c)).join(', '), 3500);
    else if (ev.type === 'ecart' && ev.chelem) api.toast(g.names[ev.seat] + ' annonce le chelem !', 3200);
    else if (ev.type === 'poignee') {
      S.play('alert');
      const f = document.getElementById('t-flash');
      f.innerHTML = `<p>${esc(g.names[ev.seat])} annonce une ${T.POIGNEE_NAME[ev.size].toLowerCase()}</p><div class="flashrow">${ev.cards.map((c) => cardHtml(c)).join('')}</div>`;
      f.hidden = false;
      clearTimeout(ui.ft); ui.ft = setTimeout(() => { f.hidden = true; }, 5000);
      ui.flash[ev.seat] = { html: T.POIGNEE_NAME[ev.size], cls: 'gold', until: now + 4000 };
    } else if (ev.type === 'dealend') {
      const r = g.lastDeal;
      if (r) {
        const my = g.myCamp;
        const att = r.made;
        if (my) S.play((my === 'A') === att ? 'good' : 'bad');
        const lt = g.lastTrick;
        if (r.petit) api.toast('Petit au bout !', 2500);
      }
    } else if (ev.type === 'chat') {
      const p = api.players().find((x) => x.pid === ev.pid);
      if (p && p.gseat != null) ui.flash[p.gseat] = { html: esc(ev.text), cls: '', until: now + 4500 };
    }
  }

  // Vue spectateur (/spec) : les mains de tout le monde
  function spyRows(g) {
    const mini = (c) => '<span class="mc" title="' + esc(T.cardLabel(c)) + '">' + C.cardInner(c) + '</span>';
    let h = '';
    for (let s = 0; s < g.n; s++) {
      const tags = [];
      if (g.contract && g.contract.seat === s) tags.push('<span class="tag hl">Preneur</span>');
      if (g.spyPartner != null && g.spyPartner === s && g.contract && g.spyPartner !== g.contract.seat) tags.push('<span class="tag hl">Partenaire</span>');
      h += '<div class="sp-row"><b>' + esc(g.names[s]) + ' ' + tags.join('') + '</b><div class="sp-cards">' + sortHand(g.allHands[s]).map(mini).join('') + '</div></div>';
    }
    const ch = g.contract && g.contract.level <= 2 && g.phase !== 'bidding' && g.phase !== 'call' && g.phase !== 'chien' ? g.spyEcart : g.spyChien;
    if (ch && ch.length) h += '<div class="sp-row"><b>' + (ch === g.spyEcart ? 'Écart' : 'Chien') + '</b><div class="sp-cards">' + sortHand(ch).map(mini).join('') + '</div></div>';
    return h;
  }

  function hero() {
    return '<div class="tfan">' + ['T01', 'T21', 'EX', 'H14', 'S12'].map((c, i) => `<div class="card" style="--r:${(i - 2) * 11}deg">${C.cardInner(c)}</div>`).join('') + '</div>';
  }

  const rules = `
    <h3>Les cartes</h3><p>78 cartes : 4 couleurs de 14 cartes (1 à 10, Valet, Cavalier, Dame, Roi), 21 atouts et l'Excuse. Les trois <b>bouts</b> sont le 1 d'atout (le Petit), le 21 et l'Excuse.</p>
    <table><tr><th>Bout, Roi</th><th>Dame</th><th>Cavalier</th><th>Valet</th><th>Autres</th></tr><tr><td>4,5</td><td>3,5</td><td>2,5</td><td>1,5</td><td>0,5</td></tr></table>
    <p>Total : 91 points. Distribution : 24 cartes chacun à 3 (chien de 6), 18 à 4 (chien de 6), 15 à 5 (chien de 3). Petit sec : on redistribue.</p>
    <h3>Les enchères</h3><p>Chacun parle une fois, en commençant à droite du donneur : Passe, <b>Prise</b> (×1), <b>Garde</b> (×2), <b>Garde sans</b> le chien (×4), <b>Garde contre</b> le chien (×6). Chaque annonce doit être plus forte que la précédente. Si tout le monde passe, on redistribue.</p>
    <p>À la Prise et à la Garde, le chien est montré à tous ; le preneur le prend et fait un écart (ni roi, ni bout ; un atout seulement s'il n'a pas le choix, et il est alors montré). Garde sans : le chien compte pour le preneur sans être vu. Garde contre : il compte pour la défense.</p>
    <p>À 5 joueurs, le preneur appelle un roi (ou une dame s'il a les 4 rois) : celui qui l'a devient son partenaire, en secret jusqu'à ce que la carte soit jouée. S'il s'appelle lui-même, il joue seul contre 4.</p>
    <h3>Le jeu</h3><p>Il faut fournir à la couleur demandée. Sinon il faut couper, et surcouper si un atout a déjà été joué (ou sous-couper si on ne peut pas monter). À l'atout, il faut monter si on peut. L'Excuse peut être jouée à tout moment : elle ne gagne pas le pli et revient à son camp (qui donne une carte à 0,5 en échange), sauf jouée au dernier pli où elle est perdue.</p>
    <h3>Le décompte</h3><p>Le preneur doit faire 56 points sans bout, 51 avec 1 bout, 41 avec 2, 36 avec 3. Score = (25 + écart de points) × multiplicateur, plus les primes :</p>
    <ul><li><b>Petit au bout</b> (le 1 d'atout dans le dernier pli) : 10 × multiplicateur pour le camp qui gagne ce pli.</li>
    <li><b>Poignée</b> (à annoncer juste avant ta 1<sup>re</sup> carte) : simple 20, double 30, triple 40, gagnée par le camp qui remporte la donne. À 4 joueurs : 10, 13 et 15 atouts (13/15/18 à 3, 8/10/13 à 5).</li>
    <li><b>Chelem</b> (tous les plis) : annoncé et réussi +400, annoncé et chuté −200, non annoncé +200.</li></ul>
    <p>Le preneur marque ce score × 3 à 4 joueurs (× 2 à 3 joueurs ; à 5 : × 2 et son partenaire × 1, ou × 4 s'il est seul) ; chaque défenseur marque l'inverse. Le total fait toujours zéro.</p>`;

  window.SalleRoom.start({
    module: T.module, title: 'Tarot', prefix: 'T', themeClass: 'theme-tarot', hideable: true, soloPlayers: 4,
    tagline: 'Prise, garde, chien et petit au bout. De 3 à 5 joueurs.',
    hero: hero(), rulesHtml: rules, render, onEvent, spyRows,
    lobbyNote: 'On joue dans le sens inverse des aiguilles d\'une montre, dans l\'ordre des places.',
  });
})();
