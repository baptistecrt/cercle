/* ============================================================
   Salle de jeux — réseau pair-à-pair générique (PeerJS / WebRTC)
   L'hôte fait tourner la partie ; chaque joueur ne reçoit que SA vue.
   Un jeu fournit un "module" :
     id, minPlayers, maxPlayers, defaultSettings, settingsUI
     create({settings, names, n}) → état
     apply(état, siège, action) → {events} | {error}
     view(état, siège|null) → vue envoyée au joueur
     waiting(état) → [sièges qui doivent agir]
     bot(état, siège) → action          (robots)
     tick(état) → {ms, run(état)→events} | null   (transitions temporisées)
     isOver(état) → bool
   ============================================================ */
(function (root) {
  'use strict';
  const ID_PREFIX = 'salle-bc26-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const BOT_NAMES = ['Marcel', 'Josiane', 'Gégé', 'Ginette', 'Dédé', 'Paulette', 'Jojo', 'Mimi', 'Lulu', 'Riri'];

  function randInt(n) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n;
    }
    return Math.floor(Math.random() * n);
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function rid(n, chars) { chars = chars || 'abcdefghijklmnopqrstuvwxyz0123456789'; let s = ''; for (let i = 0; i < n; i++) s += chars[randInt(chars.length)]; return s; }
  const newCode = (prefix) => prefix + rid(4, CODE_CHARS);
  function cleanName(n) { n = String(n || '').replace(/\s+/g, ' ').trim().slice(0, 18); return n || 'Joueur'; }

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } },
  };

  function peerOptions() {
    const q = new URLSearchParams(location.search);
    const o = { debug: 1, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }] } };
    if (q.get('peerhost')) {
      o.host = q.get('peerhost'); o.port = Number(q.get('peerport') || 443); o.path = q.get('peerpath') || '/';
      o.secure = q.get('peersecure') ? q.get('peersecure') === '1' : o.port === 443;
    }
    if (q.get('turn')) o.config.iceServers.push({ urls: q.get('turn'), username: q.get('turnuser') || '', credential: q.get('turnpass') || '' });
    return o;
  }

  // ------------------------------------------------------------------
  class RoomHost {
    constructor({ module, code, name, token, saved, onLocal, onStatus, offline }) {
      this.M = module;
      this.onLocal = onLocal;
      this.onStatus = onStatus || (() => {});
      this.conns = new Map();
      this.pending = [];
      this.timer = null;
      this.offline = !!offline;
      if (saved) {
        this.s = saved;
        for (const p of this.s.players) if (!p.isBot && !p.isHost) p.connected = false;
      } else {
        this.s = { code, gameId: module.id, hostToken: token, settings: JSON.parse(JSON.stringify(module.defaultSettings || {})), players: [], game: null, chat: [], created: Date.now() };
        this.s.players.push({ token, pid: rid(8), name, seat: 0, gseat: null, isBot: false, isHost: true, connected: true, botControl: false, lastSeen: Date.now() });
      }
      const me = this.s.players.find((p) => p.isHost);
      me.name = name || me.name; me.connected = true;
      if (!this.offline) this.openPeer(0); else this.onStatus('offline');
      this.watch = setInterval(() => this.checkAlive(), 3000);
      this.update();
    }
    get code() { return this.s.code; }
    peerId() { return ID_PREFIX + this.M.id + '-' + this.s.code; }

    openPeer(attempt) {
      if (typeof Peer === 'undefined') { this.onStatus('offline'); return; }
      this.onStatus('connecting');
      const peer = new Peer(this.peerId(), peerOptions());
      this.peer = peer;
      peer.on('open', () => this.onStatus('online'));
      peer.on('connection', (conn) => this.attach(conn));
      peer.on('disconnected', () => { this.onStatus('connecting'); setTimeout(() => { if (!peer.destroyed) try { peer.reconnect(); } catch (e) { /* */ } }, 1500); });
      peer.on('error', (err) => {
        if (err.type === 'unavailable-id' && attempt < 25) { peer.destroy(); setTimeout(() => this.openPeer(attempt + 1), 3000); this.onStatus('connecting'); }
        else if (['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible', 'ssl-unavailable'].includes(err.type)) {
          this.onStatus('offline');
          if (!peer.destroyed) setTimeout(() => { if (peer.disconnected && !peer.destroyed) try { peer.reconnect(); } catch (e) { /* */ } }, 4000);
        }
      });
    }

    attach(conn) {
      conn.on('data', (msg) => {
        if (!msg || typeof msg !== 'object') return;
        if (msg.t === 'hello') return this.hello(conn, msg);
        const token = conn._token;
        if (!token) return;
        const p = this.s.players.find((x) => x.token === token);
        if (p) { p.lastSeen = Date.now(); if (!p.connected) { p.connected = true; this.update(); } }
        if (msg.t === 'ping') { try { conn.send({ t: 'pong' }); } catch (e) { /* */ } return; }
        this.handle(token, msg);
      });
      conn.on('close', () => this.dropConn(conn));
      conn.on('error', () => this.dropConn(conn));
    }

    hello(conn, msg) {
      let token = String(msg.token || '').slice(0, 64);
      const name = cleanName(msg.name);
      const tab = String(msg.tab || '').slice(0, 32);
      if (!token) return;
      let p = this.s.players.find((x) => x.token === token);
      const live = p && p.connected && this.conns.get(token) && this.conns.get(token).open && p.tab && p.tab !== tab && Date.now() - (p.lastSeen || 0) < 12000;
      if (token === this.s.hostToken || live) { token = rid(24); p = null; try { conn.send({ t: 'retoken', token }); } catch (e) { /* */ } }
      if (!p) {
        if (this.s.players.filter((x) => !x.isBot).length >= 14) { conn.send({ t: 'err', msg: 'La table est pleine.' }); return; }
        p = { token, pid: rid(8), name, seat: null, gseat: null, isBot: false, isHost: false, connected: true, botControl: false };
        this.s.players.push(p);
        if (!this.s.game) { const free = this.freeSeat(); if (free != null) p.seat = free; }
        this.event({ type: 'sys', text: name + ' a rejoint la table' });
      } else {
        p.name = name || p.name;
        if (p.botControl) this.event({ type: 'sys', text: p.name + ' reprend sa place' });
        p.botControl = false;
      }
      const old = this.conns.get(token);
      if (old && old !== conn) try { old.close(); } catch (e) { /* */ }
      this.conns.set(token, conn);
      conn._token = token;
      p.tab = tab; p.connected = true; p.lastSeen = Date.now();
      this.update();
    }

    freeSeat() { for (let s = 0; s < this.M.maxPlayers; s++) if (!this.seatPlayer(s)) return s; return null; }
    dropConn(conn) {
      const token = conn._token;
      if (!token || this.conns.get(token) !== conn) return;
      this.conns.delete(token);
      const p = this.s.players.find((x) => x.token === token);
      if (p) { p.connected = false; this.update(); }
    }
    checkAlive() {
      const now = Date.now(); let changed = false;
      for (const p of this.s.players) {
        if (p.isBot || p.isHost || !p.connected) continue;
        if (p.lastSeen && now - p.lastSeen > 15000) { p.connected = false; changed = true; }
      }
      if (changed) this.update();
    }
    seatPlayer(s) { return this.s.players.find((p) => p.seat === s); }
    gPlayer(g) { return this.s.players.find((p) => p.gseat === g); }
    event(ev) { this.pending.push(ev); }

    handle(token, msg) {
      const p = this.s.players.find((x) => x.token === token);
      if (!p) return;
      const host = token === this.s.hostToken;
      const g = this.s.game;
      const err = (m) => this.sendTo(token, { t: 'err', msg: m });
      const seated = () => this.s.players.filter((x) => x.seat != null);
      switch (msg.t) {
        case 'sit': {
          if (g) return err('La partie est en cours.');
          const seat = Number(msg.seat);
          if (!(seat >= 0 && seat < this.M.maxPlayers)) return;
          const occ = this.seatPlayer(seat);
          if (occ && occ !== p) {
            if (occ.isBot && host) this.s.players = this.s.players.filter((x) => x !== occ);
            else if (!occ.isBot && host) occ.seat = p.seat;
            else return err('Cette place est prise.');
          }
          p.seat = seat; break;
        }
        case 'stand': if (!g) p.seat = null; break;
        case 'random': {
          if (!host || g) return;
          const list = seated();
          const seats = shuffle(list.map((x) => x.seat));
          list.forEach((x, i) => { x.seat = seats[i]; });
          this.event({ type: 'sys', text: 'Places tirées au sort' });
          break;
        }
        case 'addBot': {
          if (!host || g) return;
          const seat = msg.seat != null ? Number(msg.seat) : this.freeSeat();
          if (seat == null || seat >= this.M.maxPlayers || this.seatPlayer(seat)) return;
          const used = new Set(this.s.players.map((x) => x.name));
          const name = BOT_NAMES.find((n) => !used.has(n)) || 'Robot';
          this.s.players.push({ token: 'bot-' + rid(10), pid: rid(8), name, seat, gseat: null, isBot: true, isHost: false, connected: true, botControl: false });
          break;
        }
        case 'remove': {
          if (!host || g) return;
          const t = this.s.players.find((x) => x.pid === msg.pid);
          if (!t || t.isHost) return;
          if (t.isBot) this.s.players = this.s.players.filter((x) => x !== t); else t.seat = null;
          break;
        }
        case 'settings': {
          if (!host || g) return;
          const def = (this.M.settingsUI || []).find((x) => x.key === msg.key);
          if (!def) return;
          const opt = def.options.find((o) => String(o.value) === String(msg.value));
          if (opt) this.s.settings[msg.key] = opt.value;
          break;
        }
        case 'start': {
          if (!host || g) return;
          const n = seated().length;
          if (n < this.M.minPlayers) return err('Il faut au moins ' + this.M.minPlayers + ' joueurs assis (tu peux ajouter des robots).');
          this.newGame(); break;
        }
        case 'newGame': if (host && g && this.M.isOver(g)) this.newGame(); break;
        case 'toLobby': if (host) { this.s.game = null; for (const x of this.s.players) x.gseat = null; this.event({ type: 'sys', text: 'Retour au salon' }); } break;
        case 'takeover': {
          if (!host || !g) return;
          const t = this.s.players.find((x) => x.pid === msg.pid);
          if (t && !t.isBot && !t.connected) { t.botControl = true; this.event({ type: 'sys', text: 'Un robot joue pour ' + t.name }); }
          break;
        }
        case 'act': {
          if (!g || p.gseat == null) return;
          let res;
          try { res = this.M.apply(g, p.gseat, msg.a || {}); } catch (e) { console.error(e); return err('Action impossible.'); }
          if (res.error) return err(res.error);
          (res.events || []).forEach((e) => this.event(e));
          break;
        }
        case 'chat': {
          const text = String(msg.text || '').trim().slice(0, 240);
          if (!text) return;
          this.s.chat.push({ pid: p.pid, name: p.name, text, ts: Date.now() });
          if (this.s.chat.length > 80) this.s.chat.shift();
          this.event({ type: 'chat', pid: p.pid, text });
          break;
        }
        default: return;
      }
      this.update();
    }

    newGame() {
      const list = this.s.players.filter((x) => x.seat != null).sort((a, b) => a.seat - b.seat);
      for (const x of this.s.players) x.gseat = null;
      list.forEach((x, i) => { x.gseat = i; });
      const res = this.M.create({ settings: this.s.settings, names: list.map((x) => x.name), n: list.length, prev: this.s.game });
      this.s.game = res.state || res;
      (res.events || []).forEach((e) => this.event(e));
    }

    schedule() {
      clearTimeout(this.timer);
      const g = this.s.game;
      if (!g) return;
      const later = (ms, fn) => { this.timer = setTimeout(() => { try { fn(); } catch (e) { console.error(e); } this.update(); }, ms); };
      const t = this.M.tick && this.M.tick(g);
      if (t) { later(t.ms, () => (t.run(g) || []).forEach((e) => this.event(e))); return; }
      const waiting = this.M.waiting(g) || [];
      for (const seat of waiting) {
        const p = this.gPlayer(seat);
        if (!p || !(p.isBot || p.botControl)) continue;
        const delay = this.M.botDelay ? this.M.botDelay(g, seat) : 900;
        later(delay + randInt(350), () => {
          if (!(this.M.waiting(g) || []).includes(seat)) return;
          let a, res;
          try { a = this.M.bot(g, seat); } catch (e) { console.error(e); }
          if (a) res = this.M.apply(g, seat, a);
          if (!a || res.error) {
            if (res && res.error) console.warn('robot', seat, a, res.error);
            const fb = this.M.fallback && this.M.fallback(g, seat);
            if (fb) res = this.M.apply(g, seat, fb);
          }
          ((res && res.events) || []).forEach((e) => this.event(e));
        });
        return;
      }
    }

    publicPlayers() {
      return this.s.players.map((p) => ({ pid: p.pid, name: p.name, seat: p.seat, gseat: p.gseat, isBot: p.isBot, isHost: p.isHost, connected: p.isBot || p.connected, botControl: p.botControl }));
    }
    viewFor(p, players, evs) {
      const g = this.s.game;
      return { t: 'state', code: this.s.code, me: p.pid, seat: p.seat, gseat: p.gseat, isHost: p.isHost, settings: this.s.settings, players, game: g ? this.M.view(g, p.gseat) : null, chat: this.s.chat.slice(-40), evs };
    }
    sendTo(token, msg) {
      if (token === this.s.hostToken) { this.onLocal(JSON.parse(JSON.stringify(msg))); return; }
      const c = this.conns.get(token);
      if (c && c.open) try { c.send(msg); } catch (e) { /* */ }
    }
    update() {
      const evs = this.pending; this.pending = [];
      store.set('salle-host-' + this.M.id + '-' + this.s.code, { at: Date.now(), s: this.s });
      const players = this.publicPlayers();
      for (const p of this.s.players) { if (!p.isBot) this.sendTo(p.token, this.viewFor(p, players, evs)); }
      this.schedule();
    }
    destroy() {
      clearTimeout(this.timer); clearInterval(this.watch);
      try { this.peer && this.peer.destroy(); } catch (e) { /* */ }
      store.del('salle-host-' + this.M.id + '-' + this.s.code);
    }
  }

  // ------------------------------------------------------------------
  class RoomClient {
    constructor({ gameId, code, name, token, tab, onMsg, onStatus, onRetoken }) {
      Object.assign(this, { gameId, code, name, token, tab, onMsg, onRetoken });
      this.onStatus = onStatus || (() => {});
      this.lastMsg = Date.now(); this.everConnected = false; this.closed = false;
      this.openPeer();
      this.hb = setInterval(() => this.heartbeat(), 4000);
    }
    openPeer() {
      if (this.closed) return;
      this.onStatus('connecting');
      try { this.peer && this.peer.destroy(); } catch (e) { /* */ }
      const peer = new Peer(undefined, peerOptions());
      this.peer = peer;
      peer.on('open', () => this.openConn());
      peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch (e) { /* */ } }, 1500); });
      peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') { this.onStatus(this.everConnected ? 'hostgone' : 'notfound'); this.retry(4000); }
        else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) { this.onStatus('reconnecting'); this.retry(3000, true); }
      });
    }
    openConn() {
      if (this.closed) return;
      try { this.conn && this.conn.close(); } catch (e) { /* */ }
      const conn = this.peer.connect(ID_PREFIX + this.gameId + '-' + this.code, { reliable: true, serialization: 'json' });
      this.conn = conn;
      const to = setTimeout(() => { if (!conn.open) this.retry(500); }, 12000);
      conn.on('open', () => {
        clearTimeout(to); this.everConnected = true; this.lastMsg = Date.now();
        conn.send({ t: 'hello', token: this.token, name: this.name, tab: this.tab });
        this.onStatus('online');
      });
      conn.on('data', (msg) => {
        this.lastMsg = Date.now();
        if (!msg || msg.t === 'pong') return;
        if (msg.t === 'retoken') { this.token = msg.token; if (this.onRetoken) this.onRetoken(msg.token); return; }
        this.onMsg(msg);
      });
      conn.on('close', () => { if (this.conn === conn) { this.onStatus('reconnecting'); this.retry(1500); } });
      conn.on('error', () => { if (this.conn === conn) { this.onStatus('reconnecting'); this.retry(2000); } });
    }
    retry(ms, newPeer) {
      clearTimeout(this.rt);
      this.rt = setTimeout(() => {
        if (this.closed) return;
        if (newPeer || !this.peer || this.peer.destroyed || this.peer.disconnected) this.openPeer(); else this.openConn();
      }, ms);
    }
    heartbeat() {
      if (this.conn && this.conn.open) {
        try { this.conn.send({ t: 'ping' }); } catch (e) { /* */ }
        if (Date.now() - this.lastMsg > 16000) { this.onStatus('reconnecting'); this.retry(100); this.lastMsg = Date.now(); }
      }
    }
    send(msg) { if (this.conn && this.conn.open) { try { this.conn.send(msg); return true; } catch (e) { /* */ } } return false; }
    destroy() { this.closed = true; clearInterval(this.hb); clearTimeout(this.rt); try { this.peer && this.peer.destroy(); } catch (e) { /* */ } }
  }

  root.SalleNet = { RoomHost, RoomClient, rid, randInt, shuffle, store, cleanName, newCode };
})(typeof window !== 'undefined' ? window : globalThis);
