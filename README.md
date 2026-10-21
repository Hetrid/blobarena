# BLOB ARENA

**Grow a little. Cause a lot.** A complete TypeScript browser game with a Canvas renderer, intelligent bots, optional Node/WebSocket multiplayer, and touch controls.

## Start with bots — Render is optional

**You can deploy just the frontend to GitHub Pages and play immediately against bots.** Leave the multiplayer URL empty. Nothing connects to Render for bot matches. The same simulation runs in the browser, including all core physics, bot AI, modes, viruses, splitting, merging, and scoring.

A downloaded frontend still needs to be served over HTTP; do not double-click `index.html` as a `file://` URL. No backend is required to serve the frontend. This is server-independent gameplay, not a promise of playing without an internet connection before the page has loaded.

If a configured server cannot connect, Quick Play automatically starts a fresh local bot match after six seconds. Private-room connection failures show a retry screen with **Play bots now**. Offline players cannot see or play with other humans. Going offline starts a separate match rather than pretending the multiplayer match is continuing locally.

## Run locally

Install Node.js **22 or later**. Extract this folder, open a terminal in the folder containing `package.json`, then:

```sh
npm ci
npm run dev
```

Open **http://localhost:4173/**. Select **Bot practice**, or **Let's play** with the server URL left empty.

For local multiplayer, use a second terminal:

```sh
npm run dev:server
```

On the game's menu, open **Settings**, set **Multiplayer server URL** to `ws://localhost:3001`, and save. Choose **Play with friends → Create private room**. Open another browser/tab, use the same server URL, and join the six-character code. On another device on your Wi-Fi, use your computer's LAN IP for both URLs, and add that frontend origin to `ALLOWED_ORIGINS` when starting the backend. HTTPS frontends require WSS; HTTP local development can use WS.

Production commands:

```sh
npm run build
npm run build:server
npm start
```

The frontend is generated in `dist/`. The backend is compiled into `server-dist/`. `npm start` serves only the multiplayer backend and its `/health` endpoint. GitHub Pages serves the frontend separately.

## Deploy frontend to GitHub Pages

1. Create a GitHub repository. A public repository is simplest for free Pages hosting.
2. Upload the **contents of this extracted folder** to the repository root. `package.json`, `client/`, `shared/`, `server/`, `tests/`, `.github/`, and `package-lock.json` must be at the root. Do not upload the ZIP as a single file. Ensure `.github/workflows/pages.yml` is uploaded; some file pickers hide dot-prefixed folders. GitHub Desktop is an alternative to browser uploading.
3. Use the branch name **main**. If you use another default branch, change `branches: [main]` in `.github/workflows/pages.yml`.
4. Go to **Settings → Pages → Build and deployment → Source → GitHub Actions**.
5. Go to **Actions → Deploy Blob Arena to GitHub Pages → Run workflow**, or push a new commit. Wait for the green deployment check.
6. Open the published address shown in **Settings → Pages**. Bot matches work now, without Render or environment variables.

Vite uses `base: './'`, so assets work under repository subpaths such as `https://USERNAME.github.io/REPOSITORY/`. Invitations use query parameters, not server-side routes.

## Add Render multiplayer later

1. Create a Render account and connect the GitHub repository.
2. Choose **New → Web Service** (not Static Site) and select this repository. Leave **Root Directory** empty.
3. Select **Node**, branch **main**, and the **Free** instance.
4. Set **Build Command** to:

   ```sh
   npm ci --include=dev && npm run build:server
   ```

5. Set **Start Command** to:

   ```sh
   npm start
   ```

6. Add the environment variable **ALLOWED_ORIGINS** with your frontend's exact origin, for example `https://YOUR-NAME.github.io`. **Do not include `/REPOSITORY/` or a trailing slash.** For multiple sites, use a comma-separated list of exact origins. Add your custom domain separately if you have one. The server does not use a wildcard.
7. Set `NODE_VERSION` to `22`. Render supplies `PORT`; the server binds to `0.0.0.0` and uses that port automatically. Set Health Check Path to `/health` if shown.
8. Deploy and wait for **Live**. Visit `https://YOUR-SERVICE.onrender.com/health`; it should show `"ok":true`.
9. Configure the frontend URL using one of the methods below. It must be `wss://YOUR-SERVICE.onrender.com`.
10. Create a private room and use **Invite** to copy a link. That link carries the room code and public server address, so friends do not need to re-enter the address. It never carries the reconnect token.

