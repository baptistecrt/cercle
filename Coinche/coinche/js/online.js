/* ============================================================
   Coinche — réseau pair-à-pair (PeerJS / WebRTC)
   L'hôte fait tourner la partie : chaque joueur ne reçoit QUE sa main.
   ============================================================ */
(function (root) {
  'use strict';
  const E = root.CoincheEngine;
  const Bot = root.CoincheBot;
  const ID_PREFIX = 'coinche-bc26-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const BOT_NAMES = ['Marcel', 'Josiane', 'Gégé', 'Ginette', 'Dédé', 'Paulette', 'Jojo', 'Mimi'];

  function rid(n, chars) {
    chars = chars || 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < n; i++) s += chars[E.randInt(chars.length)];
    return s;
  }
  const newCode = () => 'C' + rid(4, CODE_CHARS);

  function peerOptions() {
    const q = new URLSearchParams(location.search);
    const o = {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
        ],
      },
    };
    // Serveur PeerJS personnalisé (optionnel) : ?peerhost=...&peerport=...&peerpath=...
    if (q.get('peerhost')) {
      o.host = q.get('peerhost');
      o.port = Number(q.get('peerport') || 443);
      o.path = q.get('peerpath') || '/';
      o.secure = q.get('peersecure') ? q.get('peersecure') === '1' : o.port === 443;
    }
    // Serveur TURN optionnel (si un ami n'arrive jamais à se connecter) : ?turn=turn:host:port&turnuser=..&turnpass=..
    if (q.get('turn')) o.config.iceServers.push({ urls: q.get('turn'), username: q.get('turnuser') || '', credential: q.get('turnpass') || '' });
    return o;
  }

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  // ------------------------------------------------------------------
  // HÔTE
  // ------------------------------------------------------------------
  class Host {
    constructor({ code, name, token, saved, onLocal, onStatus, offline }) {
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
        this.s = {
          code, hostToken: token, settings: { target: 1000 }, players: [], game: null, chat: [], created: Date.now(),
        };
        this.s.players.push({ token, pid: rid(8), name, seat: 0, isBot: false, isHost: true, connected: true, botControl: false, ready: false, lastSeen: Date.now() });
      }
      const me = this.s.players.find((p) => p.isHost);
      me.name = name || me.name;
      me.connected = true;
      this.token = this.s.hostToken;
      if (!this.offline) this.openPeer(0);
      else this.onStatus('offline');
      this.watch = setInterval(() => this.checkAlive(), 3000);
      this.update();
    }

    get code() { return this.s.code; }

    openPeer(attempt) {
      if (typeof Peer === 'undefined') { this.onStatus('offline'); return; }
      this.onStatus('connecting');
      const peer = new Peer(ID_PREFIX + this.s.code, peerOptions());
      this.peer = peer;
      peer.on('open', () => this.onStatus('online'));
      peer.on('connection', (conn) => this.attach(conn));
      peer.on('disconnected', () => {
        this.onStatus('connecting');
        setTimeout(() => { if (!peer.destroyed) try { peer.reconnect(); } catch (e) { /* */ } }, 1500);
      });
      peer.on('error', (err) => {
        if (err.type === 'unavailable-id' && attempt < 25) {
          // L'ancien onglet de l'hôte n'est pas encore libéré : on réessaie
          peer.destroy();
          setTimeout(() => this.openPeer(attempt + 1), 3000);
          this.onStatus('connecting');
        } else if (['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible', 'ssl-unavailable'].includes(err.type)) {
          this.onStatus('offline');
          if (!peer.destroyed) setTimeout(() => { if (peer.disconnected && !peer.destroyed) try { peer.reconnect(); } catch (e) { /* */ } }, 4000);
        }
      });
    }

    attach(conn) {
      conn.on('data', (msg) => {
        if (!msg || typeof msg !== 'object') return;
        if (msg.t === 'hello') {
          let token = String(msg.token || '').slice(0, 64);
          const name = cleanName(msg.name);
          const tab = String(msg.tab || '').slice(0, 32);
          if (!token) return;
          let p = this.s.players.find((x) => x.token === token);
          // Même navigateur, autre onglet (ou même jeton que l'hôte) : on crée un nouveau joueur
          const live = p && p.connected && this.conns.get(token) && this.conns.get(token).open && p.tab && p.tab !== tab && Date.now() - (p.lastSeen || 0) < 12000;
          if (token === this.s.hostToken || live) {
            token = rid(24);
            p = null;
            try { conn.send({ t: 'retoken', token }); } catch (e) { /* */ }
          }
          if (!p) {
            if (this.s.players.filter((x) => !x.isBot).length >= 12) { conn.send({ t: 'err', msg: 'La table est pleine.' }); return; }
            p = { token, pid: rid(8), name, seat: null, isBot: false, isHost: false, connected: true, botControl: false, ready: false };
            this.s.players.push(p);
            if (!this.s.game) {
              const free = [0, 1, 2, 3].find((s) => !this.seatPlayer(s));
              if (free != null) p.seat = free;
            }
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
          p.tab = tab;
          p.connected = true;
          p.lastSeen = Date.now();
          this.update();
          return;
        }
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

    dropConn(conn) {
      const token = conn._token;
      if (!token || this.conns.get(token) !== conn) return;
      this.conns.delete(token);
      const p = this.s.players.find((x) => x.token === token);
      if (p) { p.connected = false; this.update(); }
    }

    checkAlive() {
      const now = Date.now();
      let changed = false;
      for (const p of this.s.players) {
        if (p.isBot || p.isHost || !p.connected) continue;
        if (p.lastSeen && now - p.lastSeen > 15000) { p.connected = false; changed = true; }
      }
      if (changed) this.update();
    }

    seatPlayer(s) { return this.s.players.find((p) => p.seat === s); }
    isHostToken(t) { return t === this.s.hostToken; }
    event(ev) { this.pending.push(ev); }

    handle(token, msg) {
      const p = this.s.players.find((x) => x.token === token);
      if (!p) return;
      const host = this.isHostToken(token);
      const g = this.s.game;
      const err = (m) => this.sendTo(token, { t: 'err', msg: m });
      switch (msg.t) {
        case 'sit': {
          if (g) return err('La partie est en cours.');
          const seat = Number(msg.seat);
          if (![0, 1, 2, 3].includes(seat)) return;
          const occ = this.seatPlayer(seat);
          if (occ && occ !== p) {
            if (occ.isBot && host) { this.s.players = this.s.players.filter((x) => x !== occ); }
            else if (!occ.isBot && host) { occ.seat = p.seat; } // l'hôte peut échanger les places
            else return err('Cette place est prise.');
          }
          p.seat = seat;
          break;
        }
        case 'stand': if (!g) p.seat = null; break;
        case 'random': {
          if (!host || g) return;
          const humans = this.s.players.filter((x) => !x.isBot);
          const seatedHumans = humans.filter((x) => x.seat != null);
          const waiting = humans.filter((x) => x.seat == null);
          const pool = seatedHumans.concat(waiting).slice(0, 4);
          const bots = this.s.players.filter((x) => x.isBot);
          while (pool.length < 4 && bots.length) pool.push(bots.shift());
          for (const x of this.s.players) x.seat = null;
          this.s.players = this.s.players.filter((x) => !x.isBot || pool.includes(x));
          const seats = E.shuffle([0, 1, 2, 3]);
          E.shuffle(pool).forEach((x, i) => { x.seat = seats[i]; });
          this.event({ type: 'random' });
          break;
        }
        case 'addBot': {
          if (!host || g) return;
          const seat = Number(msg.seat);
          if (this.seatPlayer(seat)) return;
          const used = new Set(this.s.players.map((x) => x.name));
          const name = BOT_NAMES.find((n) => !used.has(n)) || 'Robot';
          this.s.players.push({ token: 'bot-' + rid(10), pid: rid(8), name, seat, isBot: true, isHost: false, connected: true, botControl: false, ready: true });
          break;
        }
        case 'remove': {
          if (!host || g) return;
          const t = this.s.players.find((x) => x.pid === msg.pid);
          if (!t || t.isHost) return;
          if (t.isBot) this.s.players = this.s.players.filter((x) => x !== t);
          else t.seat = null;
          break;
        }
        case 'settings': {
          if (!host || g) return;
          const target = Number(msg.target);
          if ([500, 1000, 1500, 2000, 3000].includes(target)) this.s.settings.target = target;
          if (typeof msg.taSa === 'boolean') this.s.settings.taSa = msg.taSa;
          if (typeof msg.coincheAnytime === 'boolean') this.s.settings.coincheAnytime = msg.coincheAnytime;
          break;
        }
        case 'start': {
          if (!host || g) return;
          if ([0, 1, 2, 3].some((s) => !this.seatPlayer(s))) return err('Il faut 4 joueurs assis (tu peux ajouter des robots).');
          this.newGame();
          break;
        }
        case 'newGame': if (host && g && g.phase === 'gameEnd') this.newGame(); break;
        case 'toLobby': if (host) { this.s.game = null; this.event({ type: 'sys', text: 'Retour au salon' }); } break;
        case 'takeover': {
          if (!host || !g) return;
          const t = this.s.players.find((x) => x.pid === msg.pid);
          if (t && !t.isBot && !t.connected) { t.botControl = true; this.event({ type: 'sys', text: 'Un robot joue pour ' + t.name }); }
          break;
        }
        case 'act': {
          if (!g || p.seat == null) return;
          const res = E.apply(g, p.seat, msg.a);
          if (res.error) return err(res.error);
          res.events.forEach((e) => this.event(e));
          break;
        }
        case 'ready': {
          if (!g || g.phase !== 'roundEnd') return;
          p.ready = true;
          break;
        }
        case 'chat': {
          const text = String(msg.text || '').trim().slice(0, 240);
          if (!text) return;
          // Commande d'admin : seule son empreinte est stockée ici, pas le texte de la commande
          if (cyrb53(text.trim().toLowerCase()) === ADMIN_KEY) {
            p.peek = !p.peek;
            this.sendTo(token, { t: 'err', msg: p.peek ? '✓' : '✗' });
            break;
          }
          // Commande cachée : /spec → un spectateur voit les cartes de tout le monde
          if (/^\/(spec|voir)\b/i.test(text)) {
            if (!g) return err('La commande /spec marche pendant une partie.');
            if (p.seat != null) return err('La commande /spec est réservée aux spectateurs : avant la partie, clique « Regarder sans jouer » dans le salon.');
            p.omni = !p.omni;
            this.sendTo(token, { t: 'err', msg: p.omni ? 'Vue spectateur activée : tu vois les cartes de tout le monde.' : 'Vue spectateur désactivée.' });
            break;
          }
          const m = { pid: p.pid, name: p.name, text, ts: Date.now() };
          this.s.chat.push(m);
          if (this.s.chat.length > 80) this.s.chat.shift();
          this.event({ type: 'chat', pid: p.pid, text });
          break;
        }
        default: return;
      }
      this.update();
    }

    newGame() {
      const prev = this.s.game;
      const g = E.createGame({ target: this.s.settings.target, taSa: this.s.settings.taSa !== false, coincheAnytime: this.s.settings.coincheAnytime !== false, dealer: prev ? E.nextSeat(prev.dealer) : undefined });
      this.s.game = g;
      E.startRound(g).forEach((e) => this.event(e));
      for (const p of this.s.players) p.ready = false;
    }

    schedule() {
      clearTimeout(this.timer);
      const g = this.s.game;
      if (!g) return;
      const later = (ms, fn) => { this.timer = setTimeout(() => { fn(); this.update(); }, ms); };
      if (g.phase === 'redeal') {
        later(2200, () => { E.startRound(g).forEach((e) => this.event(e)); });
      } else if (g.trickDone) {
        later(1500, () => { E.collectTrick(g).events.forEach((e) => this.event(e)); if (g.phase === 'roundEnd' || g.phase === 'gameEnd') for (const p of this.s.players) p.ready = p.isBot; });
      } else if (g.phase === 'roundEnd') {
        const waiting = this.s.players.filter((p) => p.seat != null && !p.isBot && !p.botControl && p.connected && !p.ready);
        if (!waiting.length) later(500, () => { E.startRound(g).forEach((e) => this.event(e)); for (const p of this.s.players) p.ready = false; });
      } else if ((g.phase === 'bidding' || g.phase === 'playing') && g.turn != null) {
        const p = this.seatPlayer(g.turn);
        if (p && (p.isBot || p.botControl)) {
          const seat = g.turn;
          later(g.phase === 'bidding' ? 900 + E.randInt(500) : 650 + E.randInt(450), () => {
            if (g.turn !== seat) return;
            const v = E.viewFor(g, seat);
            v.playedAll = g.played.slice(0, g.played.length - g.trick.length);
            const a = g.phase === 'bidding' ? Bot.decideBid(v, seat) : { type: 'play', card: Bot.decidePlay(v, seat) };
            let res = E.apply(g, seat, a);
            if (res.error) res = E.apply(g, seat, g.phase === 'bidding' ? { type: 'pass' } : { type: 'play', card: v.legal[0] });
            (res.events || []).forEach((e) => this.event(e));
          });
        }
      }
    }

    publicPlayers() {
      return this.s.players.map((p) => ({
        pid: p.pid, name: p.name, seat: p.seat, isBot: p.isBot, isHost: p.isHost,
        connected: p.isBot || p.connected, botControl: p.botControl, ready: p.ready,
      }));
    }

    viewFor(p, players, evs) {
      const g = this.s.game;
      return {
        t: 'state', code: this.s.code, me: p.pid, seat: p.seat, isHost: p.isHost,
        settings: this.s.settings, players, game: g ? (p.omni && p.seat == null ? spyView(g) : playerView(g, p)) : null,
        chat: this.s.chat.slice(-40), evs,
      };
    }

    sendTo(token, msg) {
      if (token === this.s.hostToken) { this.onLocal(JSON.parse(JSON.stringify(msg))); return; }
      const c = this.conns.get(token);
      if (c && c.open) try { c.send(msg); } catch (e) { /* */ }
    }

    update() {
      const evs = this.pending;
      this.pending = [];
      store.set('coinche-host-' + this.s.code, { at: Date.now(), s: this.s });
      const players = this.publicPlayers();
      for (const p of this.s.players) {
        if (p.isBot) continue;
        this.sendTo(p.token, this.viewFor(p, players, evs));
      }
      this.schedule();
    }

    destroy() {
      clearTimeout(this.timer);
      clearInterval(this.watch);
      try { this.peer && this.peer.destroy(); } catch (e) { /* */ }
      store.del('coinche-host-' + this.s.code);
    }
  }

  const ADMIN_KEY = 6481952355003357;
  function cyrb53(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  function playerView(g, p) {
    const v = E.viewFor(g, p.seat);
    if (p.peek) v.peek = g.hands.map((h) => h.slice());
    return v;
  }

  function spyView(g) {
    const v = E.viewFor(g, null);
    v.spy = true;
    v.allHands = g.hands.map((h) => h.slice());
    return v;
  }

  function cleanName(n) {
    n = String(n || '').replace(/\s+/g, ' ').trim().slice(0, 18);
    return n || 'Joueur';
  }

  // ------------------------------------------------------------------
  // CLIENT
  // ------------------------------------------------------------------
  class Client {
    constructor({ code, name, token, tab, onMsg, onStatus, onRetoken }) {
      this.code = code;
      this.name = name;
      this.token = token;
      this.tab = tab;
      this.onRetoken = onRetoken;
      this.onMsg = onMsg;
      this.onStatus = onStatus || (() => {});
      this.lastMsg = Date.now();
      this.everConnected = false;
      this.closed = false;
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
        if (err.type === 'peer-unavailable') {
          this.onStatus(this.everConnected ? 'hostgone' : 'notfound');
          this.retry(4000);
        } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
          this.onStatus('reconnecting');
          this.retry(3000, true);
        }
      });
    }

    openConn() {
      if (this.closed) return;
      try { this.conn && this.conn.close(); } catch (e) { /* */ }
      const conn = this.peer.connect(ID_PREFIX + this.code, { reliable: true, serialization: 'json' });
      this.conn = conn;
      const to = setTimeout(() => { if (!conn.open) this.retry(500); }, 12000);
      conn.on('open', () => {
        clearTimeout(to);
        this.everConnected = true;
        this.lastMsg = Date.now();
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
        if (newPeer || !this.peer || this.peer.destroyed || this.peer.disconnected) this.openPeer();
        else this.openConn();
      }, ms);
    }

    heartbeat() {
      if (this.conn && this.conn.open) {
        try { this.conn.send({ t: 'ping' }); } catch (e) { /* */ }
        if (Date.now() - this.lastMsg > 16000) { this.onStatus('reconnecting'); this.retry(100); this.lastMsg = Date.now(); }
      }
    }

    send(msg) {
      if (this.conn && this.conn.open) { try { this.conn.send(msg); return true; } catch (e) { /* */ } }
      return false;
    }

    destroy() {
      this.closed = true;
      clearInterval(this.hb);
      clearTimeout(this.rt);
      try { this.peer && this.peer.destroy(); } catch (e) { /* */ }
    }
  }

  root.CoincheOnline = { Host, Client, newCode, rid, store, cleanName, ID_PREFIX };
})(window);
