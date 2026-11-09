/* Archipel — interface */
(function () {
  'use strict';
  const A = window.ArchipelEngine;
  const { HEXES, VERTS, EDGES, RES, RES_NAME, COST, DEV_NAME } = A;
  const esc = window.SalleRoom.esc;
  const RCOL = { bois: '#2f7a3a', brique: '#b5532f', laine: '#7fb446', ble: '#d9a92c', minerai: '#6d7780' };
  const TFILL = { foret: ['#3a8a45', '#226030'], colline: ['#c9653b', '#94401f'], pre: ['#9fd060', '#6fa83c'], champ: ['#ecc54e', '#c9962a'], montagne: ['#9aa3ab', '#5f6870'], desert: ['#e8dab0', '#c9b682'] };
  const RICON = {
    bois: '<svg viewBox="0 0 32 32"><path d="M16 3 6 17h5l-6 8h22l-6-8h5z" fill="currentColor"/><rect x="14" y="25" width="4" height="5" fill="currentColor"/></svg>',
    brique: '<svg viewBox="0 0 32 32"><g fill="currentColor"><rect x="3" y="7" width="12" height="6" rx="1"/><rect x="17" y="7" width="12" height="6" rx="1"/><rect x="9" y="15" width="14" height="6" rx="1"/><rect x="3" y="23" width="12" height="6" rx="1"/><rect x="17" y="23" width="12" height="6" rx="1"/></g></svg>',
    laine: '<svg viewBox="0 0 32 32"><g fill="currentColor"><circle cx="11" cy="14" r="6"/><circle cx="18" cy="12" r="6"/><circle cx="23" cy="17" r="5"/><circle cx="15" cy="19" r="6"/></g><rect x="11" y="23" width="2.5" height="6" fill="currentColor"/><rect x="19" y="23" width="2.5" height="6" fill="currentColor"/></svg>',
    ble: '<svg viewBox="0 0 32 32"><path d="M16 30V6" stroke="currentColor" stroke-width="2.5"/><g fill="currentColor"><ellipse cx="12" cy="10" rx="3" ry="5" transform="rotate(-30 12 10)"/><ellipse cx="20" cy="10" rx="3" ry="5" transform="rotate(30 20 10)"/><ellipse cx="12" cy="18" rx="3" ry="5" transform="rotate(-30 12 18)"/><ellipse cx="20" cy="18" rx="3" ry="5" transform="rotate(30 20 18)"/><ellipse cx="16" cy="5" rx="2.6" ry="4.5"/></g></svg>',
    minerai: '<svg viewBox="0 0 32 32"><path d="M4 26 11 10l7 9 4-6 6 13z" fill="currentColor"/><path d="M11 10l3 4-3 2-2-2z" fill="#fff" opacity=".7"/></svg>',
  };
  const DICON = {
    knight: '<svg viewBox="0 0 32 32"><path d="M9 28h15l-2-6c3-3 4-7 2-12-2-4-6-6-10-5l-3-3-1 5-4 6 3 2 3-2c1 3 0 5-3 8z" fill="currentColor"/></svg>',
    vp: '<svg viewBox="0 0 32 32"><path d="M16 3l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" fill="currentColor"/></svg>',
    road: '<svg viewBox="0 0 32 32"><path d="M6 28 14 4M26 28 18 4M16 8v4M16 16v4M16 24v4" stroke="currentColor" stroke-width="2.5" fill="none"/></svg>',
    plenty: '<svg viewBox="0 0 32 32"><path d="M6 12h20l-3 16H9z" fill="currentColor"/><circle cx="11" cy="9" r="3" fill="currentColor"/><circle cx="17" cy="7" r="3" fill="currentColor"/><circle cx="22" cy="10" r="3" fill="currentColor"/></svg>',
    monopoly: '<svg viewBox="0 0 32 32"><path d="M5 26h22M7 26V12l9-7 9 7v14M12 26v-8h8v8" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linejoin="round"/></svg>',
  };
  const ui = { built: false, mode: null, prevHand: null, prodSum: null, prodUntil: 0, tradeTab: 'bank', bank: { give: null, get: null }, offer: { give: {}, get: {} }, disc: {}, pick: [], built2: new Set(), lastPieces: null };
  const n2 = (x) => Math.round(x * 1000) / 1000;
  const hexPts = (h, k) => Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 180) * (60 * i - 30); return n2(h.x + Math.cos(a) * k) + ',' + n2(h.y + Math.sin(a) * k); }).join(' ');

  function deco(t, h) {
    const x = h.x, y = h.y, d = [];
    const spots = [[-.5, -.42], [.48, -.4], [-.62, .18], [.6, .2], [-.18, .6], [.25, .62]];
    for (const [dx, dy] of spots) {
      const X = n2(x + dx), Y = n2(y + dy);
      if (t === 'foret') d.push(`<path d="M${X} ${n2(Y - .2)} l.13 .24 h-.26z M${X} ${n2(Y - .1)} l.16 .26 h-.32z" fill="#1d5a28"/>`);
      else if (t === 'montagne') d.push(`<path d="M${n2(X - .2)} ${n2(Y + .12)} L${X} ${n2(Y - .2)} L${n2(X + .2)} ${n2(Y + .12)}z" fill="#59626a"/><path d="M${n2(X - .07)} ${n2(Y - .09)} L${X} ${n2(Y - .2)} L${n2(X + .07)} ${n2(Y - .09)}z" fill="#f2f2f2"/>`);
      else if (t === 'pre') d.push(`<g fill="#f7f4ea"><circle cx="${X}" cy="${Y}" r=".07"/><circle cx="${n2(X + .07)}" cy="${n2(Y - .02)}" r=".06"/><circle cx="${n2(X - .06)}" cy="${n2(Y + .02)}" r=".055"/></g>`);
      else if (t === 'champ') d.push(`<path d="M${n2(X - .14)} ${n2(Y + .1)} q.14 -.3 .28 0 M${n2(X - .08)} ${n2(Y + .1)} v-.22 M${n2(X + .08)} ${n2(Y + .1)} v-.22" stroke="#b07e1c" stroke-width=".03" fill="none"/>`);
      else if (t === 'colline') d.push(`<g fill="#94401f"><rect x="${n2(X - .15)}" y="${n2(Y - .06)}" width=".14" height=".07"/><rect x="${n2(X + .01)}" y="${n2(Y - .06)}" width=".14" height=".07"/><rect x="${n2(X - .07)}" y="${n2(Y + .03)}" width=".14" height=".07"/></g>`);
      else if (t === 'desert') d.push(`<path d="M${n2(X - .2)} ${Y} q.1 -.1 .2 0 t.2 0" stroke="#b9a46c" stroke-width=".03" fill="none"/>`);
    }
    return d.join('');
  }

  function boardSvg(g) {
    let s = '<svg viewBox="-5.7 -5.3 11.4 10.6" xmlns="http://www.w3.org/2000/svg"><defs>';
    for (const [t, [a, b]] of Object.entries(TFILL)) s += `<radialGradient id="tf-${t}" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
    s += '<radialGradient id="sea" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="#2f86a8"/><stop offset="1" stop-color="#155476"/></radialGradient>';
    s += '<pattern id="waves" width=".8" height=".5" patternUnits="userSpaceOnUse"><path d="M0 .3 q.2 -.12 .4 0 t.4 0" stroke="rgba(255,255,255,.12)" stroke-width=".03" fill="none"/></pattern></defs>';
    s += '<polygon points="' + Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 180) * (60 * i); return n2(Math.cos(a) * 5.55) + ',' + n2(Math.sin(a) * 5.55); }).join(' ') + '" fill="url(#sea)" stroke="#e7c06a" stroke-width=".06" stroke-opacity=".5"/>';
    s += '<polygon points="' + Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 180) * (60 * i); return n2(Math.cos(a) * 5.55) + ',' + n2(Math.sin(a) * 5.55); }).join(' ') + '" fill="url(#waves)"/>';
    // sable sous l'île
    s += '<g>' + HEXES.map((h) => `<polygon points="${hexPts(h, 1.12)}" fill="#f1e2bb"/>`).join('') + '</g>';
    // ports
    g.ports.forEach((p) => {
      const E = EDGES[p.edge], va = VERTS[E.a], vb = VERTS[E.b];
      const mx = (va.x + vb.x) / 2, my = (va.y + vb.y) / 2, L = Math.hypot(mx, my);
      const px = n2(mx + mx / L * .62), py = n2(my + my / L * .62);
      s += `<path d="M${n2(va.x)} ${n2(va.y)} L${px} ${py} L${n2(vb.x)} ${n2(vb.y)}" stroke="#8a6a3a" stroke-width=".07" fill="none" stroke-linecap="round"/>`;
      const col = p.type === '3' ? '#f6efe0' : RCOL[p.type];
      s += `<circle cx="${px}" cy="${py}" r=".3" fill="${col}" stroke="#5b4320" stroke-width=".04"/><text x="${px}" y="${n2(py + .09)}" text-anchor="middle" font-size=".26" font-weight="800" font-family="Instrument Sans, sans-serif" fill="${p.type === '3' ? '#2a1712' : '#fff'}">${p.type === '3' ? '3:1' : '2:1'}</text>`;
    });
    // tuiles
    HEXES.forEach((h, i) => {
      const t = g.tiles[i];
      const hot = ui.prodSum && t.num === ui.prodSum && Date.now() < ui.prodUntil;
      s += `<polygon points="${hexPts(h, .97)}" fill="url(#tf-${t.terrain})" stroke="#f1e2bb" stroke-width=".05" class="${hot ? 'prodglow' : ''}"/>` + deco(t.terrain, h);
      if (t.num) {
        const red = t.num === 6 || t.num === 8;
        s += `<circle cx="${n2(h.x)}" cy="${n2(h.y)}" r=".36" fill="#f6efe0" stroke="#b59a6a" stroke-width=".035"/><text x="${n2(h.x)}" y="${n2(h.y + .1)}" text-anchor="middle" font-size="${red ? .36 : .32}" font-weight="800" font-family="Young Serif, Georgia, serif" fill="${red ? '#b42a22' : '#2a1712'}">${t.num}</text>`;
        const pips = A.PIPS[t.num];
        for (let k = 0; k < pips; k++) s += `<circle cx="${n2(h.x + (k - (pips - 1) / 2) * .07)}" cy="${n2(h.y + .2)}" r=".025" fill="${red ? '#b42a22' : '#2a1712'}"/>`;
      }
    });
    // voleur
    const R = HEXES[g.robber];
    s += `<g transform="translate(${n2(R.x - .5)} ${n2(R.y - .05)})"><ellipse cx="0" cy=".32" rx=".2" ry=".06" fill="rgba(0,0,0,.35)"/><path d="M-.15 .3 Q-.17 -.05 0 -.08 Q.17 -.05 .15 .3z" fill="#2b2b2e" stroke="#000" stroke-width=".02"/><circle cy="-.17" r=".12" fill="#2b2b2e" stroke="#000" stroke-width=".02"/></g>`;
    // routes
    EDGES.forEach((E, i) => {
      const o = g.eOwner[i]; if (o == null) return;
      const a = VERTS[E.a], b = VERTS[E.b];
      const x1 = n2(a.x + (b.x - a.x) * .17), y1 = n2(a.y + (b.y - a.y) * .17), x2 = n2(b.x - (b.x - a.x) * .17), y2 = n2(b.y - (b.y - a.y) * .17);
      const nw = ui.built2.has('e' + i) ? ' newpiece' : '';
      s += `<g class="${nw}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1b1b1b" stroke-width=".24" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" style="stroke:var(--p${o})" stroke-width=".15" stroke-linecap="round"/></g>`;
    });
    // colonies / villes
    VERTS.forEach((v, i) => {
      const o = g.vOwner[i]; if (o == null) return;
      const nw = ui.built2.has('v' + i) ? ' newpiece' : '';
      const x = n2(v.x), y = n2(v.y);
      if (g.vCity[i]) s += `<path class="${nw}" d="M${n2(x - .26)} ${n2(y + .18)} V${n2(y - .04)} L${n2(x - .13)} ${n2(y - .16)} L${x} ${n2(y - .04)} V${n2(y - .1)} H${n2(x + .26)} V${n2(y + .18)}z" style="fill:var(--p${o})" stroke="#1b1b1b" stroke-width=".05" stroke-linejoin="round"/>`;
      else s += `<path class="${nw}" d="M${n2(x - .15)} ${n2(y + .14)} V${n2(y - .03)} L${x} ${n2(y - .17)} L${n2(x + .15)} ${n2(y - .03)} V${n2(y + .14)}z" style="fill:var(--p${o})" stroke="#1b1b1b" stroke-width=".05" stroke-linejoin="round"/>`;
    });
    // emplacements jouables
    const L = g.legal, me = g.mine;
    if (L && me === g.turn) {
      const mode = g.phase === 'setup' ? (g.setupSub === 'settle' ? 'settlement' : 'road') : g.phase === 'roadbuild' ? 'road' : ui.mode;
      if (mode === 'road') L.road.forEach((e) => { const E = EDGES[e], a = VERTS[E.a], b = VERTS[E.b]; s += `<line class="espot" data-e="${e}" x1="${n2(a.x + (b.x - a.x) * .2)}" y1="${n2(a.y + (b.y - a.y) * .2)}" x2="${n2(b.x - (b.x - a.x) * .2)}" y2="${n2(b.y - (b.y - a.y) * .2)}"/>`; });
      if (mode === 'settlement') L.settle.forEach((v) => { s += `<circle class="spot" data-v="${v}" data-k="settlement" cx="${n2(VERTS[v].x)}" cy="${n2(VERTS[v].y)}" r=".16"/>`; });
      if (mode === 'city') L.city.forEach((v) => { s += `<circle class="spot" data-v="${v}" data-k="city" cx="${n2(VERTS[v].x)}" cy="${n2(VERTS[v].y)}" r=".24" fill-opacity=".3"/>`; });
      if (g.phase === 'robber') HEXES.forEach((h, i) => { if (i !== g.robber) s += `<polygon class="hexhit rob" data-h="${i}" points="${hexPts(h, .9)}"/>`; });
    }
    return s + '</svg>';
  }

  function build(api) {
    document.getElementById('game-root').innerHTML = `<div class="aroom">
      <div class="aboard"><div id="a-svg" style="position:absolute;inset:0"></div><div class="adice" id="a-dice"></div><div class="aprompt" id="a-prompt" hidden></div></div>
      <div class="abar"><div class="ahand" id="a-hand"></div><div class="adev" id="a-dev"></div><div class="aacts" id="a-acts"></div></div>
      <aside class="aside"><div class="ainfo" id="a-info"></div><div id="a-players"></div>
        <div class="acost"><div>Route<span>${cost(COST.road)}</span></div><div>Colonie<span>${cost(COST.settlement)}</span></div><div>Ville<span>${cost(COST.city)}</span></div><div>Carte développement<span>${cost(COST.dev)}</span></div></div>
        <ul class="alog" id="a-log"></ul></aside></div>`;
    document.body.insertAdjacentHTML('beforeend', `<div class="r-modal" id="am" hidden><div class="r-sheet r-paper" style="width:min(560px,100%)"><button class="r-close" data-rclose id="am-x">&times;</button><div id="am-c"></div></div></div>
      <div class="r-modal" id="am2" data-sticky="1" hidden><div class="r-sheet r-paper" style="width:min(560px,100%)"><div id="am2-c"></div></div></div>`);
    document.getElementById('a-svg').addEventListener('click', (e) => {
      const t = e.target;
      const msg = api.msg(); const g = msg && msg.game;
      if (!g) return;
      if (t.dataset.e != null) {
        const ev = Number(t.dataset.e);
        if (g.phase === 'setup') api.act({ type: 'setupRoad', e: ev }); else api.act({ type: 'build', kind: 'road', at: ev });
        if (g.phase === 'main') ui.mode = null;
      } else if (t.dataset.v != null) {
        const v = Number(t.dataset.v);
        if (g.phase === 'setup') api.act({ type: 'setupSettle', v }); else api.act({ type: 'build', kind: t.dataset.k, at: v });
        ui.mode = null;
      } else if (t.dataset.h != null) api.act({ type: 'robber', hex: Number(t.dataset.h) });
    });
    document.getElementById('a-acts').addEventListener('click', (e) => onAct(e, api));
    document.getElementById('a-dev').addEventListener('click', (e) => { const d = e.target.closest('[data-dev]'); if (d) playDev(api, d.dataset.dev); });
    document.getElementById('a-prompt').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (!b) return; if (b.dataset.p === 'cancel') { ui.mode = null; api.rerender(); } else if (b.dataset.p === 'endRoads') api.act({ type: 'endRoads' }); else if (b.dataset.p === 'cancelOffer') api.act({ type: 'cancelOffer' }); });
    document.addEventListener('click', (e) => modalClick(e, api));
    ui.built = true;
  }
  const cost = (c) => Object.entries(c).map(([r, k]) => Array.from({ length: k }, () => `<i style="--c:${RCOL[r]}" title="${RES_NAME[r]}"></i>`).join('')).join('');

  function render(msg, api) {
    if (!ui.built) build(api);
    const g = msg.game;
    // pièces nouvelles → animation
    const sig = g.eOwner.map((o, i) => (o != null ? 'e' + i : '')).concat(g.vOwner.map((o, i) => (o != null ? 'v' + i + (g.vCity[i] ? 'c' : '') : ''))).filter(Boolean);
    ui.built2 = new Set();
    if (ui.lastPieces) for (const k of sig) if (!ui.lastPieces.has(k)) ui.built2.add(k.replace(/c$/, ''));
    ui.lastPieces = new Set(sig);
    if (g.phase !== 'main') ui.mode = null;
    document.getElementById('a-svg').innerHTML = boardSvg(g);
    renderDice(g);
    renderPrompt(g, api);
    renderHand(g, api);
    renderActs(g, api);
    renderSide(g, api);
    renderModals(g, api);
  }

  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function renderDice(g) {
    const el = document.getElementById('a-dice');
    if (!g.dice[0]) { el.hidden = true; return; }
    el.hidden = false;
    const die = (v, red) => `<div class="die${red ? ' red' : ''}">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[v].includes(i) ? 'on' : ''}"></i>`).join('')}</div>`;
    const h = die(g.dice[0]) + die(g.dice[1], true) + `<span class="sum">${g.dice[0] + g.dice[1]}</span>`;
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  }

  function renderPrompt(g, api) {
    const el = document.getElementById('a-prompt');
    const me = g.mine, name = (s) => esc(g.names[s]);
    let h = '';
    if (g.phase === 'gameEnd') h = '';
    else if (g.phase === 'discard') h = g.discard[me] ? 'Le voleur ! Défausse ' + g.discard[me] + ' cartes.' : 'Défausse en cours… (' + g.discard.map((k, s) => (k ? name(s) : null)).filter(Boolean).join(', ') + ')';
    else if (g.turn !== me) {
      h = g.phase === 'setup' ? name(g.turn) + ' place ' + (g.setupSub === 'settle' ? 'une colonie' : 'une route') + '…' : g.phase === 'roll' ? 'À ' + name(g.turn) + ' de lancer les dés' : g.phase === 'robber' ? name(g.turn) + ' déplace le voleur…' : 'Tour de ' + name(g.turn);
    } else if (g.phase === 'setup') h = g.setupSub === 'settle' ? 'Place ta ' + (g.setupIdx >= g.n ? 'deuxième' : 'première') + ' colonie (clique un point blanc)' : 'Place une route qui part de cette colonie';
    else if (g.phase === 'roll') h = 'À toi : lance les dés' + (g.dev && g.dev.includes('knight') && !g.devPlayed ? ' (ou joue un Chevalier avant)' : '');
    else if (g.phase === 'robber') h = 'Déplace le voleur : clique une case';
    else if (g.phase === 'steal') h = 'Choisis à qui voler une carte';
    else if (g.phase === 'roadbuild') h = `Construis ${g.freeRoads} route${g.freeRoads > 1 ? 's' : ''} gratuite${g.freeRoads > 1 ? 's' : ''} <button class="r-btn r-btn-ghost" data-p="endRoads">Terminer</button>`;
    else if (g.phase === 'main' && ui.mode) h = (ui.mode === 'road' ? 'Clique où construire ta route' : ui.mode === 'settlement' ? 'Clique où fonder ta colonie' : 'Clique la colonie à transformer en ville') + ' <button class="r-btn r-btn-ghost" data-p="cancel">Annuler</button>';
    else if (g.offer && g.offer.from === me) h = 'Offre envoyée : ' + resTxt(g.offer.give) + ' contre ' + resTxt(g.offer.get) + ' <button class="r-btn r-btn-ghost" data-p="cancelOffer">Retirer</button>';
    el.hidden = !h;
    if (el.dataset.h !== h) { el.dataset.h = h; el.innerHTML = h; }
  }
  const resTxt = (o) => Object.entries(o).filter(([, k]) => k > 0).map(([r, k]) => k + ' ' + RES_NAME[r].toLowerCase()).join(', ');

  function renderHand(g, api) {
    const el = document.getElementById('a-hand');
    if (!g.hand) { el.innerHTML = ''; document.getElementById('a-dev').innerHTML = ''; return; }
    const prev = ui.prevHand;
    el.innerHTML = RES.map((r) => `<div class="rcard${g.hand[r] ? '' : ' zero'}${prev && g.hand[r] > prev[r] ? ' gain' : ''}" style="--c:${RCOL[r]}" title="${RES_NAME[r]}"><small>${RES_NAME[r]}</small>${RICON[r]}<b>${g.hand[r]}</b></div>`).join('');
    ui.prevHand = { ...g.hand };
    const canPlay = g.turn === g.mine && !g.devPlayed && (g.phase === 'main' || g.phase === 'roll');
    const cards = (g.dev || []).map((c) => ({ c, isNew: false })).concat((g.devNew || []).map((c) => ({ c, isNew: true })));
    document.getElementById('a-dev').innerHTML = cards.map(({ c, isNew }) => `<div class="dcard${isNew && c !== 'vp' ? ' new' : ''}${c === 'vp' ? ' vp' : ''}" ${!isNew && c !== 'vp' && canPlay && (c === 'knight' || g.phase === 'main') ? `data-dev="${c}"` : ''} title="${esc(DEV_NAME[c])}${isNew && c !== 'vp' ? ' — jouable au prochain tour' : ''}">${DICON[c]}<span>${esc(DEV_NAME[c])}</span></div>`).join('');
  }

  function renderActs(g, api) {
    const me = g.mine;
    const el = document.getElementById('a-acts');
    if (me == null) { el.innerHTML = ''; return; }
    const mine = g.turn === me;
    const main = mine && g.phase === 'main';
    const h = g.hand || {};
    const hasC = (c) => Object.entries(c).every(([r, k]) => (h[r] || 0) >= k);
    const L = g.legal || { road: [], settle: [], city: [] };
    const b = (k, label, c, ok) => `<button class="abtn${ui.mode === k ? ' on' : ''}" data-a="${k}"${ok ? '' : ' disabled'}>${label}<span class="cost">${cost(c)}</span></button>`;
    let x = '';
    if (mine && g.phase === 'roll') x += '<button class="abtn go" data-a="roll">Lancer les dés</button>';
    x += b('road', 'Route', COST.road, main && hasC(COST.road) && L.road.length && g.pieces[me].road > 0);
    x += b('settlement', 'Colonie', COST.settlement, main && hasC(COST.settlement) && L.settle.length);
    x += b('city', 'Ville', COST.city, main && hasC(COST.city) && L.city.length);
    x += b('buyDev', 'Carte dév.', COST.dev, main && hasC(COST.dev) && g.devLeft > 0);
    x += `<button class="abtn" data-a="trade"${main ? '' : ' disabled'}>Échanger<span class="cost">&nbsp;</span></button>`;
    if (main) x += '<button class="abtn go" data-a="endTurn">Terminer le tour</button>';
    if (el.dataset.h !== x) { el.dataset.h = x; el.innerHTML = x; }
  }
  function onAct(e, api) {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'road' || a === 'settlement' || a === 'city') { ui.mode = ui.mode === a ? null : a; api.rerender(); }
    else if (a === 'buyDev') api.act({ type: 'buyDev' });
    else if (a === 'trade') openTrade(api);
    else api.act({ type: a });
  }

  function renderSide(g, api) {
    document.getElementById('a-info').innerHTML = `<span>Tour <b>${g.round}</b></span><span>Objectif <b>${g.target}</b> points</span><span>Cartes dév. <b>${g.devLeft}</b></span>`;
    let h = '';
    for (let s = 0; s < g.n; s++) {
      const p = api.playerOf(s);
      const tags = [];
      if (g.longest === s) tags.push('<span class="tag hl">Route la plus longue</span>');
      if (g.army === s) tags.push('<span class="tag hl">Armée</span>');
      if (p && (p.isBot || p.botControl)) tags.push('<span class="tag">Robot</span>');
      if (p && !p.connected) tags.push('<span class="tag" style="background:#a33">Hors ligne</span>');
      h += `<div class="aplayer${g.turn === s ? ' cur' : ''}" style="--pc:var(--p${s})"><span class="r-av" style="--pc:var(--p${s})">${esc(g.names[s][0].toUpperCase())}</span>
        <span class="nm">${esc(g.names[s])}${s === g.mine ? ' (toi)' : ''} ${tags.join('')}</span>
        <span class="vpb">${g.vp[s]}<small>points</small></span>
        <span class="stats"><span title="Cartes ressource">🂠 ${g.cards[s]}</span><span title="Cartes développement">✦ ${g.devCount[s]}</span><span title="Chevaliers joués">⚔ ${g.knights[s]}</span><span title="Route la plus longue">↝ ${g.roadLen[s]}</span></span></div>`;
    }
    document.getElementById('a-players').innerHTML = h;
    const log = document.getElementById('a-log');
    const lh = g.log.map((l) => `<li>${esc(l)}</li>`).join('');
    if (log.dataset.h !== lh) { log.dataset.h = lh; log.innerHTML = lh; log.scrollTop = 1e6; }
  }

  // ----- Fenêtres -----
  function rpick(sel, opts) {
    return `<div class="rpick">${RES.map((r) => `<div><div class="rcard${sel.includes(r) ? ' sel' : ''}" data-rp="${r}" style="--c:${RCOL[r]}"><small>${RES_NAME[r]}</small>${RICON[r]}${opts && opts.counts ? `<b>${opts.counts[r]}</b>` : ''}</div>${opts && opts.step ? `<span class="step"><button data-st="${opts.step}:${r}:-1">−</button>${opts.vals[r] || 0}<button data-st="${opts.step}:${r}:1">+</button></span>` : ''}</div>`).join('')}</div>`;
  }
  function openModal(html) { document.getElementById('am-c').innerHTML = html; document.getElementById('am').hidden = false; }
  function playDev(api, c) {
    const g = api.msg().game;
    if (c === 'knight' || c === 'road') { api.act({ type: 'playDev', card: c }); return; }
    ui.pick = [];
    ui.devCard = c;
    fillDev(g);
  }
  function fillDev(g) {
    const c = ui.devCard;
    const need = c === 'plenty' ? 2 : 1;
    openModal(`<h2>${DEV_NAME[c]}</h2><p class="r-dim-ink">${c === 'plenty' ? 'Choisis 2 ressources à prendre à la banque (tu peux prendre deux fois la même).' : 'Choisis une ressource : tous les autres joueurs te donnent toutes leurs cartes de ce type.'}</p>${rpick(ui.pick)}<p class="r-dim-ink">${ui.pick.map((r) => RES_NAME[r]).join(' + ') || '—'}</p><div class="mfoot"><button class="r-btn r-btn-ink" data-m="reset">Effacer</button><button class="r-btn r-btn-accent" data-m="dev"${ui.pick.length === need ? '' : ' disabled'}>Jouer la carte</button></div>`);
  }
  function openTrade(api) { fillTrade(api.msg().game); document.getElementById('am').hidden = false; }
  function fillTrade(g) {
    const r = g.rates || {};
    let h = `<h2>Échanger</h2><div class="tabs"><button data-tab="bank" class="${ui.tradeTab === 'bank' ? 'on' : ''}">Avec la banque</button><button data-tab="players" class="${ui.tradeTab === 'players' ? 'on' : ''}">Avec les joueurs</button></div>`;
    if (ui.tradeTab === 'bank') {
      h += `<p class="lbl">Tu donnes (taux selon tes ports)</p><div class="rpick">${RES.map((x) => `<div><div class="rcard${ui.bank.give === x ? ' sel' : ''}${g.hand[x] < r[x] ? ' zero' : ''}" data-bg="${x}" style="--c:${RCOL[x]}"><small>${RES_NAME[x]}</small>${RICON[x]}<b>${r[x]}:1</b></div></div>`).join('')}</div>
        <p class="lbl">Tu reçois</p><div class="rpick">${RES.map((x) => `<div><div class="rcard${ui.bank.get === x ? ' sel' : ''}" data-bget="${x}" style="--c:${RCOL[x]}"><small>${RES_NAME[x]}</small>${RICON[x]}</div></div>`).join('')}</div>
        <div class="mfoot"><span class="dim">${ui.bank.give && ui.bank.get ? r[ui.bank.give] + ' ' + RES_NAME[ui.bank.give].toLowerCase() + ' → 1 ' + RES_NAME[ui.bank.get].toLowerCase() : 'Choisis les deux ressources'}</span><button class="r-btn r-btn-accent" data-m="bank"${ui.bank.give && ui.bank.get && ui.bank.give !== ui.bank.get && g.hand[ui.bank.give] >= r[ui.bank.give] ? '' : ' disabled'}>Échanger</button></div>`;
    } else {
      h += `<p class="lbl">Tu donnes</p>${rpick([], { step: 'give', vals: ui.offer.give })}<p class="lbl">Tu veux</p>${rpick([], { step: 'get', vals: ui.offer.get })}
        <div class="mfoot"><span class="dim">L'offre est envoyée à tous ; le premier qui accepte conclut l'échange.</span><button class="r-btn r-btn-accent" data-m="offer">Proposer</button></div>`;
    }
    document.getElementById('am-c').innerHTML = h;
  }
  function modalClick(e, api) {
    const msg = api.msg(); if (!msg || !msg.game) return;
    const g = msg.game;
    const t = e.target.closest('[data-tab],[data-bg],[data-bget],[data-st],[data-rp],[data-m],[data-steal],[data-off],[data-ea]');
    if (!t) return;
    if (t.dataset.tab) { ui.tradeTab = t.dataset.tab; fillTrade(g); }
    else if (t.dataset.bg) { ui.bank.give = t.dataset.bg; fillTrade(g); }
    else if (t.dataset.bget) { ui.bank.get = t.dataset.bget; fillTrade(g); }
    else if (t.dataset.st) {
      const [side, r, d] = t.dataset.st.split(':');
      if (side === 'disc') { ui.disc[r] = Math.max(0, Math.min(g.hand[r], (ui.disc[r] || 0) + Number(d))); fillDiscard(g); return; }
      const o = ui.offer[side]; o[r] = Math.max(0, Math.min(side === 'give' ? g.hand[r] : 19, (o[r] || 0) + Number(d))); fillTrade(g);
    } else if (t.dataset.rp) {
      if (ui.devCard) { const need = ui.devCard === 'plenty' ? 2 : 1; if (ui.pick.length < need) ui.pick.push(t.dataset.rp); else ui.pick = [t.dataset.rp]; fillDev(g); }
    } else if (t.dataset.m) {
      const m = t.dataset.m;
      if (m === 'reset') { ui.pick = []; fillDev(g); }
      else if (m === 'dev') { api.act({ type: 'playDev', card: ui.devCard, res: ui.pick[0], res2: ui.pick[1] }); ui.devCard = null; document.getElementById('am').hidden = true; }
      else if (m === 'bank') { api.act({ type: 'bankTrade', give: ui.bank.give, get: ui.bank.get }); setTimeout(() => { const nm = api.msg(); if (nm && nm.game) fillTrade(nm.game); }, 250); }
      else if (m === 'offer') { api.act({ type: 'offer', give: ui.offer.give, get: ui.offer.get }); ui.offer = { give: {}, get: {} }; document.getElementById('am').hidden = true; }
      else if (m === 'discard') { api.act({ type: 'discard', res: ui.disc }); }
    } else if (t.dataset.steal) api.act({ type: 'steal', from: Number(t.dataset.steal) });
    else if (t.dataset.off) api.act({ type: t.dataset.off === 'yes' ? 'acceptOffer' : 'declineOffer' });
    else if (t.dataset.ea) api.host(t.dataset.ea);
  }
  function fillDiscard(g) {
    const need = g.discard[g.mine];
    const cnt = RES.reduce((s, r) => s + (ui.disc[r] || 0), 0);
    const h = `<h2>Le voleur !</h2><p class="r-dim-ink">Tu as plus de 7 cartes : défausse-en ${need}.</p>${rpick([], { step: 'disc', vals: ui.disc, counts: g.hand })}<div class="mfoot"><span class="dim">${cnt} / ${need}</span><button class="r-btn r-btn-accent" data-m="discard"${cnt === need ? '' : ' disabled'}>Défausser</button></div>`;
    const c = document.getElementById('am2-c');
    if (c.dataset.h !== h) { c.dataset.h = h; c.innerHTML = h; }
  }
  function renderModals(g, api) {
    const m2 = document.getElementById('am2');
    const me = g.mine;
    let sticky = false;
    if (g.phase === 'discard' && me != null && g.discard[me]) { if (m2.hidden) ui.disc = {}; fillDiscard(g); sticky = true; }
    else if (g.phase === 'steal' && g.turn === me) {
      const h = `<h2>Voler une carte</h2><p class="r-dim-ink">Choisis un joueur touché par le voleur : tu lui prends une carte au hasard.</p><div class="mfoot">${g.stealFrom.map((s) => `<button class="r-btn r-btn-accent" data-steal="${s}">${esc(g.names[s])} (${g.cards[s]} cartes)</button>`).join('')}</div>`;
      document.getElementById('am2-c').innerHTML = h; sticky = true;
    } else if (g.offer && g.offer.from !== me && me != null && !g.offer.declined.includes(me)) {
      const o = g.offer;
      const can = RES.every((r) => g.hand[r] >= o.get[r]);
      const h = `<h2>${esc(g.names[o.from])} propose un échange</h2><div class="vic"><p><b>Tu reçois</b> : ${resTxt(o.give)}</p><p><b>Tu donnes</b> : ${resTxt(o.get)}</p></div><div class="mfoot">${can ? '' : '<span class="dim">Tu n\'as pas les cartes demandées.</span>'}<button class="r-btn r-btn-ink" data-off="no">Refuser</button><button class="r-btn r-btn-accent" data-off="yes"${can ? '' : ' disabled'}>Accepter</button></div>`;
      const c = document.getElementById('am2-c'); if (c.dataset.h !== h) { c.dataset.h = h; c.innerHTML = h; } sticky = true;
    } else if (g.phase === 'gameEnd') {
      if (!m2.dataset.end) {
        const order = g.names.map((_, i) => i).sort((a, b) => g.vp[b] - g.vp[a]);
        m2.dataset.end = '1';
        document.getElementById('am2-c').innerHTML = `<p class="r-dim-ink" style="margin:0">Partie terminée au tour ${g.round}</p><h2>${g.winner === me ? 'Tu as colonisé l\'archipel !' : esc(g.names[g.winner]) + ' a colonisé l\'archipel'}</h2>
          <ol class="rank">${order.map((i) => `<li><span>${esc(g.names[i])}${i === me ? ' (toi)' : ''}${g.allDev && g.allDev[i].filter((c) => c === 'vp').length ? ' — dont ' + g.allDev[i].filter((c) => c === 'vp').length + ' carte(s) point' : ''}</span><span>${g.vp[i]} points</span></li>`).join('')}</ol>
          <div class="mfoot">${api.isHost() ? '<button class="r-btn r-btn-ink" data-ea="toLobby">Retour au salon</button><button class="r-btn r-btn-accent r-btn-big" data-ea="newGame">Nouvelle partie</button>' : '<span class="dim">L\'hôte peut relancer une partie.</span>'}</div>`;
      }
      sticky = true;
    }
    if (g.phase !== 'gameEnd') delete m2.dataset.end;
    m2.hidden = !sticky;
    if (!document.getElementById('am').hidden && ui.tradeTab && !ui.devCard && document.querySelector('#am-c .tabs')) {
      if (!(g.phase === 'main' && g.turn === me)) document.getElementById('am').hidden = true;
    }
  }

  function onEvent(ev, msg, api) {
    const S = api.Sound, g = msg.game;
    if (ev.type === 'dice') {
      S.play('dice');
      ui.prodSum = ev.dice[0] + ev.dice[1]; ui.prodUntil = Date.now() + 1800;
      const d = document.getElementById('a-dice'); if (d) { d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll'); }
    } else if (ev.type === 'build') S.play('build');
    else if (ev.type === 'seven') { S.play('alert'); api.toast('7 ! Le voleur entre en scène', 2200); }
    else if (ev.type === 'steal' && (ev.from === g.mine)) api.toast(g.names[ev.seat] + ' te vole une carte ' + RES_NAME[ev.res].toLowerCase(), 2800);
    else if (ev.type === 'steal' && ev.seat === g.mine) api.toast('Tu voles une carte ' + RES_NAME[ev.res].toLowerCase(), 2400);
    else if (ev.type === 'devplay') { S.play('card'); if (ev.seat !== g.mine) api.toast(g.names[ev.seat] + ' joue ' + DEV_NAME[ev.card], 2400); }
    else if (ev.type === 'longest' || ev.type === 'army') S.play('good');
    else if (ev.type === 'tradeok') S.play('coin');
    else if (ev.type === 'win') S.play(ev.seat === g.mine ? 'good' : 'bad');
    else if (ev.type === 'prod' && g.mine != null && ev.gains[g.mine] && RES.some((r) => ev.gains[g.mine][r])) S.play('coin');
  }

  // Vue spectateur (/spec) : ressources et cartes développement de chacun
  function spyRows(g) {
    let h = '';
    for (let s = 0; s < g.n; s++) {
      const hand = g.spyHands[s], dev = g.spyDev[s];
      h += '<div class="sp-row"><b>' + esc(g.names[s]) + ' <span class="tag">' + g.vp[s] + ' pts</span></b><div class="sp-res">' +
        RES.map((r) => '<i style="--c:' + RCOL[r] + '">' + RES_NAME[r] + ' ' + hand[r] + '</i>').join('') + '</div>' +
        (dev.length ? '<div class="sp-res">' + dev.map((c) => '<i style="--c:' + (c === 'vp' ? '#9a7420' : '#4b3378') + '">' + esc(DEV_NAME[c]) + '</i>').join('') + '</div>' : '') + '</div>';
    }
    return h;
  }

  const hero = `<svg viewBox="0 0 230 150" aria-hidden="true"><defs><polygon id="hh" points="0,-30 26,-15 26,15 0,30 -26,15 -26,-15" stroke="#f1e2bb" stroke-width="3"/></defs>
    <use href="#hh" x="89" y="36" fill="#3a8a45"/><use href="#hh" x="141" y="36" fill="#ecc54e"/><use href="#hh" x="63" y="81" fill="#c9653b"/><use href="#hh" x="115" y="81" fill="#e8dab0"/><use href="#hh" x="167" y="81" fill="#9fd060"/><use href="#hh" x="89" y="126" fill="#9aa3ab"/><use href="#hh" x="141" y="126" fill="#3a8a45"/>
    <circle cx="141" cy="36" r="11" fill="#f6efe0"/><text x="141" y="41" text-anchor="middle" font-family="Georgia" font-weight="700" font-size="14" fill="#b42a22">6</text>
    <path d="M102 60 h10 l5 -6 l5 6 v10 h-20z" fill="#e57a6e" stroke="#1b1b1b" stroke-width="2"/><path d="M128 105 l18 -10" stroke="#1b1b1b" stroke-width="8" stroke-linecap="round"/><path d="M128 105 l18 -10" stroke="#86cde0" stroke-width="5" stroke-linecap="round"/></svg>`;
  const rules = `
    <h3>But du jeu</h3><p>Être le premier à atteindre 10 points de victoire (réglable). Une colonie vaut 1 point, une ville 2, la route la plus longue 2, l'armée la plus puissante 2, et certaines cartes développement 1.</p>
    <h3>Mise en place</h3><p>Chacun pose une colonie et une route, puis on recommence dans l'ordre inverse. La deuxième colonie rapporte une carte de chaque terrain voisin. Deux colonies doivent toujours être séparées d'au moins deux routes.</p>
    <h3>Un tour</h3><p>Lance les dés : chaque terrain portant ce numéro produit sa ressource pour les colonies (1 carte) et villes (2 cartes) qui le touchent, sauf s'il est bloqué par le voleur. Ensuite, échange et construis autant que tu veux, puis termine ton tour.</p>
    <table><tr><td>Forêt</td><td>Bois</td></tr><tr><td>Colline</td><td>Brique</td></tr><tr><td>Pré</td><td>Laine</td></tr><tr><td>Champ</td><td>Blé</td></tr><tr><td>Montagne</td><td>Minerai</td></tr></table>
    <h3>Le 7 et le voleur</h3><p>Sur un 7, personne ne produit. Ceux qui ont plus de 7 cartes en défaussent la moitié. Le joueur déplace le voleur sur un terrain (qui ne produit plus) et vole une carte à un joueur installé autour.</p>
    <h3>Constructions</h3><p>Route : bois + brique. Colonie : bois + brique + laine + blé (reliée à tes routes). Ville : 2 blé + 3 minerai (sur une de tes colonies). Carte développement : laine + blé + minerai.</p>
    <h3>Échanges</h3><p>Avec la banque : 4 cartes identiques contre 1, ou 3 contre 1 / 2 contre 1 si tu as une colonie sur un port. Avec les joueurs : propose une offre, le premier qui accepte la conclut.</p>
    <h3>Cartes développement</h3><p>Chevalier (déplace le voleur ; 3 chevaliers ou plus = armée la plus puissante), Construction de routes (2 routes gratuites), Abondance (2 ressources au choix), Monopole (tout le monde te donne une ressource), Point de victoire (caché). Une seule carte jouée par tour, jamais celle achetée ce tour-ci.</p>
    <h3>Route la plus longue</h3><p>Au moins 5 routes à la suite : 2 points. Une colonie adverse posée au milieu coupe la route.</p>`;

  window.SalleRoom.start({
    module: A.module, title: 'Archipel', prefix: 'A', themeClass: 'theme-archipel', hideable: true, soloPlayers: 4,
    tagline: 'Colonise l\'île, échange tes ressources, bâtis villes et routes. Les règles de Catan.',
    hero, rulesHtml: rules, render, onEvent, spyRows,
    lobbyNote: '3 ou 4 joueurs.',
  });
})();
