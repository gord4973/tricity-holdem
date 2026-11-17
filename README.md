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