Alternatively use **New → Blueprint**, select the repository, and follow `render.yaml`. Enter `ALLOWED_ORIGINS` when prompted. Manual setup above is sufficient; you do not need both methods.

### Three ways to set the server address

- **For your own device:** Settings → Multiplayer server URL → Save.
- **For everyone by default:** Edit `client/public/config.js` to contain:

  ```js
  window.BLOB_CONFIG = { serverUrl: 'wss://YOUR-SERVICE.onrender.com' };
  ```

  Commit the change. The Pages workflow rebuilds and republishes.
- **Using a GitHub variable:** Settings → Secrets and variables → Actions → **Variables** → New repository variable. Name it `VITE_SERVER_URL`, value `wss://YOUR-SERVICE.onrender.com`, then rerun the Pages workflow.

Precedence is device Settings, then `config.js`, then `VITE_SERVER_URL`. This address is public configuration, not a secret. Clear a previously saved Settings value to use a changed default.

### What happens when Render sleeps or restarts?

Render's Free services can sleep after 15 minutes without incoming traffic; waking can take about a minute. Quick Play chooses bots quickly, while Create/Join gives you retry and bot-practice controls. To wait for a cold server, open its health URL until it responds, then retry Create/Join. An existing connection sends ordinary heartbeats during gameplay.

A connection loss triggers bounded reconnect attempts. Your server-side seat is retained for **20 seconds**; your blob stops moving and remains vulnerable. Reconnect tokens are held only in tab memory. A page reload does not preserve the token. On expiry the bot count refills and host authority transfers. Live rooms are held in memory and disappear on server restart. No database or paid API is used.

