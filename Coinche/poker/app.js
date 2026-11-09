/* Poker — interface */
(function () {
  'use strict';
  const P = window.PokerEngine;
  const esc = window.SalleRoom.esc;
  const ui = { built: false, optKey: null, raiseTo: 0, boardKey: '', hand: null };
  const ACT = { fold: 'Couché', check: 'Parole', call: 'Suit', bet: 'Mise', raise: 'Relance', allin: 'Tapis !', sb: 'Petite blinde', bb: 'Grosse blinde' };
  const fmt = (x) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const cardHtml = (c, cls) => `<div class="card${cls ? ' ' + cls : ''}" data-c="${c}"><img src="../common/cards/${c}.svg" alt="" draggable="false"></div>`;
  function chips(v) {
    const cols = v >= 1000 ? ['#222', '#7b2cbf', '#1d3f8a'] : v >= 100 ? ['#1d3f8a', '#b42a22', '#2f7a43'] : ['#b42a22', '#f6efe0', '#2f7a43'];
    const n = Math.min(4, 1 + Math.floor(Math.log10(Math.max(1, v))));
    let h = '<span class="chipstk">';
    for (let i = 0; i < n; i++) h += `<i style="--c:${cols[i % 3]};bottom:${i * 4}px"></i>`;
    return h + '</span>';
  }

  function build(api) {
    document.getElementById('game-root').innerHTML = `<div class="proom">
      <div class="ptable" id="p-table"></div>
      <div id="p-seats"></div>
      <div class="pcenter"><div class="ppot" id="p-pot"></div><div class="pboard" id="p-board"></div><div class="ppots" id="p-pots"></div><p class="pmsg" id="p-msg"></p></div>
      <div class="pinfo" id="p-info"></div>
      <div class="prank" id="p-rank"></div>
      <div class="pme" id="p-me"><div class="pme-cards" id="p-mycards"></div><div id="p-act"></div></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', `<div class="r-modal" id="pm-end" data-sticky="1" hidden><div class="r-sheet r-paper" id="pm-end-c"></div></div>`);
    document.getElementById('p-act').addEventListener('click', (e) => onAct(e, api));
    document.getElementById('p-act').addEventListener('input', (e) => {
      if (e.target.id === 'p-range' || e.target.id === 'p-amt') {
        ui.raiseTo = Number(e.target.value) || 0;
        syncRaise();
      }
    });
    document.getElementById('pm-end').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'again') api.host('newGame'); else if (b.dataset.a === 'lobby') api.host('toLobby');
    });
    window.addEventListener('resize', () => api.rerender());
    ui.built = true;
  }

  function geom(n) {
    const t = document.getElementById('p-table').getBoundingClientRect();
    return { cx: t.left + t.width / 2, cy: t.top + t.height / 2, rx: t.width / 2, ry: t.height / 2 };
  }
  function at(G, k, n, f) {
    const a = (Math.PI / 2) + k * (2 * Math.PI / n);
    let x = G.cx + Math.cos(a) * G.rx * f;
    // sur téléphone, on garde les places entièrement dans l'écran
    const m = window.innerWidth < 640 ? 50 : 70;
    if (f > 0.9) x = Math.max(m, Math.min(window.innerWidth - m, x));
    return { x, y: G.cy + Math.sin(a) * G.ry * f };
  }

  function render(msg, api) {
    if (!ui.built) build(api);
    const g = msg.game;
    const me = g.mine;
    const base = me == null ? 0 : me;
    const G = geom(g.n);
    const rel = (s) => (s - base + g.n) % g.n;
    const result = g.result;
    const winners = new Set(result ? result.pots.flatMap((p) => p.winners) : []);
    const hot = new Set();
    if (result && !result.uncontested && result.pots[0]) for (const w of result.pots[0].winners) for (const c of result.hands[w].cards) hot.add(c);

    // Places
    let h = '';
    for (let s = 0; s < g.n; s++) {
      const k = rel(s);
      const p = api.playerOf(s);
      const pos = at(G, k, g.n, k === 0 ? 1.0 : 1.04);
      const isMe = s === me;
      const cls = ['pseat'];
      if (g.out[s]) cls.push('out');
      if (g.folded[s] && !g.out[s]) cls.push('folded');
      if (winners.has(s)) cls.push('win');
      let hole = '';
      if (!isMe && !g.out[s]) {
        if (g.holes[s]) hole = `<div class="hole big">${g.holes[s].map((c) => cardHtml(c, hot.size ? (hot.has(c) ? 'hot' : 'dim') : '')).join('')}</div>`;
        else if (g.hasCards[s]) hole = '<div class="hole"><div class="pback"></div><div class="pback"></div></div>';
      }
      const la = g.lastAction[s];
      let bubble = '';
      if (la && g.phase === 'betting' && !g.out[s]) bubble = `<span class="bubble${la.t === 'allin' ? ' loud' : la.t === 'raise' || la.t === 'bet' ? ' gold' : ''}">${ACT[la.t]}</span>`;
      if (g.allin[s] && !g.folded[s] && g.phase !== 'betting') bubble = '<span class="bubble loud">Tapis</span>';
      const hn = result && result.hands && result.hands[s] && !result.uncontested ? `<span class="hand-name">${esc(result.hands[s].name)}</span>` : '';
      const turn = g.toAct === s;
      const tags = [];
      if (p && (p.isBot || p.botControl)) tags.push('<span class="tag">Robot</span>');
      if (p && !p.connected) tags.push('<span class="tag" style="background:#a33">Hors ligne</span>');
      const plate = `<div class="plate${turn ? ' turn' : ''}${p && !p.connected ? ' off' : ''}" style="--pc:var(--p${s})"><span class="r-av${p && p.isBot ? ' bot' : ''}">${esc(g.names[s][0].toUpperCase())}</span><span style="display:grid"><span class="pn">${esc(g.names[s])}${isMe ? ' (toi)' : ''}</span><span class="stk">${g.out[s] ? 'Éliminé' : fmt(g.stacks[s])}</span></span>${tags.join('')}</div>`;
      h += `<div class="${cls.join(' ')}" style="left:${pos.x}px;top:${pos.y}px">${bubble}${k <= g.n / 2 && k !== 0 ? hole + plate : plate + hole}${hn}</div>`;
      if (g.bet[s] > 0) { const b = at(G, k, g.n, 0.66); h += `<div class="pbet" style="left:${b.x}px;top:${b.y}px">${chips(g.bet[s])}${fmt(g.bet[s])}</div>`; }
    }
    const dk = rel(g.dealer);
    const dpos = at(G, dk + 0.32, g.n, 0.8);
    h += `<div class="pdealer" style="left:${dpos.x}px;top:${dpos.y}px" title="Donneur">D</div>`;
    document.getElementById('p-seats').innerHTML = h;

    // Tableau
    const board = document.getElementById('p-board');
    const key = g.hand + ':' + g.board.join(',');
    if (ui.boardKey !== key || hot.size) {
      const prev = ui.boardKey.split(':')[0] === String(g.hand) ? (ui.boardKey.split(':')[1] || '').split(',').filter(Boolean) : [];
      let bh = '';
      for (let i = 0; i < 5; i++) {
        const c = g.board[i];
        if (c) bh += cardHtml(c, (hot.size ? (hot.has(c) ? 'hot' : 'dim') : '') + (prev.includes(c) ? ' still' : ''));
        else bh += '<div class="slot"></div>';
      }
      board.innerHTML = bh;
      board.querySelectorAll('.still').forEach((x) => { x.style.animation = 'none'; });
      ui.boardKey = key;
    }
    const inPots = g.phase === 'handEnd' || g.phase === 'gameEnd' ? 0 : g.pot;
    document.getElementById('p-pot').innerHTML = inPots ? chips(inPots) + 'Pot : ' + fmt(inPots) : '';
    document.getElementById('p-pot').hidden = !inPots;
    document.getElementById('p-pots').innerHTML = '';
    let m = '';
    if (result) {
      m = result.pots.map((p, i) => {
        const who = p.winners.map((w) => esc(g.names[w])).join(' et ');
        const how = result.uncontested ? '' : ' — ' + esc(result.hands[p.winners[0]].name);
        return (result.pots.length > 1 ? (i === 0 ? 'Pot principal : ' : 'Pot annexe : ') : '') + who + (p.winners.length > 1 ? ' se partagent ' : ' remporte ') + fmt(p.amount) + how;
      }).join('<br>');
    } else if (g.phase === 'betting' && g.toAct != null && g.toAct !== me) m = esc(g.names[g.toAct]) + ' réfléchit…';
    document.getElementById('p-msg').innerHTML = m;

    // Infos
    const left = g.every ? g.every - ((g.hand - 1) % g.every) : 0;
    document.getElementById('p-info').innerHTML = `<b>${fmt(g.sb)} / ${fmt(g.bb)}</b><br>Main n° ${g.hand}${g.every ? `<br><span style="color:var(--cream-dim)">${left > 1 ? 'Hausse dans ' + left + ' mains' : 'Hausse à la prochaine main'} (${fmt(g.nextBlinds[0])}/${fmt(g.nextBlinds[1])})</span>` : ''}`;
    const order = g.names.map((_, i) => i).sort((a, b) => (g.out[a] - g.out[b]) || g.stacks[b] - g.stacks[a]);
    document.getElementById('p-rank').innerHTML = order.map((i) => `<div class="${g.out[i] ? 'out' : ''}${i === me ? ' me' : ''}"><span>${esc(g.names[i])}</span><span>${fmt(g.stacks[i])}</span></div>`).join('');

    // Mes cartes
    const mc = document.getElementById('p-mycards');
    const mine = me != null ? g.holes[me] : null;
    const mk = mine ? g.hand + mine.join('') + (g.folded[me] ? 'f' : '') + [...hot].join('') : '';
    if (mc.dataset.k !== mk) {
      mc.dataset.k = mk;
      mc.innerHTML = mine ? mine.map((c) => cardHtml(c, hot.size ? (hot.has(c) ? 'hot' : 'dim') : g.folded[me] ? 'dim' : '')).join('') + (g.myHand && !g.folded[me] ? `<span class="pme-name">${esc(g.myHand)}</span>` : '') : '';
    }
    renderActions(g, api);
    renderEnd(g, api);
  }

  function renderActions(g, api) {
    const el = document.getElementById('p-act');
    const o = g.options;
    if (!o) {
      const me = g.mine;
      let t = '';
      if (me != null && g.out[me]) t = 'Tu es éliminé — tu peux regarder la suite.';
      else if (me != null && g.folded[me] && g.phase === 'betting') t = 'Tu t\'es couché pour cette main.';
      if (ui.optKey !== 'w' + t) { ui.optKey = 'w' + t; el.innerHTML = t ? `<p class="pwait">${t}</p>` : ''; }
      return;
    }
    const k = JSON.stringify(o) + g.hand + g.street;
    if (ui.optKey === k) return;
    ui.optKey = k;
    ui.raiseTo = Math.min(o.maxTo, Math.max(o.minTo, ui.raiseTo || 0));
    if (ui.raiseTo < o.minTo || ui.raiseTo > o.maxTo) ui.raiseTo = o.minTo;
    ui.raiseTo = o.minTo;
    ui.o = o; ui.pot = g.pot;
    el.innerHTML = `<div class="pact">
      <div class="row">
        <button class="r-btn r-btn-ghost" data-a="fold">Se coucher</button>
        ${o.canCheck ? '<button class="r-btn r-btn-ghost" data-a="check">Parole</button>' : `<button class="r-btn r-btn-ghost" data-a="call">${o.toCall >= o.stack ? 'Tapis ' + fmt(o.toCall) : 'Suivre ' + fmt(o.toCall)}</button>`}
        ${o.canRaise ? '<button class="r-btn r-btn-accent" data-a="raise" id="p-rbtn"></button>' : ''}
      </div>
      ${o.canRaise ? `<div class="amt"><input type="range" id="p-range" min="${o.minTo}" max="${o.maxTo}" step="1" value="${ui.raiseTo}"><input type="number" id="p-amt" min="${o.minTo}" max="${o.maxTo}" value="${ui.raiseTo}"></div>
      <div class="row" style="flex-wrap:wrap"><button class="q" data-q="min">Min</button><button class="q" data-q="0.5">½ pot</button><button class="q" data-q="0.75">¾ pot</button><button class="q" data-q="1">Pot</button><button class="q" data-q="max">Tapis</button></div>` : ''}
    </div>`;
    syncRaise();
  }
  function syncRaise() {
    const o = ui.o; if (!o) return;
    const b = document.getElementById('p-rbtn'); if (!b) return;
    ui.raiseTo = Math.max(o.minTo, Math.min(o.maxTo, Math.round(ui.raiseTo)));
    const r = document.getElementById('p-range'), a = document.getElementById('p-amt');
    if (r && Number(r.value) !== ui.raiseTo) r.value = ui.raiseTo;
    if (a && document.activeElement !== a) a.value = ui.raiseTo;
    b.textContent = ui.raiseTo >= o.maxTo ? 'Tapis (' + fmt(o.maxTo) + ')' : (o.currentBet === 0 ? 'Miser ' : 'Relancer à ') + fmt(ui.raiseTo);
  }
  function onAct(e, api) {
    const b = e.target.closest('button'); if (!b) return;
    const o = ui.o;
    if (b.dataset.q) {
      if (b.dataset.q === 'min') ui.raiseTo = o.minTo;
      else if (b.dataset.q === 'max') ui.raiseTo = o.maxTo;
      else ui.raiseTo = o.currentBet + Number(b.dataset.q) * (ui.pot + o.toCall);
      syncRaise();
      return;
    }
    const a = b.dataset.a;
    if (!a) return;
    if (a === 'raise') api.act({ type: 'raise', to: ui.raiseTo });
    else api.act({ type: a });
    ui.optKey = null;
  }

  function renderEnd(g, api) {
    const m = document.getElementById('pm-end');
    if (g.phase !== 'gameEnd') { m.hidden = true; return; }
    if (!m.hidden) return;
    const order = [g.winner].concat(g.outOrder.slice().reverse()).filter((x) => x != null);
    const me = g.mine;
    document.getElementById('pm-end-c').innerHTML = `<p class="r-dim-ink" style="margin:0">Partie terminée en ${g.hand} mains</p>
      <h2>${g.winner === me ? 'Tu remportes tous les jetons !' : esc(g.names[g.winner]) + ' remporte tous les jetons'}</h2>
      <ol class="rank">${order.map((i, k) => `<li><span>${k + 1}. ${esc(g.names[i])}${i === me ? ' (toi)' : ''}</span><span>${k === 0 ? fmt(g.stacks[i]) : 'éliminé'}</span></li>`).join('')}</ol>
      <div class="pfoot">${api.isHost() ? '<button class="r-btn r-btn-ink" data-a="lobby">Retour au salon</button><button class="r-btn r-btn-accent r-btn-big" data-a="again">Nouvelle partie</button>' : '<span class="r-dim-ink">L\'hôte peut relancer une partie.</span>'}</div>`;
    m.hidden = false;
  }

  function onEvent(ev, msg, api) {
    const S = api.Sound;
    if (ev.type === 'deal') S.play('deal');
    else if (ev.type === 'act' && ev.chip) S.play('chip');
    else if (ev.type === 'act' && ev.t === 'check') S.play('card');
    else if (ev.type === 'street') S.play('card');
    else if (ev.type === 'handend') {
      const r = msg.game.result;
      if (r && msg.game.mine != null && r.pots.some((p) => p.winners.includes(msg.game.mine))) S.play('coin');
    } else if (ev.type === 'bust') api.toast(msg.game.names[ev.seat] + ' est éliminé', 2600);
  }

  const hero = `<div class="pfan"><img src="../common/cards/AS.svg" alt="" style="left:20px;transform:rotate(-10deg)"><img src="../common/cards/AH.svg" alt="" style="left:70px;transform:rotate(8deg)">
    <div class="pchips"><span class="chipstk" style="transform:scale(1.6)"><i style="--c:#b42a22;bottom:0"></i><i style="--c:#b42a22;bottom:4px"></i><i style="--c:#b42a22;bottom:8px"></i></span><span class="chipstk" style="transform:scale(1.6);margin-left:22px"><i style="--c:#1d3f8a;bottom:0"></i><i style="--c:#1d3f8a;bottom:4px"></i></span></div></div>`;
  const rules = `
    <h3>Le principe</h3><p>Chacun reçoit 2 cartes cachées. Cinq cartes communes sont retournées au centre : 3 au <b>flop</b>, 1 au <b>turn</b>, 1 à la <b>river</b>. Chacun fait la meilleure combinaison de 5 cartes avec ses 2 cartes et les 5 communes.</p>
    <h3>Les blindes et les enchères</h3><p>Les deux joueurs à gauche du donneur posent la petite et la grosse blinde. Puis chacun, à son tour : se coucher, parole (si personne n'a misé), suivre, miser ou relancer (au moins du montant de la dernière relance). Sans limite : tu peux faire tapis à tout moment. Un tour d'enchères se termine quand tout le monde a suivi la dernière mise.</p>
    <p>Les blindes montent régulièrement (réglable dans le salon). Un joueur sans jetons est éliminé ; le dernier en lice gagne.</p>
    <h3>Les combinaisons (de la plus forte à la plus faible)</h3>
    <table><tr><td>Quinte flush</td><td>5 cartes qui se suivent, même couleur</td></tr><tr><td>Carré</td><td>4 cartes de même valeur</td></tr><tr><td>Full</td><td>Un brelan + une paire</td></tr><tr><td>Couleur</td><td>5 cartes de même couleur</td></tr><tr><td>Quinte</td><td>5 cartes qui se suivent (l'As peut faire A-2-3-4-5)</td></tr><tr><td>Brelan</td><td>3 cartes de même valeur</td></tr><tr><td>Double paire</td><td>2 paires</td></tr><tr><td>Paire</td><td>2 cartes de même valeur</td></tr><tr><td>Carte haute</td><td>Rien : la plus haute carte compte</td></tr></table>
    <h3>Tapis et pots annexes</h3><p>Un joueur à tapis ne peut gagner que ce qu'il a pu suivre : le reste forme un pot annexe disputé entre les autres. En cas d'égalité, le pot est partagé.</p>`;

  window.SalleRoom.start({
    module: P.module, title: 'Poker', prefix: 'P', themeClass: 'theme-poker', hideable: true, soloPlayers: 6,
    tagline: 'Texas Hold\'em sans limite. Les blindes montent, le dernier avec des jetons gagne.',
    hero, rulesHtml: rules, render, onEvent,
    lobbyNote: 'De 2 à 8 joueurs. L\'ordre des places est l\'ordre autour de la table.',
  });
})();
