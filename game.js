/* =========================================================================
   VOLCANO — an endless eruption runner
   -------------------------------------------------------------------------
   Plain browser JavaScript. No build step, no dependencies, no assets.
   Files: index.html · styles.css · game.js   (open index.html to play)

   Controls
     Space / ↑ / W / tap upper screen ....... jump (tap again = double jump)
     ↓ / S / hold lower screen ............. duck (in air: fast fall)
     P or Esc .............................. pause · M = mute
   ========================================================================= */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* tiny helpers                                                       */
  /* ------------------------------------------------------------------ */
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  /* ================================================================== */
  /* 1. MODERN CHARACTER RENDERER  (roundRect · shade · drawCharacter)  */
  /* ================================================================== */

  // Rounded-rect helper (works even if the browser lacks ctx.roundRect)
  function roundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function shade(hex, amt) {
    // lighten/darken a #rrggbb by amt (-1..1)
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r + (amt > 0 ? (255 - r) : r) * amt)));
    g = Math.max(0, Math.min(255, Math.round(g + (amt > 0 ? (255 - g) : g) * amt)));
    b = Math.max(0, Math.min(255, Math.round(b + (amt > 0 ? (255 - b) : b) * amt)));
    return `rgb(${r},${g},${b})`;
  }

  function drawCharacter(ctx, x, y, w, h, s) {
    s = s || {};
    const skin = s.skinColor || '#8d5524';
    const primary = s.primaryColor || '#4b7bec';
    const secondary = s.secondaryColor || '#2b2f4a';
    const hairColor = s.hairColor || '#17120f';
    const body = s.body || 'male';
    const hair = s.hair || 'short';
    const hat = s.hat || 'none';
    const accessory = s.accessory || 'none';

    const headR = w * 0.28;
    const headCX = x + w / 2;
    const headCY = y + headR + 4;

    ctx.save();

    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 4, w * 0.4, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // legs
    const legGrad = ctx.createLinearGradient(x, y + h * 0.55, x, y + h);
    legGrad.addColorStop(0, secondary);
    legGrad.addColorStop(1, shade(secondary, -0.25));
    ctx.fillStyle = legGrad;
    if (body === 'female') {
      roundRect(ctx, x + w * 0.22, y + h * 0.55, w * 0.56, h * 0.4, 10);
      ctx.fill();
    } else {
      roundRect(ctx, x + w * 0.2, y + h * 0.55, w * 0.25, h * 0.4, 8);
      ctx.fill();
      roundRect(ctx, x + w * 0.55, y + h * 0.55, w * 0.25, h * 0.4, 8);
      ctx.fill();
    }

    // arms
    const armGrad = ctx.createLinearGradient(x, y + h * 0.3, x, y + h * 0.6);
    armGrad.addColorStop(0, primary);
    armGrad.addColorStop(1, shade(primary, -0.2));
    ctx.fillStyle = armGrad;
    roundRect(ctx, x - w * 0.02, y + h * 0.32, w * 0.18, h * 0.28, 8);
    ctx.fill();
    roundRect(ctx, x + w * 0.84, y + h * 0.32, w * 0.18, h * 0.28, 8);
    ctx.fill();

    // torso
    const torsoGrad = ctx.createLinearGradient(x, y + h * 0.28, x, y + h * 0.6);
    torsoGrad.addColorStop(0, shade(primary, 0.1));
    torsoGrad.addColorStop(1, shade(primary, -0.1));
    ctx.fillStyle = torsoGrad;
    roundRect(ctx, x + w * 0.16, y + h * 0.28, w * 0.68, h * 0.32, 14);
    ctx.fill();

    // head with gradient for a soft 3D look
    const headGrad = ctx.createRadialGradient(
      headCX - headR * 0.3, headCY - headR * 0.3, headR * 0.1,
      headCX, headCY, headR
    );
    headGrad.addColorStop(0, shade(skin, 0.2));
    headGrad.addColorStop(1, shade(skin, -0.1));
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
    ctx.fill();

    // hair
    if (hair !== 'bald') {
      const hairGrad = ctx.createLinearGradient(headCX, headCY - headR, headCX, headCY + headR);
      hairGrad.addColorStop(0, shade(hairColor, 0.15));
      hairGrad.addColorStop(1, hairColor);
      ctx.fillStyle = hairGrad;
      if (hair === 'afro') {
        ctx.beginPath();
        ctx.arc(headCX, headCY - headR * 0.1, headR * 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.arc(headCX, headCY, headR, 0, Math.PI * 2);
        ctx.fill();
      } else if (hair === 'braids' || hair === 'dreads' || hair === 'ponytail') {
        ctx.beginPath();
        ctx.arc(headCX, headCY - headR * 0.2, headR * 1.05, Math.PI, Math.PI * 2);
        ctx.fill();
        roundRect(ctx, headCX - headR * 0.95, headCY, headR * 0.22, headR * 1.5, 6);
        ctx.fill();
        roundRect(ctx, headCX + headR * 0.73, headCY, headR * 0.22, headR * 1.5, 6);
        ctx.fill();
      } else if (hair === 'bun') {
        ctx.beginPath();
        ctx.arc(headCX, headCY - headR * 0.2, headR * 1.05, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(headCX, headCY - headR * 1.15, headR * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(headCX, headCY - headR * 0.2, headR * 1.05, Math.PI, Math.PI * 2);
        ctx.fill();
      }
    }

    // hat
    if (hat !== 'none') {
      const hatColor = hat === 'crown' ? '#f1c40f' : primary;
      ctx.fillStyle = hatColor;
      if (hat === 'cap') {
        ctx.beginPath();
        ctx.arc(headCX, headCY - headR * 0.35, headR * 1.05, Math.PI, Math.PI * 2);
        ctx.fill();
        roundRect(ctx, headCX, headCY - headR * 0.4, headR * 1.1, headR * 0.25, 6);
        ctx.fill();
      } else if (hat === 'beanie') {
        ctx.beginPath();
        ctx.arc(headCX, headCY - headR * 0.25, headR * 1.08, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shade(hatColor, -0.2);
        roundRect(ctx, headCX - headR * 1.08, headCY - headR * 0.15, headR * 2.16, headR * 0.2, 4);
        ctx.fill();
      } else if (hat === 'tophat') {
        roundRect(ctx, headCX - headR * 0.7, headCY - headR * 1.8, headR * 1.4, headR * 1.2, 4);
        ctx.fill();
        roundRect(ctx, headCX - headR * 0.9, headCY - headR * 0.7, headR * 1.8, headR * 0.25, 4);
        ctx.fill();
      } else if (hat === 'crown') {
        ctx.beginPath();
        ctx.moveTo(headCX - headR * 0.8, headCY - headR * 0.9);
        ctx.lineTo(headCX - headR * 0.4, headCY - headR * 1.5);
        ctx.lineTo(headCX, headCY - headR * 0.9);
        ctx.lineTo(headCX + headR * 0.4, headCY - headR * 1.5);
        ctx.lineTo(headCX + headR * 0.8, headCY - headR * 0.9);
        ctx.closePath();
        ctx.fill();
      }
    }

    // accessory
    if (accessory === 'glasses') {
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2.5;
      roundRect(ctx, headCX - headR * 0.6, headCY - headR * 0.1, headR * 0.5, headR * 0.4, 4);
      ctx.stroke();
      roundRect(ctx, headCX + headR * 0.1, headCY - headR * 0.1, headR * 0.5, headR * 0.4, 4);
      ctx.stroke();
    } else if (accessory === 'earrings') {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(headCX - headR * 0.9, headCY + headR * 0.3, 2.5, 0, Math.PI * 2);
      ctx.arc(headCX + headR * 0.9, headCY + headR * 0.3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (accessory === 'backpack') {
      ctx.fillStyle = shade(secondary, -0.1);
      roundRect(ctx, x + w * 0.3, y + h * 0.32, w * 0.4, h * 0.22, 8);
      ctx.fill();
    } else if (accessory === 'scarf') {
      ctx.fillStyle = '#e74c3c';
      roundRect(ctx, x + w * 0.2, y + h * 0.27, w * 0.6, h * 0.09, 6);
      ctx.fill();
    } else if (accessory === 'beard') {
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.arc(headCX, headCY + headR * 0.3, headR * 0.7, 0, Math.PI);
      ctx.fill();
    }

    ctx.restore();
  }

  /* ================================================================== */
  /* 2. DOM + CANVAS                                                    */
  /* ================================================================== */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const preview = document.getElementById('preview');
  const pctx = preview ? preview.getContext('2d') : null;

  const el = {
    score: document.getElementById('score'),
    bestHud: document.getElementById('bestHud'),
    lives: document.getElementById('lives'),
    pauseBtn: document.getElementById('pauseBtn'),
    muteBtn: document.getElementById('muteBtn'),
    hud: document.getElementById('hud'),
    menu: document.getElementById('menu'),
    menuBest: document.getElementById('menuBest'),
    playBtn: document.getElementById('playBtn'),
    randomBtn: document.getElementById('randomBtn'),
    customizer: document.getElementById('customizer'),
    pauseOverlay: document.getElementById('pauseOverlay'),
    resumeBtn: document.getElementById('resumeBtn'),
    restartBtn: document.getElementById('restartBtn'),
    quitBtn: document.getElementById('quitBtn'),
    overOverlay: document.getElementById('overOverlay'),
    finalScore: document.getElementById('finalScore'),
    finalBest: document.getElementById('finalBest'),
    newBest: document.getElementById('newBest'),
    againBtn: document.getElementById('againBtn'),
    menuBtn: document.getElementById('menuBtn'),
    // start.ng player + leaderboard
    playerChip: document.getElementById('playerChip'),
    playerFace: document.getElementById('playerFace'),
    playerName: document.getElementById('playerName'),
    playerAccount: document.getElementById('playerAccount'),
    playerSignIn: document.getElementById('playerSignIn'),
    playerNote: document.getElementById('playerNote'),
    useStartngLook: document.getElementById('useStartngLook'),
    boardWrap: document.getElementById('boardWrap'),
    board: document.getElementById('board'),
    boardRefresh: document.getElementById('boardRefresh'),
    finalBoardWrap: document.getElementById('finalBoardWrap'),
    finalBoard: document.getElementById('finalBoard'),
    scoreMsg: document.getElementById('scoreMsg'),
    signInBtn: document.getElementById('signInBtn'),
  };

  let W = 0, H = 0, DPR = 1, groundY = 0;
  const game = {
    scene: 'menu',      // menu | playing | paused | over
    t: 0,
    scroll: 0,
    speed: 330,
    distance: 0,
    score: 0,
    gemsCollected: 0,
    lives: 3,
    invuln: 0,
    shake: 0,
    flash: 0,
    spawnT: 1.1,
    gemT: 3.5,
    dustT: 0,
    best: 0,
  };

  const player = {
    x: 0, h: 80, w: 53, hgt: 0, vy: 0,
    onGround: true, jumps: 0, ducking: false,
  };

  const obstacles = [];   // rocks + fireballs
  const gems = [];        // collectibles
  const particles = [];   // embers, dust, sparks
  const stars = [];
  const speckles = [];    // ground texture

  /* ================================================================== */
  /* 3. CHARACTER LOOK + SAVE                                           */
  /* ================================================================== */
  const DEFAULT_LOOK = {
    skinColor: '#8d5524',
    primaryColor: '#4b7bec',
    secondaryColor: '#2b2f4a',
    hairColor: '#17120f',
    body: 'male',
    hair: 'short',
    hat: 'none',
    accessory: 'none',
  };
  const look = Object.assign({}, DEFAULT_LOOK);

  const SKINS = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac', '#5c3317'];
  const OUTFITS = ['#4b7bec', '#2ecc71', '#e67e22', '#9b59b6', '#e84393', '#16a085'];
  const PANTS = ['#2b2f4a', '#34495e', '#7f8c8d', '#5d4037', '#1e3799', '#8e44ad'];
  const HAIRCOLS = ['#17120f', '#4a2c17', '#8d5524', '#d4a017', '#bdc3c7', '#e84393'];

  const CUSTOM_GROUPS = [
    { key: 'body', label: 'Body', type: 'choice', options: [['male', 'Male'], ['female', 'Female']] },
    {
      key: 'hair', label: 'Hair', type: 'choice',
      options: [['short', 'Short'], ['afro', 'Afro'], ['braids', 'Braids'], ['dreads', 'Dreads'],
                ['ponytail', 'Ponytail'], ['bun', 'Bun'], ['bald', 'Bald']],
    },
    {
      key: 'hat', label: 'Hat', type: 'choice',
      options: [['none', 'None'], ['cap', 'Cap'], ['beanie', 'Beanie'], ['tophat', 'Top hat'], ['crown', 'Crown']],
    },
    {
      key: 'accessory', label: 'Extra', type: 'choice',
      options: [['none', 'None'], ['glasses', 'Glasses'], ['earrings', 'Earrings'],
                ['backpack', 'Backpack'], ['scarf', 'Scarf'], ['beard', 'Beard']],
    },
    { key: 'skinColor', label: 'Skin', type: 'swatch', options: SKINS },
    { key: 'primaryColor', label: 'Outfit', type: 'swatch', options: OUTFITS },
    { key: 'secondaryColor', label: 'Pants', type: 'swatch', options: PANTS },
    { key: 'hairColor', label: 'Hair colour', type: 'swatch', options: HAIRCOLS },
  ];

  const SAVE_KEY = 'volcano.save.v1';

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ look: look, best: game.best, muted: muted }));
    } catch (e) { /* private mode — no problem */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.look) Object.assign(look, data.look);
      if (typeof data.best === 'number') game.best = data.best;
      if (typeof data.muted === 'boolean') muted = data.muted;
    } catch (e) { /* ignore corrupt save */ }
  }

  /* ================================================================== */
  /* 4. AUDIO (tiny WebAudio blips — no files needed)                   */
  /* ================================================================== */
  let audio = null;
  let muted = false;

  function initAudio() {
    if (!audio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { try { audio = new AC(); } catch (e) { audio = null; } }
    }
    if (audio && audio.state === 'suspended') audio.resume();
  }

  function blip(f1, f2, dur, type, gain) {
    if (muted || !audio) return;
    const t0 = audio.currentTime;
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(f1, t0);
    if (f2 && f2 !== f1) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.05, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(audio.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  const sfx = {
    jump: () => blip(430, 760, 0.14, 'square', 0.045),
    double: () => blip(620, 1020, 0.14, 'square', 0.045),
    gem: () => { blip(900, 900, 0.08, 'triangle', 0.06); setTimeout(() => blip(1350, 1350, 0.12, 'triangle', 0.05), 70); },
    hit: () => blip(200, 60, 0.3, 'sawtooth', 0.08),
    over: () => { blip(330, 330, 0.16, 'sawtooth', 0.06); setTimeout(() => blip(240, 240, 0.18, 'sawtooth', 0.06), 150); setTimeout(() => blip(160, 80, 0.4, 'sawtooth', 0.06), 320); },
    start: () => { blip(520, 520, 0.1, 'triangle', 0.05); setTimeout(() => blip(780, 780, 0.16, 'triangle', 0.05), 110); },
  };

  /* ================================================================== */
  /* 5. LAYOUT                                                          */
  /* ================================================================== */
  let skyGrad = null, groundGrad = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(320, rect.width || window.innerWidth);
    H = Math.max(260, rect.height || window.innerHeight);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    groundY = Math.round(H * 0.78);
    player.h = clamp(H * 0.17, 54, 96);
    player.w = player.h * 0.66;
    player.x = clamp(W * 0.2, 66, 250);

    skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0.00, '#060a1a');
    skyGrad.addColorStop(0.34, '#1b1130');
    skyGrad.addColorStop(0.55, '#3a1832');
    skyGrad.addColorStop(0.70, '#6e2430');
    skyGrad.addColorStop(0.78, '#a13f2b');
    skyGrad.addColorStop(1.00, '#160b12');

    groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
    groundGrad.addColorStop(0, '#311d20');
    groundGrad.addColorStop(0.35, '#1c1216');
    groundGrad.addColorStop(1, '#0b0709');

    buildStars();
    buildSpeckles();
    sizePreview();
  }

  function buildStars() {
    stars.length = 0;
    const n = Math.round((W * H) / 26000);
    for (let i = 0; i < n; i++) {
      stars.push({ x: rand(0, W), y: rand(0, groundY * 0.62), r: rand(0.5, 1.6), p: rand(0, TAU), s: rand(0.6, 2.2) });
    }
  }

  function buildSpeckles() {
    speckles.length = 0;
    for (let i = 0; i < 110; i++) {
      speckles.push({ x: rand(0, W), y: rand(groundY + 10, H - 4), r: rand(1, 3.4), a: rand(0.05, 0.16) });
    }
  }

  function sizePreview() {
    if (!preview || !pctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = preview.clientWidth || 110;
    const chh = preview.clientHeight || 140;
    preview.width = Math.round(cw * dpr);
    preview.height = Math.round(chh * dpr);
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawPreview() {
    if (!pctx || !preview) return;
    const cw = preview.clientWidth || 110;
    const chh = preview.clientHeight || 140;
    pctx.clearRect(0, 0, cw, chh);

    const glow = pctx.createRadialGradient(cw / 2, chh * 0.86, 4, cw / 2, chh * 0.86, chh * 0.7);
    glow.addColorStop(0, 'rgba(255,130,60,0.35)');
    glow.addColorStop(1, 'rgba(255,130,60,0)');
    pctx.fillStyle = glow;
    pctx.fillRect(0, 0, cw, chh);

    const bob = Math.sin(game.t * 2.4) * 1.5;
    const ch = chh * 0.78;
    const w = ch * 0.66;
    drawCharacter(pctx, cw / 2 - w / 2, chh - ch - 16 + bob, w, ch, look);
  }

  /* ================================================================== */
  /* 6. CUSTOMIZER UI                                                   */
  /* ================================================================== */
  function buildCustomizer() {
    const host = el.customizer;
    if (!host) return;
    host.innerHTML = '';

    CUSTOM_GROUPS.forEach((group) => {
      const row = document.createElement('div');
      row.className = 'crow';

      const label = document.createElement('div');
      label.className = 'clabel';
      label.textContent = group.label;
      row.appendChild(label);

      const opts = document.createElement('div');
      opts.className = 'copts';

      group.options.forEach((opt) => {
        const isSwatch = group.type === 'swatch';
        const value = isSwatch ? opt : opt[0];
        const text = isSwatch ? '' : opt[1];

        const b = document.createElement('button');
        b.type = 'button';
        b.className = (isSwatch ? 'sw' : 'opt') + (look[group.key] === value ? ' on' : '');
        if (isSwatch) { b.style.background = value; b.title = value; b.setAttribute('aria-label', group.label + ' ' + value); }
        else b.textContent = text;
        b.setAttribute('aria-pressed', look[group.key] === value ? 'true' : 'false');

        b.addEventListener('click', () => {
          initAudio();
          lookTouched = true;      // the dressing room beats the start.ng look
          look[group.key] = value;
          save();
          refreshCustomizer();
        });
        opts.appendChild(b);
      });

      row.appendChild(opts);
      host.appendChild(row);
    });
  }

  function refreshCustomizer() {
    const host = el.customizer;
    if (!host) return;
    const rows = host.querySelectorAll('.crow');
    CUSTOM_GROUPS.forEach((group, i) => {
      const row = rows[i];
      if (!row) return;
      const buttons = row.querySelectorAll('button');
      group.options.forEach((opt, j) => {
        const value = group.type === 'swatch' ? opt : opt[0];
        const on = look[group.key] === value;
        buttons[j].classList.toggle('on', on);
        buttons[j].setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
  }

  function randomLook() {
    lookTouched = true;
    look.skinColor = pick(SKINS);
    look.primaryColor = pick(OUTFITS);
    look.secondaryColor = pick(PANTS);
    look.hairColor = pick(HAIRCOLS);
    look.body = pick(['male', 'female']);
    look.hair = pick(['short', 'afro', 'braids', 'dreads', 'ponytail', 'bun', 'bald']);
    look.hat = pick(['none', 'cap', 'beanie', 'tophat', 'crown']);
    look.accessory = pick(['none', 'glasses', 'earrings', 'backpack', 'scarf', 'beard']);
    save();
    refreshCustomizer();
  }

  /* ================================================================== */
  /* 7. SCREEN / STATE MANAGEMENT                                       */
  /* ================================================================== */
  function show(node) { if (node) node.classList.remove('hidden'); }
  function hide(node) { if (node) node.classList.add('hidden'); }

  function updateLives() {
    if (!el.lives) return;
    el.lives.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.className = 'heart' + (i < game.lives ? '' : ' lost');
      s.textContent = '♥';
      el.lives.appendChild(s);
    }
  }

  function updateBest() {
    if (el.bestHud) el.bestHud.textContent = Math.floor(game.best);
    if (el.menuBest) el.menuBest.textContent = Math.floor(game.best);
  }

  function setScore(v) {
    const s = Math.floor(v);
    if (el.score && el.score.textContent !== String(s)) el.score.textContent = s;
  }

  function startGame() {
    initAudio();
    sfx.start();
    game.scene = 'playing';
    game.speed = 330;
    game.distance = 0;
    game.score = 0;
    game.gemsCollected = 0;
    game.lives = 3;
    game.invuln = 0;
    game.shake = 0;
    game.flash = 0;
    game.spawnT = 1.15;
    game.gemT = 3.2;
    obstacles.length = 0;
    gems.length = 0;
    player.hgt = 0;
    player.vy = 0;
    player.onGround = true;
    player.jumps = 0;
    player.ducking = false;

    setScore(0);
    updateLives();
    hide(el.menu); hide(el.pauseOverlay); hide(el.overOverlay);
    hide(el.scoreMsg);
    show(el.hud);
    if (el.pauseBtn) el.pauseBtn.textContent = '❚❚';
  }

  function pauseGame() {
    if (game.scene !== 'playing') return;
    game.scene = 'paused';
    show(el.pauseOverlay);
    if (el.pauseBtn) el.pauseBtn.textContent = '▶';
  }

  function resumeGame() {
    if (game.scene !== 'paused') return;
    game.scene = 'playing';
    hide(el.pauseOverlay);
    if (el.pauseBtn) el.pauseBtn.textContent = '❚❚';
    initAudio();
  }

  function toMenu() {
    game.scene = 'menu';
    obstacles.length = 0;
    gems.length = 0;
    player.hgt = 0; player.vy = 0; player.onGround = true; player.ducking = false;
    hide(el.hud); hide(el.pauseOverlay); hide(el.overOverlay);
    show(el.menu);
    updateBest();
    sizePreview();
  }

  function gameOver() {
    game.scene = 'over';
    const finalScore = Math.floor(game.score);
    const isBest = finalScore > Math.floor(game.best);
    if (isBest) game.best = finalScore;
    save();
    updateBest();

    if (el.finalScore) el.finalScore.textContent = finalScore;
    if (el.finalBest) el.finalBest.textContent = Math.floor(game.best);
    if (el.newBest) el.newBest.classList.toggle('hidden', !isBest);
    show(el.overOverlay);
    sfx.over();
    reportRun();
  }

  /* ================================================================== */
  /* 7b. START.NG — the player, their character, and the leaderboard     */
  /* ================================================================== */
  let lookTouched = false;   // did the player use the dressing room this visit?
  let lastIdentity = '';     // so we only re-dress when the player changes

  function startNg() { return window.StartNG || null; }

  // Exactly the stats declared in startng.json: score, gems, metres.
  function runStats() {
    const cap = (n) => Math.max(0, Math.min(1000000000, Math.floor(n)));
    return {
      score: cap(game.score),
      gems: cap(game.gemsCollected),
      metres: cap(game.distance / 40),
    };
  }

  function formatNumber(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return Math.round(n).toLocaleString();
  }

  // The player's start.ng look is what the game draws (that's the start.ng
  // character rule). The dressing room is an optional local override, so it
  // only wins if the player actually used it.
  function applyStartNgLook(force) {
    const api = startNg();
    if (!api || !api.look) return false;
    if (lookTouched && !force) return false;
    Object.assign(look, api.look);
    lookTouched = false;
    save();
    refreshCustomizer();
    return true;
  }

  function onIdentityChange(api) {
    const who = api.player || api.guest;
    const key = (api.player ? 'user:' + api.player.id : who ? 'guest' : 'none') + JSON.stringify(api.look || {});
    const changed = key !== lastIdentity;
    lastIdentity = key;

    // profile chip: the character's face, name and @account (or a sign-in button)
    if (who) {
      if (el.playerFace) el.playerFace.src = who.face || '';
      if (el.playerName) el.playerName.textContent = who.name;
      if (el.playerAccount) {
        el.playerAccount.textContent = api.player
          ? (api.player.account ? '@' + api.player.account : '')
          : 'Not signed in';
      }
      show(el.playerChip);
      show(el.playerNote);
    }
    if (el.playerSignIn) el.playerSignIn.classList.toggle('hidden', api.signedIn);
    if (el.signInBtn) el.signInBtn.classList.toggle('hidden', api.signedIn);
    if (el.useStartngLook) el.useStartngLook.classList.toggle('hidden', !api.look);

    if (changed) applyStartNgLook(true);
    loadBoard(api, el.board, el.boardWrap);
  }

  function renderBoard(entries, listNode, wrapNode) {
    if (!listNode || !wrapNode) return;
    listNode.innerHTML = '';
    if (!entries || !entries.length) { hide(wrapNode); return; }

    const api = startNg();
    const meId = api && api.player ? api.player.id : null;

    entries.forEach(function (e) {
      const stats = e.stats || {};
      const li = document.createElement('li');
      li.className = 'brow' + (meId != null && e.player_id === meId ? ' me' : '');

      const dot = document.createElement('i');
      dot.className = 'bdot';
      dot.style.background = e.color || '#ff8b3d';

      const rank = document.createElement('span');
      rank.className = 'brank';
      rank.textContent = '#' + e.rank;

      const name = document.createElement('span');
      name.className = 'bname';
      name.textContent = e.name || 'Player';

      const val = document.createElement('b');
      val.className = 'bval';
      val.textContent = formatNumber(stats.score != null ? stats.score : e.score);

      const sub = document.createElement('span');
      sub.className = 'bsub';
      sub.textContent = [
        stats.gems != null ? stats.gems + ' gems' : '',
        stats.metres != null ? formatNumber(stats.metres) + ' m' : '',
      ].filter(Boolean).join(' · ');

      li.append(dot, rank, name, val, sub);
      listNode.appendChild(li);
    });
    show(wrapNode);
  }

  function loadBoard(api, listNode, wrapNode) {
    if (!api || !api.leaderboard) return;
    api.leaderboard(5).then(function (entries) {
      if (entries === null) return;   // no answer from start.ng: leave what's shown
      renderBoard(entries, listNode, wrapNode);
    }).catch(function () { /* offline is fine */ });
  }

  // At the end of a run: save it for signed-in players, then show the board.
  function reportRun() {
    const api = startNg();
    const stats = runStats();
    const signedIn = !!(api && api.signedIn);

    if (el.scoreMsg) {
      el.scoreMsg.classList.remove('hidden');
      el.scoreMsg.textContent = signedIn ? 'Saving your run…' : 'Sign in to put your run on the start.ng leaderboard.';
    }
    if (el.signInBtn) el.signInBtn.classList.toggle('hidden', signedIn);

    if (!api || !api.submitScore) {
      loadBoard(api, el.finalBoard, el.finalBoardWrap);
      return;
    }

    api.submitScore(stats).then(function (res) {
      if (el.scoreMsg) {
        el.scoreMsg.classList.remove('hidden');
        if (res.ok && res.improved) {
          el.scoreMsg.textContent = 'New best on start.ng — you are #' + res.rank + '!';
        } else if (res.ok) {
          el.scoreMsg.textContent = 'Saved. Your best run is ' + formatNumber(res.best) + ' (rank #' + res.rank + ').';
        } else {
          el.scoreMsg.textContent = res.error || 'That run was not saved.';
        }
      }
      if (res.ok && el.signInBtn) hide(el.signInBtn);
      loadBoard(api, el.finalBoard, el.finalBoardWrap);
    }).catch(function () {
      if (el.scoreMsg) {
        el.scoreMsg.textContent = 'Could not reach start.ng — your run is only saved on this device.';
      }
      loadBoard(api, el.finalBoard, el.finalBoardWrap);
    });
  }

  function initStartNg() {
    const api = startNg();
    if (!api) return;                       // no startng.js? the game still plays
    api.onChange = onIdentityChange;
    if (el.playerSignIn) el.playerSignIn.addEventListener('click', function () { api.signIn(); });
    if (el.signInBtn) el.signInBtn.addEventListener('click', function () { api.signIn(); });
    if (el.useStartngLook) {
      el.useStartngLook.addEventListener('click', function () {
        lookTouched = false;
        applyStartNgLook(true);
      });
    }
    if (el.boardRefresh) {
      el.boardRefresh.addEventListener('click', function () { loadBoard(api, el.board, el.boardWrap); });
    }
    api.init();
    loadBoard(api, el.board, el.boardWrap);
  }

  /* ================================================================== */
  /* 8. INPUT                                                           */
  /* ================================================================== */
  let keyDuck = false;
  const duckPointers = new Set();

  function isDucking() { return keyDuck || duckPointers.size > 0; }

  function jump() {
    if (game.scene !== 'playing') return;
    if (player.onGround) {
      player.vy = player.h * 12.2;
      player.onGround = false;
      player.jumps = 1;
      sfx.jump();
      burstDust(8);
    } else if (player.jumps < 2) {
      player.vy = player.h * 9.6;
      player.jumps = 2;
      sfx.double();
      for (let i = 0; i < 8; i++) addParticle(player.x, groundY - player.hgt - player.h * 0.3, 'spark', rand(-90, 90), rand(-30, 90));
    }
  }

  window.addEventListener('keydown', (e) => {
    const code = e.code;
    if (code === 'Space' || code === 'ArrowUp' || code === 'ArrowDown' || code === 'KeyW' || code === 'KeyS') e.preventDefault();
    if (e.repeat) return;
    initAudio();

    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
      if (game.scene === 'menu') startGame();
      else if (game.scene === 'playing') jump();
      return;
    }
    if (code === 'ArrowDown' || code === 'KeyS') {
      keyDuck = true;
      if (game.scene === 'playing' && !player.onGround && player.vy > 0) player.vy = -player.h * 3.5;
      return;
    }
    if (code === 'KeyP' || code === 'Escape') {
      if (game.scene === 'playing') pauseGame();
      else if (game.scene === 'paused') resumeGame();
      return;
    }
    if (code === 'KeyM') { toggleMute(); }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keyDuck = false;
  });

  canvas.addEventListener('pointerdown', (e) => {
    initAudio();
    if (game.scene !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const py = e.clientY - rect.top;
    if (py > rect.height * 0.68) {
      duckPointers.add(e.pointerId);
      if (!player.onGround && player.vy > 0) player.vy = -player.h * 3.5;
    } else {
      jump();
    }
  });

  function endDuckPointer(e) { duckPointers.delete(e.pointerId); }
  canvas.addEventListener('pointerup', endDuckPointer);
  canvas.addEventListener('pointercancel', endDuckPointer);
  canvas.addEventListener('pointerleave', endDuckPointer);

  function toggleMute() {
    muted = !muted;
    if (el.muteBtn) el.muteBtn.textContent = muted ? '🔇' : '🔊';
    save();
  }

  /* ================================================================== */
  /* 9. PARTICLES                                                       */
  /* ================================================================== */
  function addParticle(x, y, type, vx, vy, size, color, life) {
    if (particles.length > 420) particles.shift();
    particles.push({
      x, y, type,
      vx: vx || 0, vy: vy || 0,
      size: size || rand(1.5, 3.5),
      color: color || pick(['#ffd166', '#ffb347', '#ff6b5e']),
      life: life || rand(0.6, 1.5),
      max: life || rand(0.6, 1.5),
      p: rand(0, TAU),
    });
  }

  function burstDust(n) {
    for (let i = 0; i < n; i++) {
      addParticle(player.x + rand(-8, 8), groundY - rand(0, 6), 'dust',
        rand(-70, -10) - game.speed * 0.15, rand(-70, -10), rand(2, 5), 'rgba(214,168,132,0.55)', rand(0.25, 0.55));
    }
  }

  function burstSparks(x, y, n) {
    for (let i = 0; i < n; i++) {
      addParticle(x, y, 'spark', rand(-260, 260), rand(-280, 60), rand(1.5, 4), pick(['#ffe066', '#ff8b3d', '#ff5a3c']), rand(0.35, 0.9));
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'spark' || p.type === 'dust') p.vy += 620 * dt;
      if (p.type === 'ember') { p.vy -= 30 * dt; p.vx += Math.sin(game.t * 2 + p.p) * 8 * dt; p.x -= game.speed * 0.12 * dt; }
    }
  }

  function drawParticles() {
    ctx.save();
    for (const p of particles) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.type === 'dust') {
        ctx.fillStyle = 'rgba(214,168,132,' + (a * 0.5).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.6 - a * 0.6), 0, TAU);
        ctx.fill();
      } else if (p.type === 'ember') {
        ctx.globalAlpha = a * 0.9;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  /* ================================================================== */
  /* 10. SPAWNING                                                       */
  /* ================================================================== */
  function spawnRock(offsetX, wk, hk) {
    obstacles.push({ type: 'rock', x: W + 60 + (offsetX || 0), wk, hk, phase: rand(0, TAU) });
  }

  function spawnEmber() {
    obstacles.push({ type: 'ember', x: W + 70, rk: 0.17, yk: rand(0.82, 0.95), phase: rand(0, TAU), spin: rand(-2, 2) });
  }

  function spawnGem(yk) {
    gems.push({ x: W + 60, yk: yk || rand(0.75, 2.0), phase: rand(0, TAU), got: false });
  }

  function spawnWave() {
    const r = Math.random();
    const late = game.distance > 900;
    if (late && r < 0.30) {
      spawnEmber();
      if (Math.random() < 0.35) spawnGem(rand(1.0, 1.9));
    } else if (late && r < 0.44) {
      spawnRock(0, rand(1.2, 1.7), rand(0.42, 0.7));   // wide rock — needs a clean jump
    } else if (r < 0.72) {
      spawnRock(0, rand(0.5, 1.0), rand(0.34, 0.75));
    } else {
      spawnRock(0, rand(0.5, 0.9), rand(0.3, 0.6));
      if (game.distance > 600 && Math.random() < 0.4) spawnRock(-player.h * rand(2.0, 2.6), rand(0.5, 0.9), rand(0.3, 0.6));
    }
    if (Math.random() < 0.3) spawnGem(rand(0.8, 2.1));
  }

  function nextSpawnDelay() {
    const ch = player.h;
    const diff = clamp((game.speed - 330) / 430, 0, 1);
    const gapPx = ch * (2.5 + rand(-0.2, 0.7)) * (1 - 0.24 * diff);
    return Math.max(gapPx / game.speed, 0.48);
  }

  /* ================================================================== */
  /* 11. COLLISION                                                      */
  /* ================================================================== */
  function playerBox() {
    const ducking = player.ducking && player.onGround;
    const hEff = ducking ? player.h * 0.66 : player.h;
    const wEff = ducking ? player.h * 0.74 : player.w;
    const bottom = groundY - player.hgt;
    return {
      x: player.x - wEff * 0.34,
      y: bottom - hEff * 0.94,
      w: wEff * 0.68,
      h: hEff * 0.86,
    };
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function obstacleBox(o) {
    if (o.type === 'rock') {
      const w = o.wk * player.h, h = o.hk * player.h;
      return { x: o.x + 3, y: groundY - h + 3, w: w - 6, h: h - 6 };
    }
    // ember (fireball)
    const r = o.rk * player.h;
    const cy = groundY - player.h * o.yk + Math.sin(game.t * 3 + o.phase) * player.h * 0.05;
    const cx = o.x + Math.sin(game.t * 2 + o.phase) * player.h * 0.04;
    return { x: cx - r * 0.78, y: cy - r * 0.78, w: r * 1.56, h: r * 1.56, cx, cy, r };
  }

  function damage() {
    if (game.invuln > 0 || game.scene !== 'playing') return;
    game.lives -= 1;
    game.invuln = 1.6;
    game.shake = 0.42;
    game.flash = 0.18;
    updateLives();
    sfx.hit();
    burstSparks(player.x, groundY - player.hgt - player.h * 0.5, 18);
    if (game.lives <= 0) gameOver();
  }

  /* ================================================================== */
  /* 12. UPDATE                                                         */
  /* ================================================================== */
  function updateAmbient(dt) {
    game.scroll += 70 * dt;
    game.t += 0;
    if (Math.random() < dt * 6) {
      addParticle(volcano.apexX + rand(-14, 14), volcano.apexY + rand(-6, 6), 'ember',
        rand(-24, 24), rand(-150, -60), rand(1.4, 3.2), pick(['#ffd166', '#ffb347', '#ff6b5e']), rand(1.0, 2.2));
    }
    if (Math.random() < dt * 0.16) {
      for (let i = 0; i < 22; i++) {
        addParticle(volcano.apexX + rand(-16, 16), volcano.apexY + rand(-8, 4), 'ember',
          rand(-90, 90), rand(-420, -220), rand(2, 4.4), pick(['#ffe066', '#ff8b3d', '#ff5a3c']), rand(1.0, 2.0));
      }
      game.flash = Math.max(game.flash, 0.1);
    }
    updateParticles(dt);
  }

  function update(dt) {
    // difficulty ramp
    game.speed = Math.min(760, game.speed + 8.5 * dt);
    game.distance += game.speed * dt;
    game.score += game.speed * dt * 0.06;
    game.scroll += game.speed * dt;
    setScore(game.score);

    if (game.invuln > 0) game.invuln -= dt;
    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 1.6);
    if (game.flash > 0) game.flash = Math.max(0, game.flash - dt * 1.1);

    player.ducking = isDucking() && player.onGround;

    // vertical physics
    if (!player.onGround) {
      player.vy -= player.h * 30 * dt;
      player.hgt += player.vy * dt;
      if (player.hgt <= 0) {
        player.hgt = 0;
        player.vy = 0;
        player.onGround = true;
        player.jumps = 0;
        burstDust(10);
      }
    }

    // running dust
    if (player.onGround) {
      game.dustT -= dt;
      if (game.dustT <= 0) { game.dustT = 0.09; burstDust(2); }
    }

    // move obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= game.speed * dt;
      if (o.type === 'ember' && Math.random() < dt * 14) {
        const b = obstacleBox(o);
        addParticle(b.cx - b.r, b.cy + rand(-4, 4), 'ember', rand(-60, -20), rand(-40, 20), rand(1.2, 2.6), '#ff8b3d', rand(0.3, 0.7));
      }
      if (o.x < -player.h * 3 - 120) obstacles.splice(i, 1);
    }

    // move gems
    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i];
      g.x -= game.speed * dt;
      if (g.x < -80) gems.splice(i, 1);
    }

    // spawn
    game.spawnT -= dt;
    if (game.spawnT <= 0) { spawnWave(); game.spawnT = nextSpawnDelay(); }

    game.gemT -= dt;
    if (game.gemT <= 0) {
      game.gemT = rand(4.5, 8.5);
      const n = 2 + ((Math.random() * 2) | 0);
      for (let i = 0; i < n; i++) spawnGem(0.75 + i * 0.42 + rand(-0.08, 0.08));
    }

    // collisions
    const pb = playerBox();
    for (const o of obstacles) {
      const ob = obstacleBox(o);
      if (overlap(pb, ob)) { damage(); break; }
    }

    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i];
      const gy = groundY - player.h * g.yk + Math.sin(game.t * 3 + g.phase) * 6;
      const gr = player.h * 0.15;
      const cx = clamp(g.x, pb.x, pb.x + pb.w);
      const cy = clamp(gy, pb.y, pb.y + pb.h);
      const dx = g.x - cx, dy = gy - cy;
      if (dx * dx + dy * dy < gr * gr) {
        gems.splice(i, 1);
        game.score += 25;
        game.gemsCollected += 1;
        burstSparks(g.x, gy, 8);
        sfx.gem();
      }
    }

    updateParticles(dt);
  }

  /* ================================================================== */
  /* 13. DRAW — world                                                   */
  /* ================================================================== */
  const volcano = { apexX: 0, apexY: 0, halfBase: 0, craterHalf: 0 };

  function layoutVolcano() {
    volcano.apexX = W * 0.66;
    volcano.apexY = H * 0.13;
    volcano.halfBase = W * 0.44;
    volcano.craterHalf = Math.max(16, W * 0.05);
  }

  function drawSky() {
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(game.t * s.s + s.p));
      ctx.globalAlpha = tw * 0.9;
      ctx.fillStyle = '#fff4e0';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawRidge(par, amp, step, fill) {
    const baseY = groundY + 3;
    const off = (game.scroll * par) % step;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(-step, baseY);
    let i = Math.floor((-step + off) / step);
    for (let x = -step - off; x <= W + step; x += step, i++) {
      const a = amp * (0.62 + 0.38 * Math.abs(Math.sin(i * 12.9898)));
      ctx.lineTo(x + step * 0.5, baseY - a);
      ctx.lineTo(x + step, baseY);
    }
    ctx.lineTo(W + step, baseY + 40);
    ctx.lineTo(-step, baseY + 40);
    ctx.closePath();
    ctx.fill();
  }

  function drawVolcano() {
    const bx = volcano.apexX, by = volcano.apexY;
    const hb = volcano.halfBase, ch = volcano.craterHalf;
    const baseY = groundY + 4;
    const drop = baseY - by;

    ctx.save();

    // mountain body
    ctx.beginPath();
    ctx.moveTo(bx - hb, baseY);
    ctx.quadraticCurveTo(bx - hb * 0.34, by + drop * 0.3, bx - ch, by);
    ctx.lineTo(bx + ch, by);
    ctx.quadraticCurveTo(bx + hb * 0.34, by + drop * 0.3, bx + hb, baseY);
    ctx.closePath();
    const body = ctx.createLinearGradient(bx, by, bx, baseY);
    body.addColorStop(0, '#332431');
    body.addColorStop(0.55, '#1d1520');
    body.addColorStop(1, '#0d0910');
    ctx.fillStyle = body;
    ctx.fill();

    // lava river down the slope
    ctx.beginPath();
    ctx.moveTo(bx - ch * 0.55, by + 2);
    ctx.lineTo(bx + ch * 0.55, by + 2);
    ctx.lineTo(bx + ch * 1.7 + Math.sin(game.t * 1.7) * 5, by + drop * 0.86);
    ctx.lineTo(bx + ch * 0.8 + Math.sin(game.t * 1.7) * 3, by + drop * 0.93);
    ctx.closePath();
    const lava = ctx.createLinearGradient(bx, by, bx, by + drop);
    lava.addColorStop(0, '#ffe066');
    lava.addColorStop(0.35, '#ff8b3d');
    lava.addColorStop(1, '#c0392b');
    ctx.fillStyle = lava;
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;

    // crater glow
    const pulse = 0.42 + 0.16 * Math.sin(game.t * 6.5);
    const glow = ctx.createRadialGradient(bx, by, 2, bx, by, W * 0.16);
    glow.addColorStop(0, 'rgba(255,196,96,' + pulse.toFixed(3) + ')');
    glow.addColorStop(0.4, 'rgba(255,110,60,' + (pulse * 0.45).toFixed(3) + ')');
    glow.addColorStop(1, 'rgba(255,110,60,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(bx, by, W * 0.16, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  function drawGround() {
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, W, H - groundY);

    // glowing lava seam at the horizon
    const pulse = 0.55 + 0.25 * Math.sin(game.t * 4);
    ctx.fillStyle = 'rgba(255,120,60,' + pulse.toFixed(3) + ')';
    ctx.fillRect(0, groundY - 1, W, 3);
    ctx.fillStyle = 'rgba(255,220,150,' + (pulse * 0.7).toFixed(3) + ')';
    ctx.fillRect(0, groundY, W, 1);

    // rocky speckles
    const off = game.scroll % (W + 200);
    for (const s of speckles) {
      let x = s.x - off;
      if (x < -20) x += W + 200;
      if (x > W + 20) continue;
      ctx.fillStyle = 'rgba(255,205,160,' + s.a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
  }

  function drawObstacles() {
    // obstacles — rounded, with gradient
    for (const o of obstacles) {
      if (o.type === 'ember') {
        const b = obstacleBox(o);
        const g = ctx.createRadialGradient(b.cx, b.cy, 1, b.cx, b.cy, b.r * 2.1);
        g.addColorStop(0, 'rgba(255,248,200,0.95)');
        g.addColorStop(0.35, '#ffb347');
        g.addColorStop(0.7, '#ff6b5e');
        g.addColorStop(1, 'rgba(192,57,43,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.cx, b.cy, b.r * 2.1, 0, TAU);
        ctx.fill();

        ctx.fillStyle = 'rgba(90,25,10,0.55)';
        ctx.beginPath();
        ctx.arc(b.cx, b.cy, b.r * 0.45, 0, TAU);
        ctx.fill();
        continue;
      }

      const w = o.wk * player.h;
      const h = o.hk * player.h;
      const x = o.x, y = groundY - h;
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, '#ff6b5e');
      grad.addColorStop(1, '#c0392b');
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, w, h, 8);
      ctx.fill();

      // darker top edge so the rock reads against the lava glow
      ctx.fillStyle = 'rgba(60,10,10,0.25)';
      roundRect(ctx, x + w * 0.14, y + h * 0.12, w * 0.72, h * 0.22, 6);
      ctx.fill();
    }
  }

  function drawGems() {
    for (const g of gems) {
      const gy = groundY - player.h * g.yk + Math.sin(game.t * 3 + g.phase) * 6;
      const r = player.h * 0.15;
      const wob = 0.75 + 0.25 * Math.abs(Math.sin(game.t * 2 + g.phase));

      ctx.save();
      ctx.translate(g.x, gy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#2ee6d6';
      ctx.shadowColor = 'rgba(46,230,214,0.8)';
      ctx.shadowBlur = 14;
      roundRect(ctx, -r * 0.62, -r * 0.62, r * 1.24, r * 1.24, 3);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = 'rgba(255,255,255,' + (0.5 * wob).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(g.x - r * 0.22, gy - r * 0.22, r * 0.22, 0, TAU);
      ctx.fill();
    }
  }

  /* ================================================================== */
  /* 14. DRAW — character                                               */
  /* ================================================================== */
  function drawPlayerCharacter() {
    const ch = player.h;
    const ducking = player.ducking && player.onGround;
    const ph = ducking ? ch * 0.66 : ch;
    const pw = ducking ? ch * 0.74 : ch * 0.66;

    const running = player.onGround && !ducking && game.scene === 'playing';
    const bob = running ? Math.sin(game.t * 18) * 1.4 : 0;

    const bottom = groundY - player.hgt - bob * 0.5;
    const px = player.x - pw / 2;
    const py = bottom - ph;

    // contact shadow on the ground (the character's own shadow floats with it)
    if (player.hgt > 2) {
      const shrink = clamp(1 - player.hgt / (ch * 2.8), 0.4, 1);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.3 * shrink).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(player.x, groundY + 3, ch * 0.42 * shrink, ch * 0.07 * shrink, 0, 0, TAU);
      ctx.fill();
    }

    if (game.invuln > 0 && Math.floor(game.t * 14) % 2 === 0) return; // damage blink

    ctx.save();
    if (player.hgt > 2) {
      // clip away the built-in shadow so it doesn't float in the air
      ctx.beginPath();
      ctx.rect(px - ch, py - ch * 0.7, pw + ch * 2, ph + ch * 0.7 - 2);
      ctx.clip();
    }
    drawCharacter(ctx, px, py, pw, ph, look);
    ctx.restore();
  }

  function drawMenuCharacter() {
    const ch = clamp(H * 0.2, 60, 110);
    const w = ch * 0.66;
    const bob = Math.sin(game.t * 1.8) * 2;
    drawCharacter(ctx, W * 0.5 - w / 2, groundY - ch + bob, w, ch, look);
  }

  /* ================================================================== */
  /* 15. DRAW — frame                                                   */
  /* ================================================================== */
  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const shake = game.shake;
    if (shake > 0) {
      ctx.translate(rand(-1, 1) * 10 * shake, rand(-1, 1) * 10 * shake);
    }

    drawSky();
    drawRidge(0.08, H * 0.17, Math.max(90, W * 0.26), '#150f1c');
    layoutVolcano();
    drawVolcano();
    drawRidge(0.22, H * 0.09, Math.max(70, W * 0.18), '#0e0a13');
    drawGround();

    drawGems();
    drawObstacles();
    drawParticles();

    if (game.scene === 'menu') drawMenuCharacter();
    else drawPlayerCharacter();

    if (game.flash > 0) {
      ctx.fillStyle = 'rgba(255,140,70,' + (game.flash * 0.45).toFixed(3) + ')';
      ctx.fillRect(-40, -40, W + 80, H + 80);
    }
  }

  /* ================================================================== */
  /* 16. MAIN LOOP                                                      */
  /* ================================================================== */
  let last = 0;

  function frame(now) {
    if (!last) last = now;
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.05);

    game.t += dt;

    if (game.scene === 'playing') update(dt);
    else {
      updateAmbient(dt);
      if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 1.6);
      if (game.flash > 0) game.flash = Math.max(0, game.flash - dt * 1.1);
    }

    draw();
    if (game.scene === 'menu') drawPreview();

    requestAnimationFrame(frame);
  }

  /* ================================================================== */
  /* 17. BOOT                                                           */
  /* ================================================================== */
  load();
  if (el.muteBtn) el.muteBtn.textContent = muted ? '🔇' : '🔊';
  buildCustomizer();
  resize();
  updateBest();
  updateLives();
  initStartNg();
  if (el.muteBtn) el.muteBtn.addEventListener('click', () => { initAudio(); toggleMute(); });
  if (el.pauseBtn) {
    el.pauseBtn.addEventListener('click', () => {
      initAudio();
      if (game.scene === 'playing') pauseGame();
      else if (game.scene === 'paused') resumeGame();
    });
  }
  if (el.playBtn) el.playBtn.addEventListener('click', startGame);
  if (el.againBtn) el.againBtn.addEventListener('click', startGame);
  if (el.randomBtn) el.randomBtn.addEventListener('click', () => { initAudio(); randomLook(); });
  if (el.menuBtn) el.menuBtn.addEventListener('click', () => { initAudio(); toMenu(); });
  if (el.resumeBtn) el.resumeBtn.addEventListener('click', () => { initAudio(); resumeGame(); });
  if (el.restartBtn) el.restartBtn.addEventListener('click', startGame);
  if (el.quitBtn) el.quitBtn.addEventListener('click', toMenu);

  window.addEventListener('resize', () => { resize(); });
  window.addEventListener('orientationchange', () => { setTimeout(resize, 250); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.scene === 'playing') pauseGame();
  });
  window.addEventListener('blur', () => { if (game.scene === 'playing') pauseGame(); });

  requestAnimationFrame(frame);
})();