Official hosting references: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Render Node deployment](https://render.com/docs/deploy-node-express-app), [Render WebSockets](https://render.com/docs/websocket), [Render free instances](https://render.com/docs/free). Hosting terms and limits can change.

## Play

| Action | Desktop | Mobile |
|---|---|---|
| Move | Point your mouse | Bottom-left analog joystick, or optional touch-to-move |
| Split | Space | SPLIT button |
| Eject / feed | Hold W | Hold FEED |
| Settings | Gear / Escape | Gear |
| Spectate | Eye button | Eye button |
| Invite friends | Room invite button | Room invite button |

Controls support independent pointer IDs, so you can move and split/feed together. Adjust sensitivity, size, left/right insets, and bottom inset in Settings. Positions are saved on your device. Portrait and landscape layouts use safe-area insets. There are no F-key bindings. Tap a button to unlock audio; music starts muted by default.

You start at 42 mass with a 2.8-second shield. Shielded cells cannot eat or be eaten by opponents, but can collect food. Eat cells at least 18% smaller than your cell when they overlap deeply enough. Bigger cells move more slowly. Space splits eligible cells, up to sixteen pieces. Pieces repel until their merge clocks expire, then attract and recombine. Feeding five ejected pellets to a virus launches another virus. Large cells burst when they consume viruses. A little mass decays above 180 mass.

## Modes and rooms

- **Classic:** continuous free-for-all with instant respawn and no timer.
- **Duel:** fair 135 starting mass, mirrored starting food, first to three wins / best of five. A new round starts four seconds after a result. A third human joins as a spectator. Offline Duel adds a bot opponent. Use **Arena controls** (or the online host's controls) to rematch.
- **Friends vs bots:** humans are one team, bots another; teammates cannot eat one another. Feed allies.
- **Arcade Chaos:** five-second warnings for Food Frenzy, Virus Outbreak, Double Growth, and King Hunt. Events do not affect Classic. Leader elimination can award a score bounty; mass gains still follow the normal rules.
- **Team Battle:** blue versus red, balanced join assignment, mass-based team scores and no friendly eating.

Default rooms target ten participants: one human plus nine bots, two plus eight, through five plus five. Higher human populations displace bots. Private hosts can choose 0–18 bot slots, a skill, an arena size, and chaos events. In a private room **Bot slots** means the number of bots with one active human; further humans replace bots. In Duel it means additional bot participants, so use zero for a clean two-human duel. Spectators do not displace bots.

Host controls apply settings and restart the room for everyone. The host is chosen server-side and transferred when the host's reconnect grace expires. Room codes and invite links isolate simulations. A private code is an invitation mechanism, not account-based access control.

## Bot AI

Six personalities use utility selection and steering: hunter, survivor, farmer, opportunist, strategist, and team support. They inspect nearby cells and food within a fixed visibility radius, sample food-density clusters, flee predicted split danger, pursue edible cells with limited prediction, and take calculated split risks. Smaller strategists seek virus shelter, larger bots avoid viruses, and support bots feed larger allies in team modes. They fight and eat other bots.

Easy, Normal, Hard, and Expert have distinct reaction delays, prediction fractions, threat distances, and split tendencies. Default matches mix skills. Expert bots obey the same speed, mass, merge, protection and collision rules; no human-only target bias or mass bonuses. Starting bot masses vary to populate the food chain; duels use equal starting mass.

## Structure and tuning

```text
client/             Canvas renderer, input, UI, local game runner, audio, network adapter
shared/src/         Deterministic simulation, bot AI, spatial hash, protocol and tuning
server/src/         Authoritative room server, WebSockets, validation, reconnects
 tests/             Gameplay and real WebSocket integration tests
.github/workflows/  Pages build, test and deploy workflow
render.yaml         Optional Render Blueprint
 dist/              Prebuilt frontend, also regenerated by npm run build
```

`shared/src/config.ts` centralizes balance values. Simulation: 25 Hz. Snapshots: 12.5 Hz. Rendering: requestAnimationFrame with interpolation, capped DPR, offscreen culling, optional trails and automatic detail reduction. Food is sent once then as changes, rather than retransmitting every stationary pellet in every snapshot. Spatial hashes accelerate cell and food broad-phase queries. Player/cell snapshots are room-wide for these small arenas; there is no viewport network filter yet.

The server accepts inputs, not client position/mass/kill declarations. It validates finite vectors, input sequences, host authority, names, room limits, origins, a 2 KiB message limit and a per-socket message rate. WebSocket heartbeats remove broken peers. Backpressure drops snapshots for slow clients. This is a casual small-room server; it does not include authentication, distributed rooms, persistent matches or platform-level DDoS protection.

Cosmetics, settings, personal bests and achievements use localStorage, tolerate unavailable storage, and are explicitly device-local. Colors are always available; faces, striped and spotted patterns unlock through play. All art is code-drawn; audio is synthesized. No third-party art/music downloads or runtime CDNs are needed.

## Verify

```sh
npm run check
```

This runs TypeScript checking, deterministic gameplay tests, real WebSocket integration tests, and both production builds. See `TEST_REPORT.md` for the exact checks executed and limits of verification. Physical iOS/Android devices and the user's actual GitHub/Render accounts must be checked after deployment.

## Updates and troubleshooting

- **Update:** change source, commit to `main`; Pages rebuilds. Render can auto-deploy its linked branch. Restarting Render ends current rooms.
- **Bots only:** this is expected with an empty URL or after the Quick Play timeout. Configure WSS and use Create/Join for a shared match.
- **No connection / 403:** confirm `ALLOWED_ORIGINS` is the frontend origin, with no path or slash. Check the Render logs and `/health`. WSS is mandatory on HTTPS.
- **Two friends see different games:** both must use the same server and room code. Local practice is separate on each device. Public quick play also separates game modes.
- **A friend cannot join:** the code might belong to a room that expired or a restarted server. Create a fresh room and share a new invitation.
- **Pages 404 / blank:** ensure Source is GitHub Actions, `.github/workflows/pages.yml` exists, branch names match, and the workflow succeeded. Upload all source files, not only `client/index.html`.
- **Local server URL fails on a phone:** `localhost` means the phone itself. Use your computer's LAN address and allow the frontend origin on the backend.
- **Browser audio silent:** tap a button first, increase effects/music volume in Settings, and check device mute restrictions.
- **Touch feels cramped:** change control size and insets, collapse the leaderboard or minimap, or rotate the device.
- **Game pauses in a background tab:** local practice pauses deliberately; online rooms keep running. Switch back promptly to reconnect if needed.

## Current scope

The complete playable core and five modes are implemented. Optional shrinking-arena sudden death, gamepad support, fully coordinated bot squads, deliberate virus-shooting AI, global accounts/leaderboards, resumable rooms across restarts, and automatic live arena resizing are not implemented. Arena size is configurable per room. Events and performance values are tunable starting points, not a claim of extensive competitive balance testing.
