# Volcano 🌋

An endless eruption runner for **[start.ng](https://start.ng)** — plain HTML, CSS and
JavaScript. No build step, no dependencies, no external assets.

> The mountain is about to blow. Outrun the eruption — hop the lava rocks,
> duck the fireballs, grab the gems.

| Address | `https://volcano.start.ng` |
| --- | --- |
| Repo | `https://github.com/Jaylinka/volcano` |
| Leaderboard | **Score**, **Gems**, **Metres run** (all highest wins) |
| Needs building? | No — `index.html`, `styles.css`, `game.js` and `startng.js` are ready to serve as they are |

## Files

| File | What it is |
| --- | --- |
| `index.html` | The game page (title + heading **Volcano**). Loads `styles.css`, `startng.js`, `game.js`. |
| `game.js` | All game logic, including the modernised `drawCharacter()` (rounded shapes, gradients, soft shadow, glossy head highlight) and the rounded/gradient obstacle rendering. |
| `startng.js` | Everything start.ng: who's playing, their character, saving runs, reading the leaderboard. |
| `styles.css` | UI theme: HUD, menus, player chip, leaderboard, character customiser. |
| `startng.json` | Declares the leaderboard columns: `score`, `gems`, `metres`. |
| `cover.png` | 1600 × 1000 (16:10) cover picture for the game's card on start.ng. |
| `favicon.png` | Tab icon. |
| `play.html` | Optional **single-file** build (CSS + JS inlined) for quick local testing. Regenerate with `node tools/build-play.js`. |
| `tools/build-play.js` | Regenerates `play.html` from the source files. |
| `tools/publish.sh` | Checks and publishes the game on start.ng, and prints the approve link. Handy tooling, not needed by the game. |

## Play

Open `index.html` in any modern browser, or serve the folder (`python3 -m http.server`).

### Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Jump (tap again for a double jump) | `Space` / `↑` / `W` | tap the upper part of the screen |
| Duck (in air = fast fall) | `↓` / `S` (hold) | hold the lower part of the screen |
| Pause | `P` or `Esc` | ❚❚ button |
| Mute | `M` | 🔊 button |

## How it uses start.ng

The game talks to start.ng's hidden **connect page** (`https://start.ng/connect`) with
`postMessage`; every reply is checked against `e.origin`, so only start.ng can answer.
The whole integration lives in `startng.js`.

- **Who's playing** — `startng:whoami` returns the player (or start.ng's guest). The
  game re-asks when the tab regains focus, so signing in or out on start.ng is picked up.
- **Your character runs** — the runner is drawn from the player's start.ng `style`
  (`body`, `primaryColor`, `secondaryColor`, `skinColor`, `hairColor`, `hair`, `hat`,
  `accessory`), so a player looks like themselves here too. The **Dressing room** lets
  them play with the look locally; "Use my start.ng look" puts their real character back.
- **Profile chip** — the character's `face`, `name` and `@account` on the menu, with a
  **Sign in** button for guests (`https://start.ng/?return_to=…`).
- **Runs are saved** — at the end of every run the game sends exactly the stats in
  `startng.json` (`score`, `gems`, `metres`) via `startng:score`, then shows whether it
  was a new best and the player's rank. Guests are invited to sign in instead.
- **Leaderboard** — the top 5 runs are shown on the menu and after a run, with the
  player's own row highlighted (`player_id` vs their `id`).

Everything degrades gracefully: opened as a plain file, offline, or on a non-start.ng
host, every start.ng call quietly returns nothing and the game plays as normal.

## Tweaking the game

- `game.speed` (starts at 330 px/s), `game.lives` (3), the score rate.
- `nextSpawnDelay()` — how tightly obstacles are spaced.
- `spawnWave()` — which obstacles appear and how often.
- `player.h * 12.2` / `player.h * 9.6` — jump and double-jump strength.
- `CUSTOM_GROUPS` / `SKINS` / `OUTFITS` / `PANTS` / `HAIRCOLS` — dressing-room options.
- `startng.json` — the leaderboard columns (1–5 stats, first one ranks).

## Push to GitHub

```bash
cd volcano
git init
git add .
git commit -m "Volcano: endless eruption runner for start.ng"
git branch -M main
git remote add origin https://github.com/Jaylinka/volcano.git
git push -u origin main
```

## Publish on start.ng

Once the repo is pushed, one command does both steps (no key needed — the repo just
has to be public):

```bash
bash tools/publish.sh
```

That runs `POST /games/check` first (so a broken build never reaches players), then
`POST /games/publish`, and prints the one-time `approve_url` if this is the first
publish. By hand, the same two calls are:

```bash
# 1. would it go live? (expect "ok": true, warnings if any)
curl -s -X POST https://api.start.ng/games/check \
  -H 'Content-Type: application/json' \
  -d '{"repo_url":"https://github.com/Jaylinka/volcano","name":"volcano"}'

# 2. put it live — the reply's approve_url is a one-time link to open and approve
curl -s -X POST https://api.start.ng/games/publish \
  -H 'Content-Type: application/json' \
  -d '{"repo_url":"https://github.com/Jaylinka/volcano","name":"volcano"}'
```

Open the `approve_url`, sign in with start.ng and say yes — the game is then live at
**https://volcano.start.ng** on your account. After that, **pushing to `main` updates it
by itself** (usually within a minute or two), so the everyday loop is just: edit, commit, push.
