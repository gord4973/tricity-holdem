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
