# Tricity Hold'em

Multiplayer **play-money** No-Limit Texas Hold'em for Tricity Mitsubishi events. No real money, no buy-in.

- Host screen (TV/projector): `/host` — sign in with the host PIN (Render env var `HOST_PIN`), pick blind-level length and optional turn timer, show the join URL / PIN / QR code, then deal.
- Players (phones): `/` or `/j/<PIN>` — enter the PIN and a nickname.
- Up to 20 players, 120 chips each per game. Blinds 1/2, 2/4, 5/10, 10/20, 20/40, 50/100, 100/200, 200/400, 500/1000…; levels rise on a timer (default 10 min) or via the host's "Next blind level" button and apply from the next hand.
- Server-authoritative engine (`engine.js`) with crypto shuffle, side pots, split pots, heads-up rules, min-raise / incomplete all-in rules.

```
npm install
npm test                      # engine unit tests
node server.js                # http://localhost:3460
PWF=data/host_password.txt node test/e2e.js http://localhost:3460   # multi-client end-to-end run
```
Games live in memory only; a server restart (Render free plan sleep/redeploy) ends any table in progress.

## Buy-in tracker (optional)
The app only tracks buy-ins. It never moves or checks money.
- Host: tick **Buy-in** on the create screen, or use the lobby **Edit** button. Enter an amount in CAD (default $5) and your e-Transfer email.
- Players see the amount and the email (with a Copy button) after they join. They send an Interac e-Transfer from their bank app, then tap **I've sent it**. The status goes to Pending, and they can undo it.
- The host taps **Confirm** (or Undo) or ✕ to remove a player. **Start stays locked until every player is confirmed or removed.**
- Pot = amount × confirmed players. Final standings show "Pot: $X — pay to <winner>". Play again keeps the settings and resets every player to Not paid.
- The email is only sent to the host screen and to players who have joined this game.
- Test: `node test/buyin.js <url>`

## Computer players
- In the lobby, the host taps **+ Easy**, **+ Medium** or **+ Hard** to add a computer player (up to 5 per game; they count toward the 20 seats). Remove one with ✕.
- Names start with the skill letter: E for Easy (Eddie, Ella…), M for Medium (Max, Mia…), H for Hard (Hank, Holly…). Names never repeat. A 🤖 badge shows the level on the TV and on phones.
- Easy is loose and passive and makes mistakes. Medium plays by hand strength, draws and pot odds. Hard uses position-aware preflop ranges, Monte Carlo equity, pot odds, value bets, semi-bluffs, bluffs and push/fold when short-stacked.
- Bots get only their own cards plus public table info, act through the same legal-action rules, take about 1–3 s per move, and stop on Pause or End game.
- Buy-in: bots never pay and never collect. The pot goes to the best-placed **human** (chips, then who was knocked out last). If a bot wins, the line says so.
- Tests: `node --test test/bots.test.js` (engine sim incl. Hard vs Easy), `node test/sim.js 200` (win-rate table), `node test/bots.js <url>` (browser), `node test/botserver.js <url>` (fast server run: start the server with BOT_MS=20 SHOWDOWN_MS=150 FOLDWIN_MS=100).

## Seat recovery
- The phone stores its seat token. It re-sends it on every reconnect, on wake-up (visibility, pageshow, online, focus) and in a heartbeat every 10 s (`seat:check`).
- If an action comes back with "Not in a game" (code `rebind`), the phone rejoins with its token and retries the action once. If no answer comes, it reconnects and retries once.
- If that still fails, the phone shows a **Rejoin my seat** screen: enter the PIN and your name. This only works while that seat is away, unless the host has allowed it. If another screen takes the seat, the old screen shows **Use this screen** instead of a dead error.
- Host: tap any player's seat, then **Let <name> rejoin**. This shows a one-time QR code and link (valid 15 min) and allows a name rejoin for 15 min.
- An away player keeps their seat and chips. Their turns are auto-checked or folded after the turn timer, or after 30 s when the timer is off. After 2 missed turns in a row it's 5 s.
- Test: `node test/recover.js <url>` (fast local server: `BOT_MS=300 AWAY_MS=4000 AWAY_FAST_MS=1000`).
