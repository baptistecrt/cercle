/* Tarot — dessin des cartes (cartes de couleur : jeu classique ; cavaliers, atouts et excuse : dessinés ici) */
(function () {
  'use strict';
  const RED = { H: true, D: true };
  const SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const MAP = { 1: 'A', 10: 'T', 11: 'J', 13: 'Q', 14: 'K' };
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
  const HUES = [0, 205, 28, 350, 160, 42, 220, 12, 190, 270, 35, 200, 330, 150, 25, 240, 5, 180, 45, 215, 40];
  const cache = {};

  function frame(inner, extra) {
    return `<svg viewBox="0 0 224 312" xmlns="http://www.w3.org/2000/svg">${extra || ''}<rect x="1" y="1" width="222" height="310" rx="14" fill="#fbf7ec" stroke="#cfc6b0" stroke-width="2"/>${inner}</svg>`;
  }
  function trump(r) {
    const oud = r === 1 || r === 21;
    const h = HUES[r - 1];
    const fillA = oud ? '#e9c867' : `hsl(${h} 55% 78%)`;
    const fillB = oud ? '#b8892a' : `hsl(${h} 45% 52%)`;
    const ink = '#1f2a4d';
    let rays = '';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      rays += `<line x1="${112 + Math.cos(a) * 44}" y1="${158 + Math.sin(a) * 44}" x2="${112 + Math.cos(a) * (i % 2 ? 70 : 82)}" y2="${158 + Math.sin(a) * (i % 2 ? 70 : 82)}" stroke="${fillB}" stroke-width="${i % 2 ? 2 : 3.5}" stroke-linecap="round"/>`;
    }
    return frame(`
      <defs><radialGradient id="tg${r}" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="${fillA}"/><stop offset="1" stop-color="${fillB}"/></radialGradient></defs>
      <rect x="14" y="14" width="196" height="284" rx="8" fill="none" stroke="${ink}" stroke-width="2.5"/>
      <rect x="20" y="20" width="184" height="272" rx="6" fill="none" stroke="${ink}" stroke-opacity=".35" stroke-width="1"/>
      ${rays}
      <circle cx="112" cy="158" r="42" fill="url(#tg${r})" stroke="${ink}" stroke-width="3"/>
      <text x="112" y="172" text-anchor="middle" font-family="Young Serif, Georgia, serif" font-size="${r >= 10 ? 38 : 44}" fill="${ink}">${r}</text>
      <text x="112" y="266" text-anchor="middle" font-family="Young Serif, Georgia, serif" font-size="22" fill="${ink}" letter-spacing="2">${ROMAN[r]}</text>
      <rect x="22" y="22" width="${r >= 10 ? 54 : 40}" height="46" rx="6" fill="#fbf7ec"/>
      <text x="${r >= 10 ? 49 : 42}" y="60" text-anchor="middle" font-family="Young Serif, Georgia, serif" font-size="40" fill="${ink}">${r}</text>
      <g transform="rotate(180 112 156)"><rect x="22" y="22" width="${r >= 10 ? 54 : 40}" height="46" rx="6" fill="#fbf7ec"/><text x="${r >= 10 ? 49 : 42}" y="60" text-anchor="middle" font-family="Young Serif, Georgia, serif" font-size="40" fill="${ink}">${r}</text></g>
      ${oud ? '<circle cx="112" cy="158" r="50" fill="none" stroke="#b8892a" stroke-width="2" stroke-dasharray="3 4"/>' : ''}
    `);
  }
  function excuse() {
    const ink = '#7a1626';
    let rays = '';
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; rays += `<line x1="${112 + Math.cos(a) * 52}" y1="${150 + Math.sin(a) * 52}" x2="${112 + Math.cos(a) * 86}" y2="${150 + Math.sin(a) * 86}" stroke="#d9b45a" stroke-width="3" stroke-linecap="round"/>`; }
    return frame(`
      <rect x="14" y="14" width="196" height="284" rx="8" fill="none" stroke="${ink}" stroke-width="2.5"/>
      ${rays}
      <circle cx="112" cy="150" r="48" fill="#f6e2a8" stroke="${ink}" stroke-width="3"/>
      <path d="M112 116l10 22 24 3-18 16 5 24-21-12-21 12 5-24-18-16 24-3z" fill="${ink}"/>
      <text x="112" y="266" text-anchor="middle" font-family="Young Serif, Georgia, serif" font-size="24" fill="${ink}" letter-spacing="3">EXCUSE</text>
      <path d="M38 36l6 13 14 2-10 9 3 14-13-7-13 7 3-14-10-9 14-2z" fill="${ink}"/>
      <g transform="rotate(180 112 156)"><path d="M38 36l6 13 14 2-10 9 3 14-13-7-13 7 3-14-10-9 14-2z" fill="${ink}"/></g>
    `);
  }
  function cavalier(s) {
    const col = RED[s] ? '#c0212f' : '#1b1b1b';
    const sym = SYM[s];
    return frame(`
      <rect x="40" y="36" width="144" height="240" rx="6" fill="none" stroke="#1f2a4d" stroke-width="2"/>
      <rect x="44" y="40" width="136" height="232" rx="4" fill="${RED[s] ? '#fbe9e4' : '#e9edf5'}"/>
      <text x="112" y="196" text-anchor="middle" font-family="Segoe UI Symbol, DejaVu Sans, Noto Sans Symbols2, serif" font-size="120" fill="${col}">♞</text>
      <text x="112" y="250" text-anchor="middle" font-family="Georgia, serif" font-size="34" fill="${col}">${sym}</text>
      <text x="22" y="44" text-anchor="middle" font-family="Young Serif, Georgia, serif" font-size="30" fill="${col}">C</text>
      <text x="22" y="72" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="${col}">${sym}</text>
      <g transform="rotate(180 112 156)"><text x="22" y="44" text-anchor="middle" font-family="Young Serif, Georgia, serif" font-size="30" fill="${col}">C</text><text x="22" y="72" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="${col}">${sym}</text></g>
    `);
  }

  function cardInner(c) {
    if (cache[c]) return cache[c];
    let h;
    if (c === 'EX') h = excuse();
    else if (c[0] === 'T') h = trump(Number(c.slice(1)));
    else {
      const r = Number(c.slice(1));
      if (r === 12) h = cavalier(c[0]);
      else h = `<img src="../common/cards/${MAP[r] || r}${c[0]}.svg" alt="" draggable="false">`;
    }
    cache[c] = h;
    return h;
  }
  window.TarotCards = { cardInner };
})();
