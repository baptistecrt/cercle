/* ============================================================
   Coinche — interface
   ============================================================ */
(function () {
  'use strict';
  const E = window.CoincheEngine;
  const { Host, Client, newCode, rid, store } = window.CoincheOnline;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SIX_HOURS = 6 * 3600 * 1000;

  // ---------- Identité & préférences ----------
  const identity = store.get('coinche-id', null) || { token: rid(24), name: '' };
  store.set('coinche-id', identity);
  let tabId;
  try { tabId = sessionStorage.getItem('coinche-tab') || rid(12); sessionStorage.setItem('coinche-tab', tabId); } catch (e) { tabId = rid(12); }
  const prefs = Object.assign({ autoHide: false, sound: true, confirm: false }, store.get('coinche-prefs', {}));
  const savePrefs = () => store.set('coinche-prefs', prefs);

  const app = {
    link: null, isHost: false, code: null, msg: null, hidden: false, selValue: null,
    handRound: null, sys: [], flash: {}, unread: 0, chatSeen: 0, lastScores: [0, 0],
    status: '', armed: null, pendingCard: null, roundShown: null,
  };

  // ---------- Sons (synthétisés) ----------
  const Sound = {
    ctx: null,
    init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* */ } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    tone(freq, t0, dur, type, vol) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, c.currentTime + t0);
      g.gain.linearRampToValueAtTime(vol || .08, c.currentTime + t0 + .01);
      g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + t0 + dur);
      o.connect(g).connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + .05);
    },
    noise(t0, dur, freq, vol) {
      const c = this.ctx, len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = .9; g.gain.value = vol;
      s.buffer = buf; s.connect(f).connect(g).connect(c.destination); s.start(c.currentTime + t0);
    },
    play(kind) {
      if (!prefs.sound || !this.ctx) return;
      try {
        if (kind === 'card') this.noise(0, .09, 2400, .5);
        else if (kind === 'deal') { for (let i = 0; i < 6; i++) this.noise(i * .06, .06, 2800, .25); }
        else if (kind === 'turn') { this.tone(659, 0, .18, 'sine', .07); this.tone(988, .11, .3, 'sine', .06); }
        else if (kind === 'belote') { [523, 659, 784].forEach((f, i) => this.tone(f, i * .08, .3, 'triangle', .07)); }
        else if (kind === 'coinche') { this.tone(196, 0, .25, 'square', .05); this.tone(147, .12, .35, 'square', .05); }
        else if (kind === 'trick') this.noise(0, .2, 900, .35);
        else if (kind === 'good') { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * .09, .35, 'triangle', .06)); }
        else if (kind === 'bad') { [392, 330, 262].forEach((f, i) => this.tone(f, i * .12, .35, 'sine', .06)); }
        else if (kind === 'chat') this.tone(880, 0, .12, 'sine', .04);
      } catch (e) { /* */ }
    },
  };
  document.addEventListener('pointerdown', () => Sound.init(), { capture: true });

  // ---------- Utilitaires ----------
  function show(id) { for (const s of ['home', 'lobby', 'game']) $('#' + s).hidden = s !== id; }
  let toastT;
  function toast(text, ms) {
    const t = $('#toast'); t.textContent = text; t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 2600);
  }
  function openModal(id) { $('#' + id).hidden = false; }
  function closeModal(id) { $('#' + id).hidden = true; }
  const suitHtml = (s) => (s === 'TA' || s === 'SA') ? '<span class="sword">' + E.SUIT_INFO[s].name.toLowerCase() + '</span>' : '<span class="' + (E.SUIT_INFO[s].red ? 'sred' : '') + '">' + E.SUIT_INFO[s].sym + '</span>';
  const valLabel = (v) => (v === E.CAPOT ? 'Capot' : v === E.GENERALE ? 'Générale' : v);
  const bidHtml = (v, s) => valLabel(v) + ' ' + suitHtml(s);
  const send = (m) => app.link && app.send(m);

  function players() { return app.msg ? app.msg.players : []; }
  function playerAt(seat) { return players().find((p) => p.seat === seat); }
  function nameAt(seat) { const p = playerAt(seat); return p ? p.name : '—'; }
  function teamName(t) { return nameAt(t) + ' & ' + nameAt(t + 2); }
  function mySeat() { return app.msg ? app.msg.seat : null; }
  function posOf(seat) { const b = mySeat() == null ? 0 : mySeat(); return (seat - b + 4) % 4; }

  function cardEl(card) {
    const d = document.createElement('div');
    d.className = 'card';
    d.dataset.card = card;
    d.innerHTML = '<img src="../common/cards/' + card + '.svg" alt="' + esc(E.cardLabel(card)) + '" draggable="false">';
    return d;
  }

  // ---------- Démarrage d'une table ----------
  function inviteUrl(code) {
    const q = new URLSearchParams(location.search);
    q.set('room', code);
    return location.origin + location.pathname + '?' + q.toString();
  }
  function setUrlRoom(code) {
    const q = new URLSearchParams(location.search);
    if (code) q.set('room', code); else q.delete('room');
    const s = q.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
  }

  function startHost(code, saved, offline) {
    app.isHost = true;
    app.code = code;
    app.link = new Host({
      code, name: identity.name, token: identity.token, saved, offline,
      onLocal: (m) => { if (m.t === 'state') onState(m); else if (m.t === 'err') toast(m.msg); }, onStatus: setStatus,
    });
    app.send = (m) => app.link.handle(identity.token, m);
    store.set('coinche-session', { role: 'host', code, at: Date.now() });
    setUrlRoom(offline ? null : code);
  }

  function startClient(code) {
    app.isHost = false;
    app.code = code;
    $('#home-msg').textContent = 'Connexion à la table ' + code + '…';
    app.link = new Client({
      code, name: identity.name, token: identity.token, tab: tabId,
      onMsg: (m) => {
        if (m.t === 'state') onState(m);
        else if (m.t === 'err') toast(m.msg);
      },
      onStatus: setStatus,
      onRetoken: () => { /* nouveau joueur pour cet onglet */ },
    });
    app.send = (m) => { if (!app.link.send(m)) toast('Connexion perdue avec l\'hôte… reconnexion en cours.'); };
    store.set('coinche-session', { role: 'guest', code, at: Date.now() });
    setUrlRoom(code);
  }

  function leave() {
    if (app.link) {
      if (app.isHost && app.msg && app.msg.players.some((p) => !p.isBot && !p.isHost && p.connected)) {
        if (!confirm('Tu es l\'hôte : si tu quittes, la table se ferme pour tout le monde. Quitter ?')) return;
      }
      app.link.destroy();
    }
    app.link = null; app.msg = null; app.handRound = null; app.sys = []; app.roundShown = null;
    store.del('coinche-session');
    setUrlRoom(null);
    $$('.modal').forEach((m) => { m.hidden = true; });
    $('#home-msg').textContent = '';
    show('home');
  }

  const STATUS_TEXT = {
    host: { online: 'Table en ligne — tes potes peuvent rejoindre', connecting: 'Connexion au serveur…', offline: 'Hors ligne — partie contre les robots uniquement' },
    guest: { online: 'Connecté à l\'hôte', connecting: 'Connexion…', reconnecting: 'Reconnexion…', notfound: 'Table introuvable', hostgone: 'L\'hôte est injoignable' },
  };
  function setStatus(st) {
    app.status = st;
    const txt = (STATUS_TEXT[app.isHost ? 'host' : 'guest'] || {})[st] || '';
    const el = $('#net-status');
    el.textContent = txt;
    el.className = 'net-status ' + (st === 'online' ? 'online' : st === 'offline' || st === 'notfound' || st === 'hostgone' ? 'offline' : 'connecting');
    if (!app.isHost && st === 'notfound' && !app.msg) {
      app.link.destroy(); app.link = null;
      store.del('coinche-session');
      show('home');
      $('#home-msg').textContent = 'Aucune table avec le code ' + app.code + '. Vérifie le code — l\'hôte doit garder sa page ouverte.';
      return;
    }
    const banner = $('#conn-banner');
    if (!app.isHost && app.msg && st !== 'online') {
      banner.hidden = false;
      banner.textContent = st === 'hostgone' ? 'L\'hôte a quitté ou perdu sa connexion — on attend son retour…' : 'Connexion perdue — reconnexion…';
    } else banner.hidden = true;
  }

  // ---------- Réception de l'état ----------
  function onState(msg) {
    const prev = app.msg;
    app.msg = msg;
    const evs = msg.evs || [];
    const now = Date.now();
    for (const ev of evs) {
      if (ev.type === 'play') Sound.play('card');
      else if (ev.type === 'deal') Sound.play('deal');
      else if (ev.type === 'belote') { const ta = msg.game && msg.game.contract && msg.game.contract.suit === 'TA'; app.flash[ev.seat] = { html: ev.word + (ta ? ' ' + suitHtml(ev.suit) : ''), cls: 'belote', until: now + 2600 }; Sound.play('belote'); }
      else if (ev.type === 'bid' && (ev.bid.type === 'coinche' || ev.bid.type === 'surcoinche')) Sound.play('coinche');
      else if (ev.type === 'trickwin') setTimeout(() => Sound.play('trick'), 500);
      else if (ev.type === 'chat') {
        const p = players().find((x) => x.pid === ev.pid);
        if (p && p.seat != null && msg.game) app.flash[p.seat] = { html: esc(ev.text), cls: 'chat', until: now + 4500 };
        if (ev.pid !== msg.me) { if ($('#chat-panel').hidden) app.unread++; Sound.play('chat'); }
      } else if (ev.type === 'sys') app.sys.push({ sys: true, text: ev.text, ts: now });
      else if (ev.type === 'random') toast('Équipes tirées au sort !');
      else if (ev.type === 'roundend') {
        const g = msg.game;
        if (g && g.lastRound) {
          const mine = mySeat() == null ? 0 : mySeat() % 2;
          const att = g.lastRound.contract.seat % 2;
          Sound.play((g.lastRound.made === (att === mine)) ? 'good' : 'bad');
        }
      }
    }
    // C'est à moi ?
    const g = msg.game;
    if (g && g.turn != null && g.turn === msg.seat && (!prev || !prev.game || prev.game.turn !== msg.seat || prev.game.phase !== g.phase)) {
      Sound.play('turn');
    }
    document.title = (g && g.turn === msg.seat && document.hidden ? '● À toi — ' : '') + 'Coinche entre potes';

    if (msg.game) { show('game'); renderGame(); }
    else {
      show('lobby'); renderLobby();
      $$('#m-round, #m-end').forEach((m) => { m.hidden = true; });
    }
    renderChat();
  }

  // ---------- SALON ----------
  function renderLobby() {
    const m = app.msg;
    $('#lobby-code').textContent = m.code;
    const me = m.me;
    for (let s = 0; s < 4; s++) {
      const slot = $('.seat-slot[data-seat="' + s + '"]');
      const p = playerAt(s);
      const t = s % 2;
      if (p) {
        const isMe = p.pid === me;
        const tags = [isMe ? 'Toi' : null, p.isHost ? 'Hôte' : null, p.isBot ? 'Robot' : null, !p.connected ? 'Déconnecté' : null].filter(Boolean).join(' · ');
        const canRemove = m.isHost && !p.isHost;
        slot.innerHTML = '<div class="slot t' + t + (isMe ? ' me' : '') + '">' +
          '<span class="avatar' + (p.isBot ? ' bot' : '') + '" style="--tc:var(--team' + t + ')">' + esc(p.name[0].toUpperCase()) + '</span>' +
          '<span class="who"><b>' + esc(p.name) + '</b><small>' + esc(tags || 'Équipe ' + (t + 1)) + '</small></span>' +
          (canRemove ? '<button class="x" data-remove="' + p.pid + '" title="' + (p.isBot ? 'Retirer le robot' : 'Libérer la place') + '">×</button>' : '<span></span>') +
          '</div>';
      } else {
        slot.innerHTML = '<div class="slot empty t' + t + '">' +
          '<button class="sit" data-sit="' + s + '">S\'asseoir ici</button>' +
          (m.isHost ? '<button class="addbot" data-bot="' + s + '">Ajouter un robot</button>' : '') +
          '</div>';
      }
    }
    $('#tl-0').textContent = 'Équipe 1 — ' + (playerAt(0) || playerAt(2) ? [nameAt(0), nameAt(2)].join(' & ') : 'places libres');
    $('#tl-1').textContent = 'Équipe 2 — ' + (playerAt(1) || playerAt(3) ? [nameAt(1), nameAt(3)].join(' & ') : 'places libres');
    $('#host-controls').hidden = !m.isHost;
    const meP = players().find((p) => p.pid === m.me);
    $('#btn-stand').hidden = !(meP && meP.seat != null);
    $('#guest-wait').hidden = m.isHost;
    const full = [0, 1, 2, 3].every((s) => playerAt(s));
    $('#btn-start').disabled = !full;
    $('#btn-start').textContent = full ? 'Lancer la partie' : 'Il manque ' + [0, 1, 2, 3].filter((s) => !playerAt(s)).length + ' joueur(s)';
    $('#sel-target').value = String(m.settings.target);
    $('#sel-tasa').value = m.settings.taSa === false ? '0' : '1';
    $('#sel-anytime').value = m.settings.coincheAnytime === false ? '0' : '1';
    const spec = players().filter((p) => p.seat == null);
    $('#spec-list').innerHTML = spec.length ? spec.map((p) => '<li>' + esc(p.name) + (p.pid === me ? ' (toi)' : '') + '</li>').join('') : '<li class="none">Personne</li>';
  }

  $('#lobby').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.sit != null) send({ t: 'sit', seat: Number(b.dataset.sit) });
    else if (b.dataset.bot != null) send({ t: 'addBot', seat: Number(b.dataset.bot) });
    else if (b.dataset.remove) send({ t: 'remove', pid: b.dataset.remove });
  });
  $('#btn-random').onclick = () => send({ t: 'random' });
  $('#btn-start').onclick = () => send({ t: 'start' });
  $('#sel-target').onchange = (e) => send({ t: 'settings', target: Number(e.target.value) });
  $('#sel-tasa').onchange = (e) => send({ t: 'settings', taSa: e.target.value === '1' });
  $('#sel-anytime').onchange = (e) => send({ t: 'settings', coincheAnytime: e.target.value === '1' });
  $('#btn-leave').onclick = leave;
  $('#btn-stand').onclick = () => send({ t: 'stand' });
  $('#spy-h').onclick = () => $('#spy').classList.toggle('open');
  $('#btn-copy').onclick = async () => {
    const url = inviteUrl(app.msg.code);
    try { await navigator.clipboard.writeText(url); toast('Lien copié ! Envoie-le à tes potes.'); }
    catch (e) {
      const i = document.createElement('input'); i.value = url; document.body.appendChild(i); i.select();
      try { document.execCommand('copy'); toast('Lien copié ! Envoie-le à tes potes.'); } catch (e2) { prompt('Copie ce lien :', url); }
      i.remove();
    }
  };

  // ---------- TABLE ----------
  function renderGame() {
    const m = app.msg, g = m.game;
    renderSlate(g);
    renderPlaque(g);
    renderSeats(g);
    renderBacks(g);
    renderTrick(g);
    renderBidbox(g);
    renderHand(g);
    renderCenter(g);
    renderModals(g);
    renderSpy(g);
    renderPeek(g);
    const spect = m.seat == null;
    $('#hide-btn').hidden = spect;
    $('#t-last').disabled = !g.lastTrick;
  }

  // Vue admin : visible seulement tant qu'on maintient la touche ² (ou un appui long sur l'ardoise)
  function renderPeek(g) {
    const box = $('#peek');
    if (!g.peek || !app.peeking) { box.hidden = true; return; }
    const me = mySeat();
    const trump = g.contract && g.phase !== 'bidding' ? g.contract.suit : null;
    const h = (me == null ? [0, 1, 2, 3] : [1, 2, 3].map((k) => (me + k) % 4)).map((s) => '<div class="pk-row"><b>' + esc(nameAt(s)) + '</b><span class="pk-cards">' +
      sortHand(g.peek[s], trump).map((c) => '<img src="../common/cards/' + c + '.svg" alt="">').join('') + '</span></div>').join('');
    if (box.dataset.h !== h) { box.dataset.h = h; box.innerHTML = h; }
    box.hidden = false;
  }
  function setPeek(v) {
    if (app.peeking === v) return;
    app.peeking = v;
    if (app.msg && app.msg.game) renderPeek(app.msg.game);
  }
  document.addEventListener('keydown', (e) => { if ((e.key === '²' || e.key === '`') && !e.target.matches('input, textarea, select')) { e.preventDefault(); setPeek(true); } });
  document.addEventListener('keyup', (e) => { if (e.key === '²' || e.key === '`') setPeek(false); });
  window.addEventListener('blur', () => setPeek(false));
  (function () {
    let t = null, long = false;
    const slate = document.getElementById('slate');
    slate.addEventListener('pointerdown', () => { long = false; t = setTimeout(() => { long = true; setPeek(true); }, 450); });
    const up = () => { clearTimeout(t); setPeek(false); };
    slate.addEventListener('pointerup', up); slate.addEventListener('pointerleave', up); slate.addEventListener('pointercancel', up);
    slate.addEventListener('click', (e) => { if (long) { e.stopImmediatePropagation(); e.preventDefault(); long = false; } }, true);
    slate.addEventListener('contextmenu', (e) => e.preventDefault());
  })();

  // Vue spectateur (/spec) : les mains de tout le monde
  function renderSpy(g) {
    const box = $('#spy');
    if (!g.spy || !g.allHands) { box.hidden = true; return; }
    if (box.hidden) box.classList.toggle('open', window.innerWidth > 640);
    box.hidden = false;
    const trump = g.contract && g.phase !== 'bidding' ? g.contract.suit : null;
    const h = [0, 1, 2, 3].map((s) => '<div class="sp-row"><b>' + esc(nameAt(s)) + ' <span class="sp-team t' + (s % 2) + '">Équipe ' + (s % 2 + 1) + '</span></b><div class="sp-cards">' +
      sortHand(g.allHands[s], trump).map((c) => '<span class="mc" title="' + esc(E.cardLabel(c)) + '"><img src="../common/cards/' + c + '.svg" alt=""></span>').join('') + '</div></div>').join('');
    const b = $('#spy-b');
    if (b.dataset.h !== h) { b.dataset.h = h; b.innerHTML = h; }
  }

  function renderSlate(g) {
    for (const t of [0, 1]) {
      $('#sl-n' + t).textContent = teamName(t);
      $('#sl-n' + t).parentElement.className = 'slate-row t' + t;
      const el = $('#sl-s' + t);
      if (String(g.scores[t]) !== el.textContent) {
        el.textContent = g.scores[t];
        el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
      }
    }
    $('#sl-target').textContent = 'partie en ' + g.target;
  }

  function renderPlaque(g) {
    const pl = $('#plaque');
    if (!g.contract || g.phase === 'roundEnd' || g.phase === 'gameEnd' && !g.contract) { pl.hidden = !g.contract; }
    if (!g.contract) { pl.hidden = true; return; }
    pl.hidden = false;
    const bidding = g.phase === 'bidding';
    $('.plaque-label', pl).textContent = bidding ? 'Enchère en cours' : 'Contrat';
    $('#pl-bid').innerHTML = bidHtml(g.contract.value, g.contract.suit);
    $('#pl-by').textContent = 'par ' + nameAt(g.contract.seat);
    const co = $('#pl-coinche');
    co.hidden = !g.coinche;
    co.textContent = g.coinche === 2 ? 'Surcoinché ×4' : 'Coinché ×2';
    const tr = $('#pl-tricks');
    if (!bidding) {
      const mine = mySeat() == null ? 0 : mySeat() % 2;
      tr.textContent = 'Plis : ' + (mine === 0 ? 'Éq. 1 ' + g.tricksWon[0] + ' – ' + g.tricksWon[1] + ' Éq. 2' : 'Éq. 2 ' + g.tricksWon[1] + ' – ' + g.tricksWon[0] + ' Éq. 1');
      tr.hidden = false;
    } else tr.hidden = true;
  }

  function lastBidOf(g, seat) {
    for (let i = g.bids.length - 1; i >= 0; i--) if (g.bids[i].seat === seat) return g.bids[i];
    return null;
  }

  let flashTimer;
  function renderSeats(g) {
    const now = Date.now();
    let nextExpiry = Infinity;
    for (let s = 0; s < 4; s++) {
      const pos = posOf(s);
      const el = $('.seat[data-pos="' + pos + '"]');
      const p = playerAt(s);
      if (!p) { el.innerHTML = ''; continue; }
      const t = s % 2;
      const tags = [];
      if (g.dealer === s) tags.push('<span class="tag dealer">Donneur</span>');
      if (g.contract && g.phase !== 'bidding' && g.contract.seat === s) tags.push('<span class="tag taker">Preneur</span>');
      if (p.isBot || p.botControl) tags.push('<span class="tag">Robot</span>');
      if (!p.connected) tags.push('<span class="tag off">Hors ligne</span>');
      let bubble = '';
      const f = app.flash[s];
      if (f && f.until > now) {
        bubble = '<span class="bubble ' + f.cls + '">' + f.html + '</span>';
        nextExpiry = Math.min(nextExpiry, f.until);
      } else if (g.phase === 'bidding' || g.phase === 'redeal') {
        const b = lastBidOf(g, s);
        if (b) {
          if (b.type === 'pass') bubble = '<span class="bubble pass">Passe</span>';
          else if (b.type === 'bid') bubble = '<span class="bubble">' + bidHtml(b.value, b.suit) + '</span>';
          else bubble = '<span class="bubble loud">' + (b.type === 'coinche' ? 'Coinche !' : 'Surcoinche !') + '</span>';
        }
      }
      const isTurn = g.turn === s && (g.phase === 'bidding' || g.phase === 'playing');
      const key = [p.name, t, tags.join(''), bubble, isTurn, p.connected, s === mySeat()].join('|');
      if (el.dataset.key === key) continue;
      el.dataset.key = key;
      el.innerHTML = '<div class="plate t' + t + (isTurn ? ' turn' : '') + (p.connected ? '' : ' offline') + '">' +
        '<span class="avatar' + (p.isBot ? ' bot' : '') + '" style="--tc:var(--team' + t + ')">' + esc(p.name[0].toUpperCase()) + '</span>' +
        '<span class="pname">' + esc(p.name) + (s === mySeat() ? ' (toi)' : '') + '</span>' +
        (tags.length ? '<span class="ptags">' + tags.join('') + '</span>' : '') +
        '</div>' + bubble;
    }
    clearTimeout(flashTimer);
    if (nextExpiry < Infinity) flashTimer = setTimeout(() => app.msg && app.msg.game && renderSeats(app.msg.game), nextExpiry - now + 30);
  }

  function renderBacks(g) {
    for (let s = 0; s < 4; s++) {
      const pos = posOf(s);
      if (pos === 0) continue;
      const el = $('.backs[data-pos="' + pos + '"]');
      const n = g.handCounts[s];
      if (Number(el.dataset.n) === n && el.dataset.r === String(g.round)) continue;
      el.dataset.n = n; el.dataset.r = g.round;
      let h = '';
      for (let i = 0; i < n; i++) {
        const d = i - (n - 1) / 2;
        let tr;
        if (pos === 2) tr = 'translate(calc(-50% + ' + d * 14 + 'px), 0) rotate(' + (180 + d * 3) + 'deg)';
        else if (pos === 3) tr = 'translate(-50%, calc(-50% + ' + d * 11 + 'px)) rotate(' + (90 + d * 3) + 'deg)';
        else tr = 'translate(50%, calc(-50% + ' + d * 11 + 'px)) rotate(' + (-90 - d * 3) + 'deg)';
        h += '<div class="cb" style="transform:' + tr + (pos === 1 ? ';right:0' : ';left:0') + '"></div>';
      }
      el.innerHTML = h;
    }
  }

  function hashRot(card) { let h = 0; for (const c of card) h = (h * 31 + c.charCodeAt(0)) % 997; return (h % 11) - 5; }

  function trickGeom() {
    const cw = measureCW();
    const ch = cw * 1.395;
    const W = window.innerWidth, H = window.innerHeight;
    return {
      to: [[0, ch * 0.34], [cw * 0.66, -ch * 0.04], [0, -ch * 0.34], [-cw * 0.66, ch * 0.04]],
      from: [[0, H * 0.45], [W * 0.42, -H * 0.02], [0, -H * 0.42], [-W * 0.42, 0]],
    };
  }
  let cwCache = 0;
  function measureCW() {
    if (cwCache) return cwCache;
    const probe = document.createElement('div');
    probe.className = 'card'; probe.style.visibility = 'hidden';
    document.body.appendChild(probe);
    cwCache = probe.offsetWidth || 90;
    probe.remove();
    return cwCache;
  }
  window.addEventListener('resize', () => { cwCache = 0; if (app.msg && app.msg.game) { layoutHand(); $('#trick').innerHTML = ''; renderTrick(app.msg.game); renderBacks(app.msg.game); } });

  let sweepT;
  function renderTrick(g) {
    const el = $('#trick');
    const geo = trickGeom();
    if (!g.trick.length) {
      const kids = Array.from(el.children);
      if (kids.length && g.lastTrick && !el.dataset.sweeping && kids.every((k) => g.lastTrick.cards.some((c) => c.card === k.dataset.card))) {
        el.dataset.sweeping = '1';
        const wp = posOf(g.lastTrick.winner);
        const [wx, wy] = geo.from[wp];
        kids.forEach((k) => { k.style.setProperty('--wx', wx + 'px'); k.style.setProperty('--wy', wy + 'px'); k.classList.remove('enter'); });
        requestAnimationFrame(() => kids.forEach((k) => k.classList.add('sweep')));
        clearTimeout(sweepT);
        sweepT = setTimeout(() => { el.innerHTML = ''; delete el.dataset.sweeping; }, 520);
      } else if (!el.dataset.sweeping) el.innerHTML = '';
      return;
    }
    clearTimeout(sweepT);
    delete el.dataset.sweeping;
    const keys = g.trick.map((t) => t.card);
    Array.from(el.children).forEach((k) => { if (!keys.includes(k.dataset.card) || k.classList.contains('sweep')) k.remove(); });
    g.trick.forEach(({ seat, card }) => {
      let c = el.querySelector('[data-card="' + card + '"]');
      if (!c) {
        c = cardEl(card);
        const p = posOf(seat);
        const [tx, ty] = geo.to[p], [fx, fy] = geo.from[p];
        c.style.setProperty('--tx', tx + 'px'); c.style.setProperty('--ty', ty + 'px');
        c.style.setProperty('--fx', fx + 'px'); c.style.setProperty('--fy', fy + 'px');
        c.style.setProperty('--rot', hashRot(card) + 'deg');
        c.classList.add('enter');
        el.appendChild(c);
      }
      c.classList.toggle('win', g.trickDone && g.trickWinner === seat);
    });
  }

  function renderCenter(g) {
    const el = $('#center-msg');
    let t = '';
    if (g.phase === 'redeal') t = 'Tout le monde a passé — on redistribue';
    else if (g.phase === 'bidding' && g.turn !== mySeat()) t = nameAt(g.turn) + (g.surcoinche ? ' décide de surcoincher…' : ' réfléchit…');
    else if (g.phase === 'playing' && !g.trick.length && g.turn !== mySeat() && g.tricksPlayed === 0) t = nameAt(g.turn) + ' entame';
    el.textContent = t;
    el.hidden = !t;
    $('#turn-pill').hidden = !(g.phase === 'playing' && g.turn === mySeat() && !g.trickDone);
  }

  // ----- Enchères -----
  function renderBidbox(g) {
    const box = $('#bidbox');
    const o = g.bidOptions;
    const quick = $('#coinche-now');
    // Coinche / surcoinche à tout moment, même quand ce n'est pas ton tour
    if (o && g.phase === 'bidding' && !o.myTurn && (o.canCoinche || o.canSurcoinche)) {
      quick.hidden = false;
      quick.dataset.a = o.canSurcoinche ? 'surcoinche' : 'coinche';
      quick.innerHTML = (o.canSurcoinche ? 'Surcoinche !' : 'Coinche !') + ' <small>' + (o.canSurcoinche ? 'contre leur coinche' : 'sur ' + bidHtml(g.contract.value, g.contract.suit) + ' de ' + esc(nameAt(g.contract.seat))) + '</small> <kbd>C</kbd>';
    } else quick.hidden = true;
    if (!o || !o.myTurn || g.phase !== 'bidding') { box.hidden = true; app.selValue = null; return; }
    box.hidden = false;
    const surco = o.canSurcoinche;
    $('#bid-title').innerHTML = surco
      ? 'Vous êtes coinchés sur ' + bidHtml(g.contract.value, g.contract.suit) + '. Surcoinche ?'
      : g.contract ? 'À toi de parler — enchère actuelle : ' + bidHtml(g.contract.value, g.contract.suit) + ' (' + esc(nameAt(g.contract.seat)) + ')' : 'À toi de parler';
    const vals = $('#bid-values'), suits = $('#bid-suits');
    vals.hidden = surco || !o.values.length; suits.hidden = surco || !o.values.length;
    if (!o.values.includes(app.selValue)) app.selValue = o.values[0];
    vals.innerHTML = o.values.map((v) => '<button class="bid-v' + (v === app.selValue ? ' sel' : '') + '" data-v="' + v + '">' + valLabel(v) + '</button>').join('');
    suits.classList.toggle('six', (o.suits || []).length > 4);
    suits.innerHTML = (o.suits || ['S', 'H', 'D', 'C']).map((s) => '<button class="bid-suit' + (E.SUIT_INFO[s].red ? ' sred' : '') + '" data-s="' + s + '"><span class="sym">' + E.SUIT_INFO[s].sym + '</span><small>' + E.SUIT_INFO[s].name + '</small></button>').join('');
    $('#b-coinche').hidden = !o.canCoinche;
    $('#b-surcoinche').hidden = !surco;
    $('#b-pass').textContent = surco ? 'Non, on joue' : 'Passer';
  }
  $('#bid-values').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    app.selValue = Number(b.dataset.v);
    $$('.bid-v').forEach((x) => x.classList.toggle('sel', x === b));
  });
  $('#bid-suits').addEventListener('click', (e) => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    send({ t: 'act', a: { type: 'bid', value: app.selValue, suit: b.dataset.s } });
  });
  $('#b-pass').onclick = () => send({ t: 'act', a: { type: 'pass' } });
  $('#b-coinche').onclick = () => send({ t: 'act', a: { type: 'coinche' } });
  $('#b-surcoinche').onclick = () => send({ t: 'act', a: { type: 'surcoinche' } });
  $('#coinche-now').onclick = () => { const b = $('#coinche-now'); if (!b.hidden) send({ t: 'act', a: { type: b.dataset.a } }); };

  // ----- Main -----
  function sortHand(hand, trump) {
    const present = ['S', 'H', 'C', 'D'].filter((s) => hand.some((c) => E.suitOf(c) === s));
    const red = (s) => E.SUIT_INFO[s].red;
    const order = [];
    const pool = present.slice();
    if (trump && pool.includes(trump)) { order.push(trump); pool.splice(pool.indexOf(trump), 1); }
    while (pool.length) {
      const last = order[order.length - 1];
      let i = last ? pool.findIndex((s) => red(s) !== red(last)) : 0;
      if (i < 0) i = 0;
      // éviter de coincer deux couleurs identiques à la fin
      if (last && pool.length === 2 && red(pool[0]) === red(pool[1])) i = pool.findIndex((s) => red(s) !== red(last)) >= 0 ? pool.findIndex((s) => red(s) !== red(last)) : 0;
      order.push(pool.splice(i, 1)[0]);
    }
    return hand.slice().sort((a, b) => order.indexOf(E.suitOf(a)) - order.indexOf(E.suitOf(b)) || E.strength(b, trump) - E.strength(a, trump));
  }

  function renderHand(g) {
    const el = $('#hand');
    const hand = g.hand;
    if (!hand) { el.innerHTML = ''; $('#hide-veil').hidden = true; return; }
    const trump = g.contract && g.phase !== 'bidding' ? g.contract.suit : null;
    const sorted = sortHand(hand, trump);
    const newRound = app.handRound !== g.round;
    if (newRound) { el.innerHTML = ''; app.handRound = g.round; app.pendingCard = null; }
    const existing = new Map(Array.from(el.children).map((c) => [c.dataset.card, c]));
    for (const [k, c] of existing) if (!sorted.includes(k)) c.remove();
    sorted.forEach((card, i) => {
      let c = existing.get(card);
      if (!c) {
        c = cardEl(card);
        if (newRound) { c.classList.add('deal'); c.style.animationDelay = (i * 55) + 'ms'; c.addEventListener('animationend', () => c.classList.remove('deal'), { once: true }); }
      }
      el.appendChild(c); // réordonne
    });
    const myTurn = g.phase === 'playing' && g.turn === mySeat() && !g.trickDone && !!g.legal;
    el.classList.toggle('myturn', myTurn && !app.hidden);
    el.classList.toggle('hidden', app.hidden);
    Array.from(el.children).forEach((c) => {
      const ok = myTurn && g.legal.includes(c.dataset.card);
      c.classList.toggle('ok', ok);
      c.classList.toggle('no', myTurn && !ok);
      if (!ok) c.classList.remove('armed');
    });
    $('#hide-veil').hidden = !app.hidden;
    layoutHand();
  }

  function layoutHand() {
    const el = $('#hand');
    const cards = Array.from(el.children);
    const n = cards.length;
    if (!n) return;
    const cw = measureCW();
    const avail = Math.min(window.innerWidth - 40, cw * 7.2);
    const spacing = n > 1 ? Math.min(cw * 0.78, (avail - cw) / (n - 1)) : 0;
    cards.forEach((c, i) => {
      const d = i - (n - 1) / 2;
      c.style.setProperty('--x', d * spacing + 'px');
      c.style.setProperty('--y', (d * d * cw * 0.012) + 'px');
      c.style.setProperty('--r', (d * 2.4) + 'deg');
      c.style.zIndex = i + 1;
    });
  }

  $('#hand').addEventListener('click', (e) => {
    const c = e.target.closest('.card');
    if (!c || app.hidden) return;
    const g = app.msg && app.msg.game;
    if (!g || !g.legal || g.turn !== mySeat()) return;
    const card = c.dataset.card;
    if (!g.legal.includes(card)) {
      const t = g.trick.length ? E.SUIT_INFO[E.suitOf(g.trick[0].card)] : null;
      toast(t ? 'Tu ne peux pas jouer cette carte ici (' + t.name.toLowerCase() + ' demandé).' : 'Carte interdite.');
      return;
    }
    if (prefs.confirm && app.armed !== card) {
      app.armed = card;
      $$('#hand .card').forEach((x) => x.classList.toggle('armed', x === c));
      return;
    }
    app.armed = null;
    if (app.pendingCard === card) return;
    app.pendingCard = card;
    send({ t: 'act', a: { type: 'play', card } });
  });

  // ----- Cacher les cartes -----
  function setHidden(v) {
    app.hidden = v;
    $('#hide-btn').classList.toggle('on', v);
    $('#hide-label').textContent = v ? 'Montrer mes cartes' : 'Cacher mes cartes';
    if (app.msg && app.msg.game) renderHand(app.msg.game);
  }
  $('#hide-btn').onclick = () => setHidden(!app.hidden);
  $('#hide-veil').onclick = () => setHidden(false);
  window.addEventListener('blur', () => { if (prefs.autoHide && app.msg && app.msg.game) setHidden(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && prefs.autoHide && app.msg && app.msg.game) setHidden(true); });
  document.addEventListener('keydown', (e) => {
    const typing = e.target.matches('input, textarea, select');
    if (e.key === 'Escape') { $$('.modal').forEach((m) => { if (!['m-round', 'm-end'].includes(m.id)) m.hidden = true; }); return; }
    if (typing) return;
    if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey && app.msg && app.msg.game) setHidden(!app.hidden);
    if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && app.msg && app.msg.game) {
      const o = app.msg.game.bidOptions;
      if (o && (o.canCoinche || o.canSurcoinche)) send({ t: 'act', a: { type: o.canSurcoinche ? 'surcoinche' : 'coinche' } });
    }
  });

  // ----- Fin de donne / fin de partie -----
  function renderModals(g) {
    const mr = $('#m-round'), me = $('#m-end');
    if (g.phase === 'roundEnd' && g.lastRound) {
      mr.hidden = false;
      fillRound(g);
    } else mr.hidden = true;
    if (g.phase === 'gameEnd') {
      me.hidden = false;
      const w = g.winner;
      const mine = mySeat() == null ? null : mySeat() % 2;
      $('#e-title').textContent = mine == null ? 'Victoire de ' + teamName(w) : mine === w ? 'Victoire ! Bravo ' + teamName(w) : 'Perdu… Bravo à ' + teamName(w);
      $('#e-score').textContent = g.scores[w] + ' à ' + g.scores[1 - w];
      $('#e-again').hidden = !app.msg.isHost;
      $('#e-lobby').hidden = !app.msg.isHost;
      $('#e-wait').hidden = app.msg.isHost;
      $('#e-wait').textContent = 'L\'hôte peut relancer une partie.';
    } else me.hidden = true;
  }

  function fillRound(g) {
    const r = g.lastRound;
    const att = r.contract.seat % 2;
    $('#r-title').innerHTML = r.made ? '<span class="stamp ok">Contrat réussi</span>' : '<span class="stamp">Dedans !</span>';
    const co = r.coinche === 2 ? ', surcoinché' : r.coinche === 1 ? ', coinché' : '';
    $('#r-contract').innerHTML = esc(nameAt(r.contract.seat)) + ' a pris ' + bidHtml(r.contract.value, r.contract.suit) + co + ' — Équipe ' + (att + 1) + ' à la prise, ' + r.tricksWon[att] + ' pli' + (r.tricksWon[att] > 1 ? 's' : '') + ' sur 8' + (r.contract.value === E.GENERALE ? ' (dont ' + (r.takerTricks || 0) + ' par ' + esc(nameAt(r.contract.seat)) + ')' : '') + '.';
    const row = (label, a, b, cls) => '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + label + '</td><td>' + a + '</td><td>' + b + '</td></tr>';
    let h = '<thead><tr><th></th><th><span class="team-chip t0">' + esc(teamName(0)) + '</span></th><th><span class="team-chip t1">' + esc(teamName(1)) + '</span></th></tr></thead><tbody>';
    if (r.capotTeam != null) h += row('Points des plis (capot !)', r.cardPoints[0], r.cardPoints[1]);
    else h += row('Points des plis (dont 10 de der)', r.cardPoints[0], r.cardPoints[1]);
    if (r.belote[0] + r.belote[1] > 0) h += row(r.beloteCount && r.beloteCount[0] + r.beloteCount[1] > 1 ? 'Belotes-rebelotes (20 chacune)' : 'Belote-rebelote', r.belote[0] || '–', r.belote[1] || '–');
    h += row('Total réalisé', r.total[0], r.total[1]);
    h += row('Points marqués', '+' + r.gain[0], '+' + r.gain[1], 'final');
    h += row('Score', r.scores[0], r.scores[1], 'tot');
    h += '</tbody>';
    $('#r-table').innerHTML = h;
    const seated = players().filter((p) => p.seat != null && !p.isBot && !p.botControl && p.connected);
    const ready = seated.filter((p) => p.ready).length;
    const meP = players().find((p) => p.pid === app.msg.me);
    const btn = $('#r-next');
    btn.hidden = mySeat() == null;
    btn.disabled = !!(meP && meP.ready);
    btn.textContent = meP && meP.ready ? 'En attente…' : 'Donne suivante';
    $('#r-ready').textContent = ready + ' / ' + seated.length + ' prêt' + (ready > 1 ? 's' : '');
  }
  $('#r-next').onclick = () => send({ t: 'ready' });
  $('#e-again').onclick = () => send({ t: 'newGame' });
  $('#e-lobby').onclick = () => send({ t: 'toLobby' });
  $('#e-sheet').onclick = () => openSheet();

  // ----- Feuille de marque -----
  function openSheet() {
    const g = app.msg && app.msg.game;
    if (!g) return;
    let h = '<thead><tr><th>#</th><th>Contrat</th><th class="h0">' + esc(teamName(0)) + '</th><th class="h1">' + esc(teamName(1)) + '</th></tr></thead><tbody>';
    if (!g.history.length) h += '<tr><td colspan="4">Aucune donne terminée pour l\'instant.</td></tr>';
    g.history.forEach((r) => {
      const co = r.coinche === 2 ? ' ×4' : r.coinche === 1 ? ' ×2' : '';
      h += '<tr><td>' + r.round + '</td><td' + (r.made ? '' : ' class="fail"') + '>' + esc(nameAt(r.contract.seat)) + ' · ' + bidHtml(r.contract.value, r.contract.suit) + co + (r.contract.value === E.GENERALE ? '' : r.capotTeam != null ? ' · capot' : '') + '</td>' +
        '<td>+' + r.gain[0] + ' <span class="cum">(' + r.scores[0] + ')</span></td><td>+' + r.gain[1] + ' <span class="cum">(' + r.scores[1] + ')</span></td></tr>';
    });
    h += '</tbody><tfoot><tr><td></td><td>Total (en ' + g.target + ')</td><td>' + g.scores[0] + '</td><td>' + g.scores[1] + '</td></tr></tfoot>';
    $('#score-table').innerHTML = h;
    openModal('m-sheet');
  }
  $('#slate').onclick = openSheet;
  $('#t-sheet').onclick = openSheet;

  $('#t-last').onclick = () => {
    const g = app.msg && app.msg.game;
    if (!g || !g.lastTrick) return;
    const box = $('#last-trick');
    box.innerHTML = '';
    g.lastTrick.cards.forEach(({ seat, card }) => {
      const w = document.createElement('div');
      w.className = 'lt' + (seat === g.lastTrick.winner ? ' win' : '');
      w.appendChild(cardEl(card));
      const n = document.createElement('span'); n.textContent = nameAt(seat); w.appendChild(n);
      box.appendChild(w);
    });
    $('#last-who').textContent = 'Remporté par ' + nameAt(g.lastTrick.winner) + '.';
    openModal('m-last');
  };

  // ----- Réglages -----
  $('#t-settings').onclick = () => {
    $('#opt-autohide').checked = prefs.autoHide;
    $('#opt-sound').checked = prefs.sound;
    $('#opt-confirm').checked = prefs.confirm;
    const m = app.msg;
    $('#host-tools').hidden = !(m && m.isHost);
    if (m && m.isHost) {
      const off = m.players.filter((p) => p.seat != null && !p.isBot && !p.connected && !p.botControl);
      $('#takeover-list').innerHTML = off.length
        ? off.map((p) => '<button class="btn btn-ghost-dark" data-take="' + p.pid + '">Faire jouer un robot pour ' + esc(p.name) + '</button>').join('')
        : '<p class="r-ready">Si un joueur se déconnecte, tu pourras faire jouer un robot à sa place ici.</p>';
    }
    openModal('m-settings');
  };
  $('#opt-autohide').onchange = (e) => { prefs.autoHide = e.target.checked; savePrefs(); };
  $('#opt-sound').onchange = (e) => { prefs.sound = e.target.checked; savePrefs(); };
  $('#opt-confirm').onchange = (e) => { prefs.confirm = e.target.checked; savePrefs(); };
  $('#takeover-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-take]'); if (!b) return;
    send({ t: 'takeover', pid: b.dataset.take }); closeModal('m-settings');
  });
  $('#opt-lobby').onclick = () => { if (confirm('Arrêter la partie en cours ?')) { send({ t: 'toLobby' }); closeModal('m-settings'); } };
  $('#opt-quit').onclick = () => { closeModal('m-settings'); leave(); };

  // ----- Discussion -----
  function renderChat() {
    const m = app.msg; if (!m) return;
    const items = m.chat.map((c) => ({ ts: c.ts, html: '<b>' + esc(c.name) + '</b>' + esc(c.text) })).concat(app.sys.map((s) => ({ ts: s.ts, sys: true, html: esc(s.text) })));
    items.sort((a, b) => a.ts - b.ts);
    const log = $('#chat-log');
    const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 10;
    log.innerHTML = items.slice(-60).map((i) => '<li' + (i.sys ? ' class="sys"' : '') + '>' + i.html + '</li>').join('');
    if (atBottom) log.scrollTop = log.scrollHeight;
    const badge = $('#chat-badge');
    badge.hidden = !app.unread; badge.textContent = app.unread;
  }
  $('#chat-toggle').onclick = () => {
    const p = $('#chat-panel'); p.hidden = !p.hidden;
    if (!p.hidden) { app.unread = 0; renderChat(); $('#chat-log').scrollTop = 1e6; $('#chat-in').focus(); }
  };
  $('#chat-form').onsubmit = (e) => {
    e.preventDefault();
    const v = $('#chat-in').value.trim();
    if (v) send({ t: 'chat', text: v });
    $('#chat-in').value = '';
  };
  $('.chat-quick').addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) send({ t: 'chat', text: b.dataset.q }); });

  // ----- Fenêtres génériques -----
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]');
    if (o) { openModal('m-' + o.dataset.open); return; }
    if (e.target.closest('[data-close]')) { e.target.closest('.modal').hidden = true; return; }
    if (e.target.classList.contains('modal') && !['m-round', 'm-end'].includes(e.target.id)) e.target.hidden = true;
  });

  // ---------- ACCUEIL ----------
  const params = new URLSearchParams(location.search);
  $('#in-name').value = identity.name || '';
  const urlRoom = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (urlRoom) {
    $('#in-code').value = urlRoom;
    $('#home-msg').textContent = 'On t\'invite à la table ' + urlRoom + ' : entre ton pseudo puis « Rejoindre ».';
  }
  function needName() {
    const n = $('#in-name').value.replace(/\s+/g, ' ').trim().slice(0, 18);
    if (!n) { $('#in-name').focus(); $('#home-msg').textContent = 'Choisis d\'abord un pseudo.'; return null; }
    identity.name = n; store.set('coinche-id', identity);
    return n;
  }
  $('#btn-create').onclick = () => { if (needName()) startHost(newCode()); };
  $('#btn-join').onclick = () => {
    if (!needName()) return;
    const code = $('#in-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 5) { $('#in-code').focus(); $('#home-msg').textContent = 'Le code de la table fait 5 caractères.'; return; }
    startClient(code);
  };
  $('#btn-solo').onclick = () => {
    if (!needName()) return;
    startHost('SOLO' + rid(1, 'ABCDEFGHJKLMNPQRSTUVWXYZ'), null, true);
    [1, 2, 3].forEach((s) => send({ t: 'addBot', seat: s }));
    send({ t: 'start' });
  };
  $('#in-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#btn-join').click(); } });
  $('#home-form').onsubmit = (e) => { e.preventDefault(); ($('#in-code').value.trim() ? $('#btn-join') : $('#btn-create')).click(); };

  // Reprise automatique après un rechargement de page
  const sess = store.get('coinche-session', null);
  if (sess && Date.now() - sess.at < SIX_HOURS && identity.name && (!urlRoom || urlRoom === sess.code)) {
    if (sess.role === 'host') {
      const saved = store.get('coinche-host-' + sess.code, null);
      if (saved && Date.now() - saved.at < SIX_HOURS) startHost(sess.code, saved.s, sess.code.startsWith('SOLO'));
      else store.del('coinche-session');
    } else startClient(sess.code);
  }
  // Nettoyage des vieilles sauvegardes d'hôte
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('coinche-host-')) { const v = store.get(k, null); if (!v || Date.now() - v.at > SIX_HOURS) localStorage.removeItem(k); }
    }
  } catch (e) { /* */ }
  setInterval(() => { const s = store.get('coinche-session', null); if (s && app.link) { s.at = Date.now(); store.set('coinche-session', s); } }, 60000);
})();
