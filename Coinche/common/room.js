/* ============================================================
   Salle de jeux — coque commune : accueil, salon, discussion,
   réglages, reprise après rechargement. Chaque jeu fournit render().
   ============================================================ */
(function () {
  'use strict';
  const { RoomHost, RoomClient, rid, store, newCode } = window.SalleNet;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const SIX_HOURS = 6 * 3600 * 1000;

  // ---------- Sons ----------
  const Sound = {
    ctx: null, enabled: true,
    init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* */ } } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    tone(f, t0, d, type, v) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, c.currentTime + t0); g.gain.linearRampToValueAtTime(v || .07, c.currentTime + t0 + .01);
      g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + t0 + d);
      o.connect(g).connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + d + .05);
    },
    noise(t0, d, f, v, q) {
      const c = this.ctx, len = Math.floor(c.sampleRate * d), b = c.createBuffer(1, len, c.sampleRate), x = b.getChannelData(0);
      for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
      fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q || .9; g.gain.value = v;
      s.buffer = b; s.connect(fl).connect(g).connect(c.destination); s.start(c.currentTime + t0);
    },
    play(k) {
      if (!this.enabled || !this.ctx) return;
      try {
        if (k === 'card') this.noise(0, .09, 2400, .5);
        else if (k === 'deal') { for (let i = 0; i < 6; i++) this.noise(i * .06, .06, 2800, .25); }
        else if (k === 'turn') { this.tone(659, 0, .18, 'sine', .07); this.tone(988, .11, .3, 'sine', .06); }
        else if (k === 'chip') { this.noise(0, .05, 5200, .35, 4); this.noise(.05, .05, 4600, .3, 4); }
        else if (k === 'dice') { for (let i = 0; i < 5; i++) this.noise(i * .05 + Math.random() * .02, .05, 1600 + Math.random() * 900, .4, 2); }
        else if (k === 'coin') { this.tone(1319, 0, .12, 'square', .03); this.tone(1760, .07, .25, 'square', .03); }
        else if (k === 'build') { this.noise(0, .08, 400, .6, 1.5); this.noise(.12, .08, 380, .5, 1.5); }
        else if (k === 'trick') this.noise(0, .2, 900, .35);
        else if (k === 'good') [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * .09, .35, 'triangle', .06));
        else if (k === 'bad') [392, 330, 262].forEach((f, i) => this.tone(f, i * .12, .35, 'sine', .06));
        else if (k === 'alert') { this.tone(196, 0, .25, 'square', .05); this.tone(147, .12, .35, 'square', .05); }
        else if (k === 'chat') this.tone(880, 0, .12, 'sine', .04);
      } catch (e) { /* */ }
    },
  };
  document.addEventListener('pointerdown', () => Sound.init(), { capture: true });

  const ICON = {
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    rules: '<svg viewBox="0 0 24 24"><path d="M12 17h.01M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="7" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  };

  function start(cfg) {
    const M = cfg.module;
    const identity = store.get('salle-id', null) || store.get('coinche-id', null) || { token: rid(24), name: '' };
    store.set('salle-id', identity);
    let tabId;
    try { tabId = sessionStorage.getItem('salle-tab') || rid(12); sessionStorage.setItem('salle-tab', tabId); } catch (e) { tabId = rid(12); }
    const prefs = Object.assign({ autoHide: false, sound: true }, store.get('salle-prefs', {}));
    Sound.enabled = prefs.sound;
    const savePrefs = () => { store.set('salle-prefs', prefs); Sound.enabled = prefs.sound; };
    const SESSION_KEY = 'salle-session-' + M.id;

    const app = { link: null, isHost: false, code: null, msg: null, hidden: false, sys: [], unread: 0, status: '' };

    // ---------- DOM ----------
    document.body.classList.add('salle', cfg.themeClass || '');
    document.body.insertAdjacentHTML('afterbegin', `
<section id="r-home" class="r-screen r-felt">
  <a class="r-back" href="../">← Tous les jeux</a>
  <div class="r-home-inner">
    <div class="r-hero" aria-hidden="true">${cfg.hero || ''}</div>
    <h1 class="r-title">${esc(cfg.title)}</h1>
    <p class="r-sub">${esc(cfg.tagline || '')}</p>
    <form id="r-form" class="r-form" autocomplete="off">
      <label class="r-field"><span>Ton pseudo</span><input id="r-name" maxlength="18" placeholder="Ex. Baptiste" required></label>
      <button type="button" id="r-create" class="r-btn r-btn-accent r-btn-wide">Créer une table</button>
      <div class="r-join"><input id="r-code" maxlength="5" placeholder="CODE" aria-label="Code de la table" spellcheck="false"><button type="button" id="r-joinb" class="r-btn r-btn-ghost">Rejoindre</button></div>
      <button type="button" id="r-solo" class="r-link">Jouer seul contre des robots</button>
      <p id="r-hmsg" class="r-hmsg" role="status"></p>
    </form>
    <p class="r-players">${esc(M.minPlayers === M.maxPlayers ? M.minPlayers + ' joueurs' : M.minPlayers + ' à ' + M.maxPlayers + ' joueurs')} · <button class="r-link" data-ropen="rules">Règles du jeu</button></p>
  </div>
</section>
<section id="r-lobby" class="r-screen r-felt" hidden>
  <div class="r-lobby-wrap">
    <header class="r-lobby-head">
      <div><p class="r-dim">${esc(cfg.title)} — code de la table</p><p id="r-lcode" class="r-lcode">-----</p></div>
      <div class="r-share"><button id="r-copy" class="r-btn r-btn-accent">Copier le lien d'invitation</button><p id="r-net" class="r-net"></p></div>
    </header>
    <div class="r-lobby-body">
      <div><p class="r-dim r-mb">Clique sur une place libre pour t'asseoir. ${esc(cfg.lobbyNote || '')}</p><div id="r-seats" class="r-seats"></div></div>
      <aside class="r-side">
        <div id="r-hostc" class="r-hostc">
          <div class="r-row"><button id="r-random" class="r-btn r-btn-ghost">Places au hasard</button><button id="r-addbot" class="r-btn r-btn-ghost">Ajouter un robot</button></div>
          <div id="r-settings" class="r-settings"></div>
          <button id="r-start" class="r-btn r-btn-accent r-btn-big">Lancer la partie</button>
        </div>
        <p id="r-gwait" class="r-dim" hidden>L'hôte lancera la partie quand tout le monde sera assis.</p>
        <div><p class="r-dim r-mb">En attente d'une place</p><ul id="r-spec" class="r-spec"></ul></div>
        <button id="r-stand" class="r-link" hidden>Regarder sans jouer</button>
        <button id="r-leave" class="r-link">Quitter la table</button>
      </aside>
    </div>
  </div>
</section>
<section id="r-game" class="r-screen" hidden>
  <div id="game-root" class="game-root"></div>
  <div class="r-dock">
    <button class="r-tool" id="r-chatb" title="Discuter">${ICON.chat}<b id="r-badge" class="r-badge" hidden>0</b></button>
    <button class="r-tool" data-ropen="rules" title="Règles">${ICON.rules}</button>
    <button class="r-tool" id="r-setb" title="Réglages">${ICON.settings}</button>
  </div>
  <div class="r-chat" id="r-chat" hidden>
    <ul class="r-chatlog" id="r-chatlog"></ul>
    <div class="r-quick"><button data-q="Bien joué !">Bien joué !</button><button data-q="Aïe…">Aïe…</button><button data-q="Allez !">Allez !</button><button data-q="😂">😂</button><button data-q="🔥">🔥</button></div>
    <form id="r-chatf" class="r-chatf"><input id="r-chatin" maxlength="240" placeholder="Écrire un message…" autocomplete="off"><button class="r-btn r-btn-accent">Envoyer</button></form>
  </div>
  ${cfg.hideable ? `<button class="r-hide" id="r-hide" title="Cacher mes cartes (touche H)">${ICON.eye}<span id="r-hidel">Cacher mes cartes</span><kbd>H</kbd></button>` : ''}
  <p class="r-banner" id="r-banner" hidden></p>
  <div class="r-spy" id="r-spy" hidden><button class="r-spy-h" id="r-spyh"><span>Vue spectateur</span><small>toutes les cartes</small><i>▾</i></button><div class="r-spy-b" id="r-spyb"></div></div>
</section>
<div class="r-modal" id="rm-rules" hidden><div class="r-sheet r-paper r-rules"><button class="r-close" data-rclose>&times;</button><h2>Règles — ${esc(cfg.title)}</h2>${cfg.rulesHtml || ''}</div></div>
<div class="r-modal" id="rm-set" hidden><div class="r-sheet r-paper">
  <button class="r-close" data-rclose>&times;</button><h2>Réglages</h2>
  ${cfg.hideable ? '<label class="r-check"><input type="checkbox" id="r-oauto"> Cacher automatiquement mes cartes quand je quitte la fenêtre</label>' : ''}
  <label class="r-check"><input type="checkbox" id="r-osound"> Sons</label>
  <div id="r-htools" class="r-htools" hidden><p class="r-strong">Outils de l'hôte</p><div id="r-take"></div><button class="r-btn r-btn-ink" id="r-olobby">Arrêter la partie et revenir au salon</button></div>
  <button class="r-btn r-btn-ink" id="r-oquit">Quitter la table</button>
</div></div>
<div class="r-toast" id="r-toast" role="status" hidden></div>`);

    function show(id) { for (const s of ['r-home', 'r-lobby', 'r-game']) $('#' + s).hidden = s !== id; }
    let toastT;
    function toast(text, ms) {
      const t = $('#r-toast'); t.textContent = text; t.hidden = false;
      t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
      clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 2600);
    }
    const send = (m) => app.link && app.send(m);
    const players = () => (app.msg ? app.msg.players : []);
    const playerOf = (g) => players().find((p) => p.gseat === g);
    const nameOf = (g) => { const p = playerOf(g); return p ? p.name : '—'; };

    const api = {
      esc, $, $$, Sound, prefs, toast,
      act: (a) => send({ t: 'act', a }),
      host: (t) => send({ t }),
      me: () => (app.msg ? app.msg.gseat : null),
      isHost: () => !!(app.msg && app.msg.isHost),
      playerOf, nameOf, players,
      hidden: () => app.hidden,
      setHidden: (v) => setHidden(v),
      msg: () => app.msg,
      rerender: () => { if (app.msg && app.msg.game) cfg.render(app.msg, api); },
      // Panneau « vue spectateur » (commande /spec)
      spy: (html) => {
        const box = $('#r-spy');
        if (html == null) { box.hidden = true; return; }
        if (box.hidden) box.classList.toggle('open', window.innerWidth > 640);
        box.hidden = false;
        const b = $('#r-spyb');
        if (b.dataset.h !== html) { b.dataset.h = html; b.innerHTML = html; }
      },
    };

    // ---------- Liens ----------
    function setUrlRoom(code) {
      const q = new URLSearchParams(location.search);
      if (code) q.set('room', code); else q.delete('room');
      const s = q.toString();
      history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
    }
    function inviteUrl(code) { const q = new URLSearchParams(location.search); q.set('room', code); return location.origin + location.pathname + '?' + q.toString(); }

    function startHost(code, saved, offline) {
      app.isHost = true; app.code = code;
      app.link = new RoomHost({ module: M, code, name: identity.name, token: identity.token, saved, offline, onLocal: (m) => { if (m.t === 'state') onState(m); else if (m.t === 'err') toast(m.msg); }, onStatus: setStatus });
      app.send = (m) => app.link.handle(identity.token, m);
      store.set(SESSION_KEY, { role: 'host', code, at: Date.now(), offline: !!offline });
      setUrlRoom(offline ? null : code);
    }
    function startClient(code) {
      app.isHost = false; app.code = code;
      $('#r-hmsg').textContent = 'Connexion à la table ' + code + '…';
      app.link = new RoomClient({
        gameId: M.id, code, name: identity.name, token: identity.token, tab: tabId,
        onMsg: (m) => { if (m.t === 'state') onState(m); else if (m.t === 'err') toast(m.msg); },
        onStatus: setStatus,
      });
      app.send = (m) => { if (!app.link.send(m)) toast('Connexion perdue avec l\'hôte… reconnexion en cours.'); };
      store.set(SESSION_KEY, { role: 'guest', code, at: Date.now() });
      setUrlRoom(code);
    }
    function leave() {
      if (app.link) {
        if (app.isHost && app.msg && app.msg.players.some((p) => !p.isBot && !p.isHost && p.connected)) {
          if (!confirm('Tu es l\'hôte : si tu quittes, la table se ferme pour tout le monde. Quitter ?')) return;
        }
        app.link.destroy();
      }
      app.link = null; app.msg = null; app.sys = [];
      store.del(SESSION_KEY); setUrlRoom(null);
      $$('.r-modal').forEach((m) => { m.hidden = true; });
      if (cfg.onLeave) cfg.onLeave();
      $('#r-hmsg').textContent = '';
      show('r-home');
    }

    const STATUS = {
      host: { online: 'Table en ligne — tes potes peuvent rejoindre', connecting: 'Connexion au serveur…', offline: 'Hors ligne — partie contre les robots uniquement' },
      guest: { online: 'Connecté à l\'hôte', connecting: 'Connexion…', reconnecting: 'Reconnexion…', notfound: 'Table introuvable', hostgone: 'L\'hôte est injoignable' },
    };
    function setStatus(st) {
      app.status = st;
      const el = $('#r-net');
      el.textContent = (STATUS[app.isHost ? 'host' : 'guest'] || {})[st] || '';
      el.className = 'r-net ' + (st === 'online' ? 'ok' : ['offline', 'notfound', 'hostgone'].includes(st) ? 'ko' : 'wait');
      if (!app.isHost && st === 'notfound' && !app.msg) {
        app.link.destroy(); app.link = null; store.del(SESSION_KEY); show('r-home');
        $('#r-hmsg').textContent = 'Aucune table de ' + cfg.title + ' avec le code ' + app.code + '. Vérifie le code — l\'hôte doit garder sa page ouverte.';
        return;
      }
      const b = $('#r-banner');
      if (!app.isHost && app.msg && st !== 'online') { b.hidden = false; b.textContent = st === 'hostgone' ? 'L\'hôte est injoignable — on attend son retour…' : 'Connexion perdue — reconnexion…'; }
      else b.hidden = true;
    }

    // ---------- État ----------
    function onState(msg) {
      const prev = app.msg;
      app.msg = msg;
      for (const ev of msg.evs || []) {
        if (ev.type === 'chat') {
          if (ev.pid !== msg.me) { if ($('#r-chat').hidden) app.unread++; Sound.play('chat'); }
        } else if (ev.type === 'sys') app.sys.push({ text: ev.text, ts: Date.now() });
        if (cfg.onEvent && msg.game) { try { cfg.onEvent(ev, msg, api); } catch (e) { console.error(e); } }
      }
      const w = msg.game && msg.game.waiting;
      const myTurn = !!(w && msg.gseat != null && w.includes(msg.gseat));
      const wasTurn = !!(prev && prev.game && prev.game.waiting && prev.gseat != null && prev.game.waiting.includes(prev.gseat));
      if (myTurn && !wasTurn) Sound.play('turn');
      document.title = (myTurn && document.hidden ? '● À toi — ' : '') + cfg.title + ' entre potes';
      if (msg.game) {
        show('r-game');
        if ($('#r-hide')) $('#r-hide').hidden = msg.gseat == null;
        try { cfg.render(msg, api); } catch (e) { console.error(e); }
        if (!msg.game.spy) api.spy(null);
        else if (!cfg.spyRows) { const first = $('#r-spy').hidden; api.spy('<p class="r-spy-note">Toutes les cartes sont visibles sur la table.</p>'); if (first) $('#r-spy').classList.remove('open'); }
        else { try { api.spy(cfg.spyRows(msg.game, api)); } catch (e) { console.error(e); } }
      }
      else { show('r-lobby'); renderLobby(); }
      renderChat();
    }

    function renderLobby() {
      const m = app.msg;
      $('#r-lcode').textContent = m.code;
      let h = '';
      for (let s = 0; s < M.maxPlayers; s++) {
        const p = players().find((x) => x.seat === s);
        const label = cfg.seatLabel ? cfg.seatLabel(s) : 'Place ' + (s + 1);
        if (p) {
          const tags = [p.pid === m.me ? 'Toi' : null, p.isHost ? 'Hôte' : null, p.isBot ? 'Robot' : null, !p.connected ? 'Déconnecté' : null].filter(Boolean).join(' · ');
          h += `<div class="r-seat full${p.pid === m.me ? ' me' : ''}" style="--pc:var(--p${s})"><span class="r-av${p.isBot ? ' bot' : ''}">${esc(p.name[0].toUpperCase())}</span><span class="r-who"><b>${esc(p.name)}</b><small>${esc(label + (tags ? ' · ' + tags : ''))}</small></span>${m.isHost && !p.isHost ? `<button class="r-x" data-remove="${p.pid}" title="Retirer">×</button>` : ''}</div>`;
        } else {
          h += `<div class="r-seat empty" style="--pc:var(--p${s})"><span class="r-who"><small>${esc(label)}</small><button class="r-sit" data-sit="${s}">S'asseoir ici</button></span>${m.isHost ? `<button class="r-addb" data-bot="${s}">+ Robot</button>` : ''}</div>`;
        }
      }
      $('#r-seats').innerHTML = h;
      $('#r-hostc').hidden = !m.isHost; $('#r-gwait').hidden = m.isHost;
      const n = players().filter((x) => x.seat != null).length;
      const st = $('#r-start');
      st.disabled = n < M.minPlayers;
      st.textContent = n < M.minPlayers ? 'Il faut au moins ' + M.minPlayers + ' joueurs' : 'Lancer la partie à ' + n;
      $('#r-addbot').disabled = n >= M.maxPlayers;
      $('#r-settings').innerHTML = (M.settingsUI || []).map((d) => `<label class="r-field r-inline"><span>${esc(d.label)}</span><select data-key="${d.key}">${d.options.map((o) => `<option value="${esc(o.value)}"${String(m.settings[d.key]) === String(o.value) ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('');
      const meP = players().find((x) => x.pid === m.me);
      $('#r-stand').hidden = !(meP && meP.seat != null);
      const spec = players().filter((p) => p.seat == null);
      $('#r-spec').innerHTML = spec.length ? spec.map((p) => '<li>' + esc(p.name) + (p.pid === m.me ? ' (toi)' : '') + '</li>').join('') : '<li class="none">Personne</li>';
    }
    $('#r-lobby').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.sit != null) send({ t: 'sit', seat: Number(b.dataset.sit) });
      else if (b.dataset.bot != null) send({ t: 'addBot', seat: Number(b.dataset.bot) });
      else if (b.dataset.remove) send({ t: 'remove', pid: b.dataset.remove });
    });
    $('#r-settings').addEventListener('change', (e) => { const s = e.target.closest('select'); if (s) send({ t: 'settings', key: s.dataset.key, value: s.value }); });
    $('#r-random').onclick = () => send({ t: 'random' });
    $('#r-addbot').onclick = () => send({ t: 'addBot' });
    $('#r-start').onclick = () => send({ t: 'start' });
    $('#r-leave').onclick = leave;
    $('#r-stand').onclick = () => send({ t: 'stand' });
    $('#r-spyh').onclick = () => $('#r-spy').classList.toggle('open');
    $('#r-copy').onclick = async () => {
      const url = inviteUrl(app.msg.code);
      try { await navigator.clipboard.writeText(url); toast('Lien copié ! Envoie-le à tes potes.'); }
      catch (e) { const i = document.createElement('input'); i.value = url; document.body.appendChild(i); i.select(); try { document.execCommand('copy'); toast('Lien copié ! Envoie-le à tes potes.'); } catch (e2) { prompt('Copie ce lien :', url); } i.remove(); }
    };

    // ---------- Discussion ----------
    function renderChat() {
      const m = app.msg; if (!m) return;
      const items = m.chat.map((c) => ({ ts: c.ts, html: '<b>' + esc(c.name) + '</b>' + esc(c.text) })).concat(app.sys.map((s) => ({ ts: s.ts, sys: true, html: esc(s.text) })));
      items.sort((a, b) => a.ts - b.ts);
      const log = $('#r-chatlog');
      const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 10;
      log.innerHTML = items.slice(-60).map((i) => '<li' + (i.sys ? ' class="sys"' : '') + '>' + i.html + '</li>').join('');
      if (atBottom) log.scrollTop = log.scrollHeight;
      const b = $('#r-badge'); b.hidden = !app.unread; b.textContent = app.unread;
    }
    $('#r-chatb').onclick = () => { const p = $('#r-chat'); p.hidden = !p.hidden; if (!p.hidden) { app.unread = 0; renderChat(); $('#r-chatlog').scrollTop = 1e6; $('#r-chatin').focus(); } };
    $('#r-chatf').onsubmit = (e) => { e.preventDefault(); const v = $('#r-chatin').value.trim(); if (v) send({ t: 'chat', text: v }); $('#r-chatin').value = ''; };
    $('.r-quick').addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (b) send({ t: 'chat', text: b.dataset.q }); });

    // ---------- Cacher ----------
    function setHidden(v) {
      if (!cfg.hideable) return;
      app.hidden = v;
      document.body.classList.toggle('cards-hidden', v);
      const b = $('#r-hide'); if (b) { b.classList.toggle('on', v); $('#r-hidel').textContent = v ? 'Montrer mes cartes' : 'Cacher mes cartes'; }
      api.rerender();
    }
    if (cfg.hideable) {
      $('#r-hide').onclick = () => setHidden(!app.hidden);
      window.addEventListener('blur', () => { if (prefs.autoHide && app.msg && app.msg.game) setHidden(true); });
      document.addEventListener('visibilitychange', () => { if (document.hidden && prefs.autoHide && app.msg && app.msg.game) setHidden(true); });
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { $$('.r-modal').forEach((m) => { if (!m.dataset.sticky) m.hidden = true; }); $('#r-chat').hidden = true; return; }
      if (e.target.matches('input, textarea, select')) return;
      if (cfg.hideable && (e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey && app.msg && app.msg.game) setHidden(!app.hidden);
      if (cfg.onKey && app.msg && app.msg.game) cfg.onKey(e, api);
    });

    // ---------- Réglages ----------
    $('#r-setb').onclick = () => {
      if ($('#r-oauto')) $('#r-oauto').checked = prefs.autoHide;
      $('#r-osound').checked = prefs.sound;
      const m = app.msg;
      $('#r-htools').hidden = !(m && m.isHost);
      if (m && m.isHost) {
        const off = m.players.filter((p) => p.gseat != null && !p.isBot && !p.connected && !p.botControl);
        $('#r-take').innerHTML = off.length ? off.map((p) => `<button class="r-btn r-btn-ink" data-take="${p.pid}">Faire jouer un robot pour ${esc(p.name)}</button>`).join('') : '<p class="r-dim-ink">Si un joueur se déconnecte, tu pourras faire jouer un robot à sa place ici.</p>';
      }
      $('#rm-set').hidden = false;
    };
    if ($('#r-oauto')) $('#r-oauto').onchange = (e) => { prefs.autoHide = e.target.checked; savePrefs(); };
    $('#r-osound').onchange = (e) => { prefs.sound = e.target.checked; savePrefs(); };
    $('#r-take').addEventListener('click', (e) => { const b = e.target.closest('[data-take]'); if (b) { send({ t: 'takeover', pid: b.dataset.take }); $('#rm-set').hidden = true; } });
    $('#r-olobby').onclick = () => { if (confirm('Arrêter la partie en cours ?')) { send({ t: 'toLobby' }); $('#rm-set').hidden = true; } };
    $('#r-oquit').onclick = () => { $('#rm-set').hidden = true; leave(); };

    document.addEventListener('click', (e) => {
      const o = e.target.closest('[data-ropen]');
      if (o) { $('#rm-' + o.dataset.ropen).hidden = false; return; }
      if (e.target.closest('[data-rclose]')) { e.target.closest('.r-modal').hidden = true; return; }
      if (e.target.classList.contains('r-modal') && !e.target.dataset.sticky) e.target.hidden = true;
    });

    // ---------- Accueil ----------
    const params = new URLSearchParams(location.search);
    $('#r-name').value = identity.name || '';
    const urlRoom = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (urlRoom) { $('#r-code').value = urlRoom; $('#r-hmsg').textContent = 'On t\'invite à la table ' + urlRoom + ' : entre ton pseudo puis « Rejoindre ».'; }
    function needName() {
      const n = $('#r-name').value.replace(/\s+/g, ' ').trim().slice(0, 18);
      if (!n) { $('#r-name').focus(); $('#r-hmsg').textContent = 'Choisis d\'abord un pseudo.'; return null; }
      identity.name = n; store.set('salle-id', identity);
      return n;
    }
    $('#r-create').onclick = () => { if (needName()) startHost(newCode(cfg.prefix)); };
    $('#r-joinb').onclick = () => {
      if (!needName()) return;
      const code = $('#r-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length !== 5) { $('#r-code').focus(); $('#r-hmsg').textContent = 'Le code de la table fait 5 caractères.'; return; }
      startClient(code);
    };
    $('#r-solo').onclick = () => {
      if (!needName()) return;
      startHost('S' + rid(4, 'ABCDEFGHJKLMNPQRSTUVWXYZ'), null, true);
      const n = cfg.soloPlayers || M.minPlayers;
      for (let i = 1; i < n; i++) send({ t: 'addBot' });
      send({ t: 'start' });
    };
    $('#r-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#r-joinb').click(); } });
    $('#r-form').onsubmit = (e) => { e.preventDefault(); ($('#r-code').value.trim() ? $('#r-joinb') : $('#r-create')).click(); };

    // Reprise automatique
    const sess = store.get(SESSION_KEY, null);
    if (sess && Date.now() - sess.at < SIX_HOURS && identity.name && (!urlRoom || urlRoom === sess.code)) {
      if (sess.role === 'host') {
        const saved = store.get('salle-host-' + M.id + '-' + sess.code, null);
        if (saved && Date.now() - saved.at < SIX_HOURS) startHost(sess.code, saved.s, sess.offline);
        else store.del(SESSION_KEY);
      } else startClient(sess.code);
    }
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith('salle-host-')) { const v = store.get(k, null); if (!v || Date.now() - v.at > SIX_HOURS) localStorage.removeItem(k); }
      }
    } catch (e) { /* */ }
    setInterval(() => { const s = store.get(SESSION_KEY, null); if (s && app.link) { s.at = Date.now(); store.set(SESSION_KEY, s); } }, 60000);
    return api;
  }

  window.SalleRoom = { start, esc };
})();
