---
title: Sprawl
emoji: 🏰
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# Sprawl

A 5-minute, turn-based territory game for **2–4 players**: humans in a browser, AI agents over a tiny JSON API, and built-in bots for empty seats. All in one match.

## Rules (one paragraph)
The 7×7 board has land worth 1–3 points and a central **crown** worth 5 (holding it also pays +1 energy per turn). You start on your own home cell. Each turn you gain **+3 energy** (you can bank up to 9) and may take any number of actions: **Claim** an empty cell next to your land (cost = its value), **Raid** a rival's unfortified cell next to your land (cost = value + 2), or **Fortify** one of your cells (cost 2; it can't be raided until your next turn). Then end your turn. The first player rotates every round. After 10 rounds, or once the board is full, the player whose land is worth the most wins (ties go to the crown holder, then more cells, then more banked energy).

Every turn is a real choice: grab cheap land now, save for the 3s and the crown, raid the leader, or spend energy fortifying your border.

## Play
Open the public URL, type a name, **Create match**, share the 6-letter code (or `URL/#CODE`), and/or click **Fill empty seats with bots & start**. No install or login.

## Run locally
```
node server.js          # Node 18+, zero dependencies; PORT env var (default 8080)
open http://localhost:8080
node sim.js             # 1000 bot-vs-bot games per player count: seat balance check
```

## Agent API (JSON over HTTP, CORS open)
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/matches` | `{"maxPlayers":2-4}` | `{"code"}` |
| GET | `/api/matches` | | open lobbies |
| POST | `/api/matches/{code}/join` | `{"name"}` | `{"seat","token"}` (match auto-starts when full) |
| POST | `/api/matches/{code}/bots` | | fills empty seats with bots and starts |
| POST | `/api/matches/{code}/start` | | starts with seated players (≥2) |
| GET | `/api/matches/{code}` | | full state |
| POST | `/api/matches/{code}/move` | `{"token","action":"claim"\|"raid"\|"fortify"\|"end","x","y"}` | new state, or `400 {"error"}` |

State fields: `status` (`lobby`/`playing`/`finished`), `round`, `rounds`, `turn` (seat to move), `players[]` (`name, bot, color, energy, score`), `board[]` (`x, y, value, owner|null, fort`; index `y*size+x`), **`legalMoves[]`** for the player to move (each with `action, x, y, cost`, so an agent can just pick one), `winner` (seat or `null` for a draw), and `log[]`, the full match log / replay.

Agent loop: poll `GET` about once a second; when `turn == mySeat`, POST moves until you POST `end` (or run out of energy, which ends the turn automatically).

### Sample bot
`node bots/sample_bot.js https://YOUR-URL [CODE] [Name]`. With no code it creates a match and prints a link for a human to join.

## Balance
`node sim.js` (1000 bot games per player count, built-in bots): 2p seats 51/49% with 0 draws, 3p 32/31/35%, 4p 20–27% per seat; the crown is contested in essentially every game.

MIT licensed.
