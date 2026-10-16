/* =========================================================================
   startng.js — talks to start.ng for the game Volcano
   -------------------------------------------------------------------------
   start.ng is the backend: it says who is playing (and what their character
   looks like), keeps the leaderboard, and hosts the game.

   This file uses the connect page (a hidden https://start.ng/connect iframe
   that answers postMessage). Every reply is checked for its origin, so only
   start.ng can answer. If start.ng never answers (opened as a local file, or
   offline) every call resolves to null and the game carries on with its own
   local look — the game must always be playable without a player.
   ========================================================================= */
(function () {
  'use strict';

  const START_NG = 'https://start.ng';
  const API = 'https://api.start.ng';

  // Our game's name / address. On volcano.start.ng this is "volcano".
  const hostLabel = (location.hostname || '').split('.')[0];
  const GAME = /^[a-z][a-z0-9-]*$/i.test(hostLabel) && hostLabel !== 'localhost' && hostLabel !== '127'
    ? hostLabel.toLowerCase()
    : 'volcano';

  /* ----------------------------------------------------------- style ---- */
  const HAIRS = ['short', 'afro', 'braids', 'bun', 'ponytail', 'dreads', 'bald'];
  const HATS = ['none', 'cap', 'beanie', 'tophat', 'crown'];
  const ACCESSORIES = ['none', 'glasses', 'earrings', 'beard', 'scarf', 'backpack'];
  const BODIES = ['female', 'male'];

  const FALLBACK_STYLE = {
    body: 'male',
    primaryColor: '#4b7bec',
    secondaryColor: '#2b2f4a',
    skinColor: '#8d5524',
    hairColor: '#17120f',
    hair: 'short',
    hat: 'none',
    accessory: 'none',
  };

  // "#abc" -> "#aabbcc"; anything unusable -> null
  function hex(value) {
    if (typeof value !== 'string') return null;
    const v = value.trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(v)) return v;
    if (/^#[0-9a-f]{3}$/.test(v)) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    return null;
  }

  const oneOf = (list, value, fallback) => (list.indexOf(value) !== -1 ? value : fallback);

  // start.ng may add options later, so anything unknown falls back.
  function normalizeStyle(style) {
    const out = Object.assign({}, FALLBACK_STYLE);
    if (!style || typeof style !== 'object') return out;
    out.body = oneOf(BODIES, style.body, out.body);
    out.hair = oneOf(HAIRS, style.hair, out.hair);
    out.hat = oneOf(HATS, style.hat, out.hat);
    out.accessory = oneOf(ACCESSORIES, style.accessory, out.accessory);
    ['skinColor', 'primaryColor', 'secondaryColor', 'hairColor'].forEach(function (key) {
      const h = hex(style[key]);
      if (h) out[key] = h;
    });
    return out;
  }

  /* -------------------------------------------------------- connect ----- */
  let framePromise = null;

  function connectFrame() {
    if (!framePromise) {
      framePromise = new Promise(function (resolve, reject) {
        const el = document.createElement('iframe');
        el.src = START_NG + '/connect';
        el.hidden = true;
        el.title = 'start.ng';
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
        const timer = setTimeout(function () { reject(new Error('start.ng connect page did not load')); }, 8000);
        el.onload = function () { clearTimeout(timer); resolve(el); };
        el.onerror = function () { clearTimeout(timer); reject(new Error('start.ng connect page failed')); };
        (document.body || document.documentElement).appendChild(el);
      });
      // let a later call try again if this attempt failed
      framePromise.catch(function () { framePromise = null; });
    }
    return framePromise;
  }

  // Sends a message and resolves to start.ng's reply, or null if it didn't answer.
  async function askStartNg(message, replyType, timeoutMs) {
    let el;
    try {
      el = await connectFrame();
    } catch (e) {
      return null;
    }
    return new Promise(function (resolve) {
      const requestId = Math.random().toString(36).slice(2);
      let settled = false;
      const done = function (reply) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(reply);
      };
      const timer = setTimeout(function () {
        done(null);
      }, timeoutMs || 6000);
      function onMessage(e) {
        if (e.origin !== START_NG || e.source !== el.contentWindow) return;
        if (e.data && e.data.type === replyType && e.data.requestId === requestId) done(e.data);
      }
      window.addEventListener('message', onMessage);
      try {
        el.contentWindow.postMessage(Object.assign({ requestId: requestId }, message), START_NG);
      } catch (err) {
        done(null);
      }
    });
  }

  /* ----------------------------------------------------------- state ---- */
  const StartNG = {
    GAME: GAME,
    API: API,

    ready: false,        // true once start.ng has answered (or timed out)
    online: false,       // true when start.ng actually answered
    signedIn: false,
    player: null,        // { id, name, account, style, face } — signed-in players only
    guest: null,         // { name, style, face } — start.ng's guest look
    look: null,          // the style the game should draw right now (player, else guest)
    onChange: null,      // the game sets this to hear about identity changes
  };

  function identityKey() {
    const p = StartNG.player;
    const src = p || StartNG.guest;
    if (!src) return 'none';
    return (p ? 'user:' + p.id + ':' + p.name : 'guest') + ':' + JSON.stringify(src.style);
  }

  function emit() {
    if (typeof StartNG.onChange === 'function') {
      try { StartNG.onChange(StartNG); } catch (e) { /* never break the game */ }
    }
  }

  function readPlayer(raw, isUser) {
    if (!raw) return null;
    return {
      id: isUser ? raw.id : null,
      name: raw.name || (isUser ? 'Player' : 'Guest'),
      account: isUser ? (raw.account || '') : '',
      style: normalizeStyle(raw.style),
      face: raw.face || '',
    };
  }

  // Asks start.ng who is playing. Safe to call often: it is throttled, and a
  // timed-out answer just leaves the game on its current look.
  let inFlight = null;
  let lastAsk = 0;

  function refresh(force) {
    const now = Date.now();
    if (inFlight) return inFlight;
    if (!force && now - lastAsk < 4000) return Promise.resolve(StartNG.ready);
    lastAsk = now;

    inFlight = askStartNg({ type: 'startng:whoami' }, 'startng:user')
      .then(function (reply) {
        inFlight = null;
        if (!reply) {           // local file, offline, or not a *.start.ng address
          if (!StartNG.ready) { StartNG.ready = true; emit(); }
          return StartNG.ready;
        }
        const before = identityKey();
        StartNG.online = true;
        StartNG.player = readPlayer(reply.user, true);
        StartNG.guest = readPlayer(reply.guest, false);
        StartNG.signedIn = !!StartNG.player;
        StartNG.look = (StartNG.player || StartNG.guest) ? (StartNG.player || StartNG.guest).style : null;
        StartNG.ready = true;
        if (identityKey() !== before || !StartNG.__announced) {
          StartNG.__announced = true;
          emit();
        }
        return true;
      })
      .catch(function () {
        inFlight = null;
        StartNG.ready = true;
        return StartNG.ready;
      });
    return inFlight;
  }

  function init() {
    refresh(true);
    // The player may sign in or out on start.ng while our tab is open.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refresh();
    });
    window.addEventListener('focus', function () { refresh(); });
    return StartNG;
  }

  /* ------------------------------------------------------- scoreboard --- */
  function signInUrl() {
    return START_NG + '/?return_to=' + encodeURIComponent(location.origin + location.pathname);
  }

  function signIn() {
    location.href = signInUrl();
  }

  // stats must match startng.json exactly: whole numbers, 0 .. 1e9.
  async function submitScore(stats) {
    if (!StartNG.ready) await refresh(true);
    if (!StartNG.signedIn) return { ok: false, error: 'Sign in to save your score' };
    const reply = await askStartNg({ type: 'startng:score', stats: stats }, 'startng:scoreSaved');
    if (!reply) return { ok: false, error: 'start.ng did not answer' };
    if (reply.ok === false) return { ok: false, error: reply.error || 'That run was not saved' };
    const result = reply.result || {};
    return {
      ok: true,
      best: result.best,
      improved: !!result.improved,
      rank: result.rank,
      stats: result.stats || stats,
    };
  }

  // Everyone can read the board, guests included. null = no answer yet.
  async function leaderboard(limit) {
    const reply = await askStartNg(
      { type: 'startng:leaderboard', limit: limit || 5 },
      'startng:leaderboardData'
    );
    if (!reply) return null;
    if (reply.ok === false) return [];
    return Array.isArray(reply.entries) ? reply.entries : [];
  }

  StartNG.init = init;
  StartNG.refresh = refresh;
  StartNG.signInUrl = signInUrl;
  StartNG.signIn = signIn;
  StartNG.submitScore = submitScore;
  StartNG.leaderboard = leaderboard;
  StartNG.normalizeStyle = normalizeStyle;

  window.StartNG = StartNG;
})();
