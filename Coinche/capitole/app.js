/* Capitole — interface */
(function () {
  'use strict';
  const C = window.CapitoleEngine;
  const B = C.BOARD;
  const esc = window.SalleRoom.esc;
  const fmt = (x) => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';
  const ui = { built: false, disp: null, anim: null, cardUntil: 0, cardId: null, diceKey: null, tradeTo: null, openSq: null };

  const ICONS = {
    station: '<svg viewBox="0 0 48 48"><rect x="10" y="6" width="28" height="28" rx="6" fill="none" stroke="currentColor" stroke-width="3"/><path d="M10 22h28M17 34l-5 8M31 34l5 8" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="17" cy="28" r="2.4" fill="currentColor"/><circle cx="31" cy="28" r="2.4" fill="currentColor"/></svg>',
    plane: '<svg viewBox="0 0 48 48"><path d="M24 4c2 0 3 2 3 5v9l15 9v4l-15-4v9l5 4v3l-8-2-8 2v-3l5-4v-9L6 31v-4l15-9V9c0-3 1-5 3-5z" fill="currentColor"/></svg>',
    tram: '<svg viewBox="0 0 48 48"><path d="M18 6h12M24 6v6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><rect x="11" y="12" width="26" height="24" rx="8" fill="none" stroke="currentColor" stroke-width="3"/><path d="M11 24h26M18 36l-4 6M30 36l4 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    bolt: '<svg viewBox="0 0 48 48"><path d="M27 4 11 27h11l-3 17 18-25H25z" fill="currentColor"/></svg>',
    drop: '<svg viewBox="0 0 48 48"><path d="M24 5C18 15 11 22 11 30a13 13 0 0 0 26 0c0-8-7-15-13-25z" fill="currentColor"/></svg>',
    hasard: '<svg viewBox="0 0 48 48"><text x="24" y="38" text-anchor="middle" font-family="Georgia,serif" font-size="38" font-weight="700" fill="currentColor">?</text></svg>',
    quartier: '<svg viewBox="0 0 48 48"><path d="M6 24 24 8l18 16v18H30V30H18v12H6z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/></svg>',
    tax: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M29 17a8 8 0 1 0 0 14M14 22h12M14 27h12" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/></svg>',
    go: '<svg viewBox="0 0 48 48"><path d="M42 24H8m12-12L8 24l12 12" stroke="#c0392b" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    jail: '<svg viewBox="0 0 48 48"><rect x="6" y="6" width="36" height="36" rx="3" fill="#ec8b2e"/><path d="M14 6v36M22 6v36M30 6v36M38 6v36" stroke="#2a1712" stroke-width="3"/></svg>',
    free: '<svg viewBox="0 0 48 48"><circle cx="24" cy="19" r="12" fill="#2f9a55"/><circle cx="16" cy="24" r="8" fill="#3fae64"/><circle cx="32" cy="24" r="8" fill="#3fae64"/><rect x="22" y="28" width="4" height="14" fill="#7a4a2a"/></svg>',
    police: '<svg viewBox="0 0 48 48"><path d="M24 4 8 10v12c0 10 7 18 16 22 9-4 16-12 16-22V10z" fill="#2b4c9b"/><path d="M24 14l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z" fill="#f5d999"/></svg>',
  };
  const iconFor = (b, i) => b.type === 'station' ? (i === 35 ? ICONS.plane : i === 25 ? ICONS.tram : ICONS.station) : b.type === 'util' ? (i === 12 ? ICONS.bolt : ICONS.drop) : ICONS[b.type] || '';
  const FACADE = '<svg viewBox="0 0 300 110" class="facade" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3"><path d="M20 40 150 8l130 32z"/><path d="M10 44h280M10 102h280M14 96h272"/>' +
    Array.from({ length: 8 }, (_, k) => `<path d="M${40 + k * 31} 48v44M${50 + k * 31} 48v44"/>`).join('') + '<circle cx="150" cy="28" r="7"/></g></svg>';

  function gridPos(i) {
    if (i <= 10) return { r: 11, c: 11 - i, side: 'b' };
    if (i <= 20) return { r: 11 - (i - 10), c: 1, side: 'l' };
    if (i <= 30) return { r: 1, c: 1 + (i - 20), side: 't' };
    return { r: 1 + (i - 30), c: 11, side: 'r' };
  }

  function build(api) {
    let h = '';
    B.forEach((b, i) => {
      const p = gridPos(i);
      const corner = i % 10 === 0;
      const side = corner ? 'b' : p.side;
      const name = i === 10 ? 'Prison<br><small>Saint-Michel</small>' : esc(b.name);
      h += `<div class="sq side-${side}${corner ? ' corner' : ''}" data-i="${i}" style="grid-area:${p.r}/${p.c}">` +
        (b.type === 'prop' ? `<div class="band" style="background:${C.G[b.group]}"></div>` : '') +
        `<div class="body"><span class="nm">${name}</span>${b.type !== 'prop' ? `<span class="ico">${corner ? (b.type === 'gotojail' ? ICONS.police : ICONS[b.type]) : iconFor(b, i)}</span>` : ''}${b.price ? `<span class="pr">${b.price} €</span>` : b.amount ? `<span class="pr">${b.amount} €</span>` : ''}</div><div class="bld"></div></div>`;
    });
    document.getElementById('game-root').innerHTML = `<div class="croom">
      <div class="cboard-wrap"><div class="cboard" id="c-board">${h}
        <div class="ccenter">${FACADE}<p class="ctitle">Capitole</p>
          <div class="cmid"><div class="dice" id="c-dice"><div class="die"></div><div class="die"></div></div><div id="c-panel"></div></div>
          <div id="c-card"></div>
        </div></div><div class="pawns" id="c-pawns"></div></div>
      <aside class="cside">
        <div class="cpanel-m" id="c-panel2"></div>
        <div class="cinfo" id="c-info"></div>
        <div id="c-trade"></div>
        <div id="c-players"></div>
        <div class="cbtns"><button class="r-btn r-btn-accent" id="c-manage">Mes propriétés</button><button class="r-btn r-btn-ghost" id="c-tradeb">Proposer un échange</button></div>
        <ul class="clog" id="c-log"></ul>
      </aside></div>`;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="r-modal" id="cm-prop" hidden><div class="r-sheet r-paper" style="width:min(400px,100%)"><button class="r-close" data-rclose>&times;</button><div id="cm-prop-c"></div></div></div>
      <div class="r-modal" id="cm-manage" hidden><div class="r-sheet r-paper"><button class="r-close" data-rclose>&times;</button><h2>Mes propriétés</h2><p class="r-dim-ink" id="cm-manage-h"></p><div class="mlist" id="cm-manage-c"></div></div></div>
      <div class="r-modal" id="cm-trade" hidden><div class="r-sheet r-paper" style="width:min(640px,100%)"><button class="r-close" data-rclose>&times;</button><h2>Proposer un échange</h2><div id="cm-trade-c"></div></div></div>
      <div class="r-modal" id="cm-offer" data-sticky="1" hidden><div class="r-sheet r-paper"><div id="cm-offer-c"></div></div></div>
      <div class="r-modal" id="cm-end" data-sticky="1" hidden><div class="r-sheet r-paper"><div id="cm-end-c"></div></div></div>`);
    const $ = (s) => document.querySelector(s);
    $('#c-board').addEventListener('click', (e) => { const sq = e.target.closest('.sq'); if (sq) openProp(api, Number(sq.dataset.i)); });
    $('#c-panel').addEventListener('click', (e) => onPanel(e, api));
    $('#c-panel2').addEventListener('click', (e) => onPanel(e, api));
    $('#c-manage').onclick = () => openManage(api);
    $('#c-tradeb').onclick = () => openTrade(api, null);
    $('#c-trade').addEventListener('click', (e) => { if (e.target.closest('[data-cancel]')) api.act({ type: 'cancelTrade' }); });
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pa]');
      if (b) { api.act({ type: b.dataset.pa, sq: Number(b.dataset.sq) }); return; }
      const o = e.target.closest('[data-offer]');
      if (o) { api.act({ type: o.dataset.offer === 'yes' ? 'acceptTrade' : 'rejectTrade' }); return; }
      const t = e.target.closest('[data-tto]');
      if (t) { ui.tradeTo = Number(t.dataset.tto); fillTrade(api); return; }
      if (e.target.closest('#c-tsend')) sendTrade(api);
      const ea = e.target.closest('[data-ea]');
      if (ea) api.host(ea.dataset.ea);
      if (e.target.closest('[data-manage]')) openManage(api);
    });
    window.addEventListener('resize', () => placePawns(api.msg().game, true));
    ui.built = true;
  }

  // ---------------------------------------------------------------
  function render(msg, api) {
    if (!ui.built) build(api);
    const g = msg.game;
    renderBoard(g);
    renderSide(g, api);
    renderDice(g);
    renderPanel(g, api);
    renderCard(g);
    animatePawns(g);
    refreshModals(g, api);
    renderEnd(g, api);
  }

  function renderBoard(g) {
    document.querySelectorAll('#c-board .sq').forEach((el) => {
      const i = Number(el.dataset.i);
      const o = g.owner[i];
      let own = el.querySelector('.own');
      if (o != null) { if (!own) { own = document.createElement('div'); own.className = 'own'; el.appendChild(own); } own.style.setProperty('--oc', `var(--p${o})`); }
      else if (own) own.remove();
      el.classList.toggle('mort', !!g.mortgaged[i]);
      const h = g.houses[i];
      const bl = el.querySelector('.bld');
      const want = h === 5 ? '<i class="hotel"></i>' : '<i></i>'.repeat(h);
      if (bl.innerHTML !== want) bl.innerHTML = want;
    });
  }

  function renderSide(g, api) {
    const me = g.mine;
    document.getElementById('c-info').innerHTML = `<span>Tour <b>${g.round}</b>${g.maxRounds ? ' / ' + g.maxRounds : ''}</span><span>Maisons <b>${g.housesLeft}</b> · Hôtels <b>${g.hotelsLeft}</b></span>${g.potOn ? `<span>Cagnotte <b>${fmt(g.pot)}</b></span>` : ''}`;
    let h = '';
    for (let s = 0; s < g.n; s++) {
      const p = api.playerOf(s);
      const props = C.OWNABLE.filter((i) => g.owner[i] === s);
      const tags = [];
      if (g.inJail[s]) tags.push('<span class="tag" style="background:#ec8b2e;color:#2a1712">En prison</span>');
      if (g.jailCards[s]) tags.push(`<span class="tag lt">Libéré ×${g.jailCards[s]}</span>`);
      if (p && (p.isBot || p.botControl)) tags.push('<span class="tag">Robot</span>');
      if (p && !p.connected) tags.push('<span class="tag" style="background:#a33">Hors ligne</span>');
      if (g.bankrupt[s]) tags.push('<span class="tag">Faillite</span>');
      h += `<div class="cplayer${g.turn === s && !g.bankrupt[s] ? ' cur' : ''}${g.bankrupt[s] ? ' out' : ''}" style="--pc:var(--p${s})">
        <span class="r-av${p && p.isBot ? ' bot' : ''}" style="--pc:var(--p${s})">${esc(g.names[s][0].toUpperCase())}</span>
        <span><span class="nm">${esc(g.names[s])}${s === me ? ' (toi)' : ''} ${tags.join('')}</span></span>
        <span><div class="money">${fmt(g.cash[s])}</div><div class="wth">fortune ${fmt(g.worth[s])}</div></span>
        <span class="chips">${props.map((i) => `<i class="${g.mortgaged[i] ? 'm' : ''}" style="--c:${B[i].group ? C.G[B[i].group] : '#888'}" title="${esc(B[i].name)}"></i>`).join('')}</span></div>`;
    }
    document.getElementById('c-players').innerHTML = h;
    const log = document.getElementById('c-log');
    const lh = g.log.map((l) => `<li>${esc(l)}</li>`).join('');
    if (log.dataset.h !== lh) { log.dataset.h = lh; log.innerHTML = lh; log.scrollTop = 1e6; }
    // Échange en cours (côté proposeur)
    const t = g.trade;
    document.getElementById('c-trade').innerHTML = t && t.from === me ? `<div class="tradebar"><span>Échange proposé à ${esc(g.names[t.to])}…</span><button class="r-btn r-btn-ghost r-btn-sm" data-cancel="1">Annuler</button></div>` : '';
    document.getElementById('c-tradeb').disabled = me == null || g.bankrupt[me] || !!t || g.phase === 'gameEnd';
    document.getElementById('c-manage').disabled = me == null || g.bankrupt[me];
  }

  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function renderDice(g) {
    const el = document.getElementById('c-dice');
    const k = g.dice.join(',');
    el.querySelectorAll('.die').forEach((d, j) => {
      const v = g.dice[j] || 1;
      d.innerHTML = Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[v].includes(i) ? 'on' : ''}"></i>`).join('');
    });
    el.style.display = g.dice[0] ? '' : 'none';
  }

  function renderPanel(g, api) {
    const me = g.mine, el = document.getElementById('c-panel');
    const name = (s) => esc(g.names[s]);
    let h = '';
    if (g.phase === 'gameEnd') h = '';
    else if (g.phase === 'auction' && g.auction) {
      const A = g.auction, b = B[A.sq];
      const myTurn = A.active[A.idx] === me;
      h = `<div class="cpanel"><h3>Enchères : ${esc(b.name)}</h3><p>Prix de base ${fmt(b.price)} · offre actuelle <b style="color:var(--accent-hi)">${A.bidder != null ? fmt(A.bid) + ' (' + name(A.bidder) + ')' : 'aucune'}</b></p>`;
      if (myTurn) {
        const opts = [10, 50, 100].map((d) => A.bid + d).filter((v) => v <= g.cash[me]);
        h += `<div class="row">${opts.map((v) => `<button class="r-btn r-btn-accent" data-bid="${v}">${fmt(v)}</button>`).join('')}<input type="number" id="c-bidv" min="${A.bid + 1}" max="${g.cash[me]}" placeholder="Montant"><button class="r-btn r-btn-ghost" data-bid="custom">Enchérir</button></div><div class="row"><button class="r-btn r-btn-ghost" data-a="pass">Je passe</button></div>`;
      } else h += `<p>${name(A.active[A.idx])} réfléchit… (${A.active.map(name).join(', ')} encore en lice)</p>`;
      h += '</div>';
    } else if (g.phase === 'debt' && g.debt) {
      const D = g.debt;
      const toTxt = D.to === 'all' ? 'aux autres joueurs' : D.to === 'bank' || D.to === 'pot' || D.to == null ? 'à la banque' : 'à ' + name(D.to);
      if (D.seat === me) {
        const missing = Math.max(0, D.amount - g.cash[me]);
        h = `<div class="cpanel"><h3>Tu dois ${fmt(D.amount)} ${toTxt}</h3><p>${missing ? 'Il te manque ' + fmt(missing) + '. Vends des maisons ou hypothèque des rues (tu peux récupérer jusqu\'à ' + fmt(g.liquidity[me]) + ').' : 'Tu as de quoi payer.'}</p>
          <div class="row"><button class="r-btn r-btn-ghost" data-manage="1">Mes propriétés</button><button class="r-btn r-btn-accent" data-a="payDebt"${missing ? ' disabled' : ''}>Payer</button><button class="r-btn r-btn-red" data-a="giveUp">Faire faillite</button></div></div>`;
      } else h = `<p class="cstatus">${name(D.seat)} doit ${fmt(D.amount)} ${toTxt}…</p>`;
    } else if (g.turn === me && !g.bankrupt[me]) {
      if (g.phase === 'roll') {
        if (g.inJail[me]) h = `<div class="cpanel"><h3>Tu es en prison</h3><p>Essai ${g.jailTurns[me] + 1} sur 3 : fais un double pour sortir, ou paie.</p><div class="row"><button class="r-btn r-btn-accent" data-a="roll">Tenter un double</button><button class="r-btn r-btn-ghost" data-a="payJail"${g.cash[me] < 50 ? ' disabled' : ''}>Payer 50 €</button>${g.jailCards[me] ? '<button class="r-btn r-btn-ghost" data-a="useCard">Utiliser ma carte</button>' : ''}</div></div>`;
        else h = `<div class="cpanel"><h3>${g.rolledDouble ? 'Double ! Relance les dés' : 'À toi de jouer'}</h3><div class="row"><button class="r-btn r-btn-accent r-btn-big" data-a="roll">Lancer les dés</button></div></div>`;
      } else if (g.phase === 'buy') {
        const sq = g.pos[me], b = B[sq];
        h = `<div class="cpanel"><h3>${esc(b.name)}</h3><p>Personne ne possède ${b.type === 'prop' ? 'cette rue' : 'ce lieu'}. Tu as ${fmt(g.cash[me])}.</p><div class="row"><button class="r-btn r-btn-accent" data-a="buy"${g.cash[me] < b.price ? ' disabled' : ''}>Acheter ${fmt(b.price)}</button><button class="r-btn r-btn-ghost" data-a="decline">Ne pas acheter</button><button class="r-btn r-btn-ghost" data-sq="${sq}" data-info="1">Voir la fiche</button></div></div>`;
      } else if (g.phase === 'end') {
        h = `<div class="cpanel"><p>Tu peux construire, hypothéquer ou proposer un échange avant de passer la main.</p><div class="row"><button class="r-btn r-btn-ghost" data-manage="1">Mes propriétés</button><button class="r-btn r-btn-accent" data-a="endTurn">Terminer mon tour</button></div></div>`;
      }
    } else {
      const t = g.turn;
      h = `<p class="cstatus">${g.phase === 'buy' ? name(t) + ' hésite à acheter ' + esc(B[g.pos[t]].name) + '…' : g.phase === 'end' ? name(t) + ' termine son tour…' : g.inJail[t] ? name(t) + ' tente de sortir de prison…' : 'À ' + name(t) + ' de lancer les dés'}</p>`;
    }
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
    // copie du panneau sous le plateau (affichée seulement sur téléphone)
    const el2 = document.getElementById('c-panel2');
    const h2 = h.replace('id="c-bidv"', 'id="c-bidv2"');
    if (el2.dataset.h !== h2) { el2.dataset.h = h2; el2.innerHTML = h2; }
  }
  function onPanel(e, api) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.info) { openProp(api, Number(b.dataset.sq)); return; }
    if (b.dataset.bid) {
      const inp = b.closest('#c-panel2') ? document.getElementById('c-bidv2') : document.getElementById('c-bidv');
      const v = b.dataset.bid === 'custom' ? Number(inp.value) : Number(b.dataset.bid);
      if (v) api.act({ type: 'bid', amount: v });
      return;
    }
    if (b.dataset.a) api.act({ type: b.dataset.a });
  }

  function renderCard(g) {
    const el = document.getElementById('c-card');
    const c = g.lastCard;
    if (c && c.id !== ui.cardId) { ui.cardId = c.id; ui.cardUntil = Date.now() + 5200; clearTimeout(ui.cardT); ui.cardT = setTimeout(() => renderCard(g), 5300); }
    if (c && Date.now() < ui.cardUntil) {
      const h = `<div class="ccard ${c.deck}"><b>${c.deck === 'hasard' ? 'Hasard' : 'Quartier'}</b>${esc(c.text)}<p class="r-dim-ink" style="margin:.6em 0 0;font-size:.85em">${esc(g.names[c.seat])}</p></div>`;
      if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
    } else { el.innerHTML = ''; el.dataset.h = ''; }
  }

  // ----- Pions -----
  function sqCenter(i) {
    const el = document.querySelector('#c-board .sq[data-i="' + i + '"]');
    const wrap = document.getElementById('c-pawns').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - wrap.left + r.width / 2, y: r.top - wrap.top + r.height / 2, w: r.width, h: r.height };
  }
  function placePawns(g, now) {
    if (!g) return;
    const layer = document.getElementById('c-pawns');
    const groups = {};
    for (let s = 0; s < g.n; s++) if (!g.bankrupt[s]) { const p = ui.disp[s]; (groups[p] = groups[p] || []).push(s); }
    let h = '';
    for (const [p, ss] of Object.entries(groups)) {
      const c = sqCenter(Number(p));
      ss.forEach((s, k) => {
        const n = ss.length, ang = (k / n) * Math.PI * 2;
        const off = n > 1 ? Math.min(c.w, c.h) * 0.22 : 0;
        const jailOff = Number(p) === 10 && !g.inJail[s] ? { x: -c.w * 0.3, y: c.h * 0.3 } : { x: 0, y: 0 };
        h += `<div class="pawn${g.turn === s ? ' cur' : ''}" data-s="${s}" style="--pc:var(--p${s});left:${c.x + Math.cos(ang) * off + jailOff.x}px;top:${c.y + Math.sin(ang) * off + jailOff.y}px">${esc(g.names[s][0].toUpperCase())}</div>`;
      });
    }
    // garde les éléments pour que la transition joue
    const existing = new Map(Array.from(layer.children).map((x) => [x.dataset.s, x]));
    const tmp = document.createElement('div'); tmp.innerHTML = h;
    const keep = new Set();
    Array.from(tmp.children).forEach((nx) => {
      const old = existing.get(nx.dataset.s);
      keep.add(nx.dataset.s);
      if (old) { old.style.left = nx.style.left; old.style.top = nx.style.top; old.className = nx.className; }
      else layer.appendChild(nx);
    });
    for (const [k, x] of existing) if (!keep.has(k)) x.remove();
  }
  function animatePawns(g) {
    if (!ui.disp || ui.disp.length !== g.n) ui.disp = g.pos.slice();
    clearTimeout(ui.anim);
    const step = () => {
      let moving = false;
      for (let s = 0; s < g.n; s++) {
        if (ui.disp[s] === g.pos[s]) continue;
        const fwd = (g.pos[s] - ui.disp[s] + 40) % 40;
        if (ui.jump && ui.jump[s]) { ui.disp[s] = g.pos[s]; ui.jump[s] = false; continue; }
        ui.disp[s] = (ui.disp[s] + 1) % 40; moving = true;
      }
      placePawns(g);
      if (moving) ui.anim = setTimeout(step, 135);
    };
    step();
  }

  // ----- Fiches / gestion / échanges -----
  function propCard(g, i) {
    const b = B[i];
    const o = g.owner[i];
    let rows = '';
    if (b.type === 'prop') {
      const h = g.houses[i];
      const own = o != null && C.ownsGroup({ owner: g.owner }, o, b.group);
      rows = `<tr class="${o != null && h === 0 && !own ? 'cur' : ''}"><td>Terrain nu</td><td>${fmt(b.rent[0])}</td></tr><tr class="${o != null && h === 0 && own ? 'cur' : ''}"><td>Toute la couleur</td><td>${fmt(b.rent[0] * 2)}</td></tr>` +
        [1, 2, 3, 4].map((k) => `<tr class="${h === k ? 'cur' : ''}"><td>Avec ${k} maison${k > 1 ? 's' : ''}</td><td>${fmt(b.rent[k])}</td></tr>`).join('') +
        `<tr class="${h === 5 ? 'cur' : ''}"><td>Avec un hôtel</td><td>${fmt(b.rent[5])}</td></tr>`;
    } else if (b.type === 'station') rows = [1, 2, 3, 4].map((k) => `<tr><td>${k} ligne${k > 1 ? 's' : ''} possédée${k > 1 ? 's' : ''}</td><td>${fmt(25 * Math.pow(2, k - 1))}</td></tr>`).join('');
    else if (b.type === 'util') rows = '<tr><td>Une compagnie</td><td>4 × les dés</td></tr><tr><td>Les deux</td><td>10 × les dés</td></tr>';
    const color = b.group ? C.G[b.group] : b.type === 'station' ? '#3b3b3b' : '#5b6f7f';
    return `<div class="pcard" style="--gc:${color}"><div class="hd"><small>${b.type === 'prop' ? 'Titre de propriété' : b.type === 'station' ? 'Ligne de transport' : 'Compagnie'}</small><b>${esc(b.name)}</b></div>
      <table>${rows}</table>
      <div class="ft">Prix ${fmt(b.price)}${b.type === 'prop' ? ' · maison ' + fmt(C.HOUSE[b.group]) : ''} · hypothèque ${fmt(b.price / 2)}<br>${o != null ? 'Propriétaire : <b>' + esc(g.names[o]) + '</b>' + (g.mortgaged[i] ? ' (hypothéquée)' : '') : 'À vendre'}</div></div>`;
  }
  function actsFor(g, i) {
    const me = g.mine;
    if (me == null || g.owner[i] !== me) return '';
    const st = (fn) => fn(engineLike(g), me, i);
    const b = B[i];
    const btn = (a, label, fn) => { const err = st(fn); return `<button class="r-btn r-btn-ink r-btn-sm" data-pa="${a}" data-sq="${i}"${err ? ` disabled title="${esc(err)}"` : ''}>${label}</button>`; };
    let h = '';
    if (b.type === 'prop') h += btn('build', g.houses[i] === 4 ? 'Hôtel' : '+ Maison', C.canBuild) + btn('sell', '− Vendre', C.canSell);
    h += g.mortgaged[i] ? btn('unmortgage', 'Lever (' + fmt(C.unmortgageCost(i)) + ')', C.canUnmortgage) : btn('mortgage', 'Hypothéquer (+' + fmt(b.price / 2) + ')', C.canMortgage);
    return h;
  }
  function engineLike(g) { return { owner: g.owner, houses: g.houses, mortgaged: g.mortgaged, cash: g.cash, housesLeft: g.housesLeft, hotelsLeft: g.hotelsLeft }; }
  function openProp(api, i) {
    const g = api.msg().game;
    if (!B[i].price) return;
    ui.openSq = i;
    document.getElementById('cm-prop-c').innerHTML = propCard(g, i) + `<div class="pacts">${actsFor(g, i)}</div>`;
    document.getElementById('cm-prop').hidden = false;
  }
  function openManage(api) {
    const g = api.msg().game;
    fillManage(g);
    document.getElementById('cm-manage').hidden = false;
  }
  function fillManage(g) {
    const me = g.mine;
    if (me == null) return;
    const mine = C.OWNABLE.filter((i) => g.owner[i] === me);
    document.getElementById('cm-manage-h').textContent = mine.length ? 'Tu as ' + fmt(g.cash[me]) + '. Pour construire, il faut toutes les rues d\'une couleur, sans hypothèque, et construire de façon équilibrée.' : 'Tu ne possèdes encore rien.';
    document.getElementById('cm-manage-c').innerHTML = mine.map((i) => {
      const b = B[i];
      const st = g.houses[i] === 5 ? 'hôtel' : g.houses[i] ? g.houses[i] + ' maison' + (g.houses[i] > 1 ? 's' : '') : g.mortgaged[i] ? 'hypothéquée' : 'loyer ' + fmt(C.rentOf({ owner: g.owner, houses: g.houses, mortgaged: g.mortgaged }, i, 7));
      return `<div class="mrow"><span class="c" style="--c:${b.group ? C.G[b.group] : '#666'}"></span><span class="t">${esc(b.name)}<small>${st}</small></span><span class="b">${actsFor(g, i).replace(/r-btn r-btn-ink r-btn-sm/g, '')}</span></div>`;
    }).join('');
  }
  function openTrade(api, to) {
    const g = api.msg().game;
    const others = g.names.map((_, i) => i).filter((i) => i !== g.mine && !g.bankrupt[i]);
    ui.tradeTo = to != null ? to : others[0];
    fillTrade(api);
    document.getElementById('cm-trade').hidden = false;
  }
  function fillTrade(api) {
    const g = api.msg().game, me = g.mine, to = ui.tradeTo;
    const others = g.names.map((_, i) => i).filter((i) => i !== me && !g.bankrupt[i]);
    const list = (s, key) => C.OWNABLE.filter((i) => g.owner[i] === s).map((i) => {
      const b = B[i];
      const blocked = b.type === 'prop' && C.GROUPS[b.group].some((j) => g.houses[j] > 0);
      return `<label><input type="checkbox" data-${key}="${i}"${blocked ? ' disabled' : ''}><i style="--c:${b.group ? C.G[b.group] : '#666'}"></i>${esc(b.name)}${g.mortgaged[i] ? ' (hyp.)' : ''}${blocked ? ' (maisons)' : ''}</label>`;
    }).join('') || '<p class="r-dim-ink">Aucune propriété.</p>';
    document.getElementById('cm-trade-c').innerHTML = `<div class="tpick">${others.map((i) => `<button data-tto="${i}" class="${i === to ? 'on' : ''}">${esc(g.names[i])}</button>`).join('')}</div>
      <div class="tcols"><div><h4>Tu donnes</h4>${list(me, 'give')}<input type="number" id="c-tgcash" min="0" max="${g.cash[me]}" placeholder="Argent (max ${g.cash[me]})">${g.jailCards[me] ? '<label><input type="checkbox" id="c-tgjail"> Carte « libéré de prison »</label>' : ''}</div>
      <div><h4>Tu demandes à ${esc(g.names[to])}</h4>${list(to, 'want')}<input type="number" id="c-twcash" min="0" max="${g.cash[to]}" placeholder="Argent (max ${g.cash[to]})">${g.jailCards[to] ? '<label><input type="checkbox" id="c-twjail"> Carte « libéré de prison »</label>' : ''}</div></div>
      <div class="pacts"><button class="r-btn r-btn-accent" id="c-tsend">Envoyer la proposition</button></div>`;
  }
  function sendTrade(api) {
    const pick = (k) => Array.from(document.querySelectorAll('[data-' + k + ']:checked')).map((x) => Number(x.dataset[k]));
    const v = (id) => { const e = document.getElementById(id); return e ? Number(e.value) || 0 : 0; };
    const c = (id) => { const e = document.getElementById(id); return e && e.checked ? 1 : 0; };
    api.act({ type: 'propose', to: ui.tradeTo, give: { props: pick('give'), cash: v('c-tgcash'), jail: c('c-tgjail') }, want: { props: pick('want'), cash: v('c-twcash'), jail: c('c-twjail') } });
    document.getElementById('cm-trade').hidden = true;
  }
  function refreshModals(g, api) {
    if (!document.getElementById('cm-prop').hidden && ui.openSq != null) document.getElementById('cm-prop-c').innerHTML = propCard(g, ui.openSq) + `<div class="pacts">${actsFor(g, ui.openSq)}</div>`;
    if (!document.getElementById('cm-manage').hidden) fillManage(g);
    // Proposition reçue
    const t = g.trade, off = document.getElementById('cm-offer');
    if (t && t.to === g.mine) {
      const side = (sd) => `<ul>${(sd.props || []).map((i) => `<li>${esc(B[i].name)}${g.mortgaged[i] ? ' (hyp.)' : ''}</li>`).join('')}${sd.cash ? `<li>${fmt(sd.cash)}</li>` : ''}${sd.jail ? '<li>Carte « libéré de prison »</li>' : ''}</ul>${!(sd.props || []).length && !sd.cash && !sd.jail ? '<p class="r-dim-ink">Rien</p>' : ''}`;
      const h = `<h2>${esc(g.names[t.from])} te propose un échange</h2><div class="tsumm"><div><b>Tu reçois</b>${side(t.give)}</div><div><b>Tu donnes</b>${side(t.want)}</div></div><div class="pacts"><button class="r-btn r-btn-ink" data-offer="no">Refuser</button><button class="r-btn r-btn-accent" data-offer="yes">Accepter</button></div>`;
      const c = document.getElementById('cm-offer-c');
      if (c.dataset.h !== h) { c.dataset.h = h; c.innerHTML = h; }
      off.hidden = false;
    } else off.hidden = true;
  }

  function renderEnd(g, api) {
    const m = document.getElementById('cm-end');
    if (g.phase !== 'gameEnd') { m.hidden = true; return; }
    if (!m.hidden) return;
    const order = g.names.map((_, i) => i).filter((i) => !g.bankrupt[i]).sort((a, b) => g.worth[b] - g.worth[a]).concat(g.outOrder.slice().reverse());
    document.getElementById('cm-end-c').innerHTML = `<p class="r-dim-ink" style="margin:0">Partie terminée${g.maxRounds ? ' au bout de ' + g.maxRounds + ' tours' : ''}</p><h2>${g.winner === g.mine ? 'Tu as racheté Toulouse !' : esc(g.names[g.winner]) + ' a racheté Toulouse'}</h2>
      <ol class="rank">${order.map((i) => `<li><span>${esc(g.names[i])}${i === g.mine ? ' (toi)' : ''}</span><span>${g.bankrupt[i] ? 'faillite' : 'fortune ' + fmt(g.worth[i])}</span></li>`).join('')}</ol>
      <div class="pacts">${api.isHost() ? '<button class="r-btn r-btn-ink" data-ea="toLobby">Retour au salon</button><button class="r-btn r-btn-accent r-btn-big" data-ea="newGame">Nouvelle partie</button>' : '<span class="r-dim-ink">L\'hôte peut relancer une partie.</span>'}</div>`;
    m.hidden = false;
  }

  function onEvent(ev, msg, api) {
    const S = api.Sound, g = msg.game;
    if (ev.type === 'dice') {
      S.play('dice');
      const d = document.getElementById('c-dice');
      if (d) { d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll'); }
    } else if (ev.type === 'move' && (ev.jump || ev.jail)) { ui.jump = ui.jump || {}; ui.jump[ev.seat] = true; }
    else if (ev.type === 'bought' || ev.type === 'salary' || ev.type === 'pot') S.play('coin');
    else if (ev.type === 'rent') { S.play('coin'); if (ev.seat === g.mine || ev.to === g.mine) api.toast(ev.seat === g.mine ? 'Tu paies ' + fmt(ev.amount) + ' de loyer à ' + g.names[ev.to] : g.names[ev.seat] + ' te paie ' + fmt(ev.amount) + ' de loyer', 2600); }
    else if (ev.type === 'build') S.play('build');
    else if (ev.type === 'card') S.play('card');
    else if (ev.type === 'jail') S.play('alert');
    else if (ev.type === 'debt' && ev.seat === g.mine) S.play('bad');
    else if (ev.type === 'bankrupt') { S.play('bad'); api.toast(g.names[ev.seat] + ' fait faillite !', 3000); }
    else if (ev.type === 'tradeOk') { S.play('good'); if (ev.from === g.mine) api.toast(g.names[ev.to] + ' accepte ton échange !'); }
    else if (ev.type === 'tradeNo' && ev.from === g.mine) api.toast('Échange refusé.');
    else if (ev.type === 'trade' && ev.to === g.mine) S.play('turn');
  }

  const hero = `<svg class="chero" viewBox="0 0 240 130" aria-hidden="true"><rect x="0" y="0" width="240" height="130" rx="14" fill="#c8665a"/><g fill="none" stroke="#f7efe2" stroke-width="3"><path d="M30 46 120 18l90 28z"/><path d="M22 50h196M22 112h196M26 106h188"/>${Array.from({ length: 7 }, (_, k) => `<path d="M${42 + k * 27} 56v46M${50 + k * 27} 56v46"/>`).join('')}<circle cx="120" cy="36" r="6"/></g></svg>`;
  const rules = `
    <h3>But du jeu</h3><p>Acheter les rues de Toulouse, encaisser les loyers et ruiner les autres. Le dernier joueur qui n'a pas fait faillite gagne (ou le plus riche si la partie est limitée en tours).</p>
    <h3>Un tour</h3><p>Lance les deux dés et avance. Un double te fait rejouer ; trois doubles d'affilée t'envoient en prison. Passer par Départ rapporte 200 €.</p>
    <ul><li><b>Rue libre</b> : tu peux l'acheter. Sinon, elle est mise aux enchères entre tous les joueurs.</li>
    <li><b>Rue d'un autre joueur</b> : tu paies le loyer (doublé s'il a toute la couleur sans maison). Rien à payer si elle est hypothéquée.</li>
    <li><b>Lignes de transport</b> : 25, 50, 100 ou 200 € selon le nombre possédé. <b>Compagnies</b> : 4 fois les dés (10 fois si on a les deux).</li>
    <li><b>Hasard / Quartier</b> : tire une carte. <b>Taxes</b> : paie la banque. <b>Au poste !</b> : direct en prison.</li></ul>
    <h3>Construire</h3><p>Avec toutes les rues d'une couleur (sans hypothèque), tu peux construire des maisons puis un hôtel, de façon équilibrée sur le groupe. Les maisons se revendent à moitié prix. La banque n'a que 32 maisons et 12 hôtels.</p>
    <h3>Hypothèques et échanges</h3><p>Une propriété sans maison peut être hypothéquée pour la moitié de son prix ; lever l'hypothèque coûte ce montant + 10 %. Tu peux proposer un échange (rues, argent, carte de sortie de prison) à n'importe quel joueur à tout moment.</p>
    <h3>Prison</h3><p>Pour sortir : paie 50 €, utilise une carte « libéré de prison », ou tente un double (3 essais maximum, puis tu paies 50 €).</p>
    <h3>Faillite</h3><p>Si tu dois plus que ce que tu as, vends tes maisons et hypothèque. Si ça ne suffit pas, tu fais faillite : tes biens vont à ton créancier (ou retournent à la banque).</p>`;

  window.SalleRoom.start({
    module: C.module, title: 'Capitole', prefix: 'M', themeClass: 'theme-capitole', hideable: false, soloPlayers: 4,
    tagline: 'Achète les rues de Toulouse, construis, encaisse. Les règles du Monopoly, version ville rose.',
    hero, rulesHtml: rules, render, onEvent,
    lobbyNote: 'De 2 à 6 joueurs.',
  });
})();
