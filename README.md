# Aphelion Station

An original social-deduction multiplayer game in the Among Us genre: complete
objectives, observe other players, lie, investigate, sabotage, call meetings,
and vote. Real-time multiplayer, server-authoritative, browser-based.

This is a real, playable game — not a mockup. A full match runs end-to-end
over the network: lobby → role assignment → free movement on a tile-based
map → tasks/kills/sabotage → emergency meetings → chat & voting → win
conditions → recap.

## Run it

```
npm install
npm start
```

Then open `http://localhost:3000` in **4–20** browser tabs/devices (the game
needs at least 4 players to assign roles sensibly). One player creates a
match and shares the 5-letter room code; everyone else joins with it.

Controls: **WASD / arrow keys** to move. Contextual buttons appear at the
bottom of the screen when you're near something you can interact with (a
task, a body, the emergency button, a vent, a sabotage panel). Ability
buttons (kill, shield, cloak, etc.) appear above those when your role has
one — they auto-target the nearest valid player in range.

## What's actually built

**Core loop** — lobby with room codes, ready-up/host start, live role
assignment, free 2D movement with real collision on a hand-built map
(11 named rooms + corridors), tasks that count toward a crew win, an
impostor kill + body system, emergency meetings and reported-body
meetings, text chat, timed discussion → voting → animated reveal → ejection,
ghost mode for the dead (can still finish tasks, chat only with other
ghosts), and win conditions for every faction below.

**Map** — *Aphelion Station*, an original 11-room layout (Atrium, Med Bay,
Bridge, Comms Array, Security Hub, Reactor Core, Command, Cargo Bay, Power
Grid, Life Support, Armory) connected by corridors, plus two independent
vent networks for physical vent-to-vent travel.

**13 roles across 3 factions**, each mechanically distinct (`server/roles.js`):
- **Crew**: Crewmate, Engineer (vents), Sheriff (shoot — kill the wrong
  person and you die instead), Medic (temporary shield), Tracker (see a
  target's current room), Guardian (secretly bonded to another player — you
  die in their place if they're attacked), Forensic Investigator (examine a
  body for a clue).
- **Impostor**: Impostor, Swooper (cloak invisible), Poisoner (delayed kill
  — the victim looks fine until it's too late), Janitor (clean a body so it
  can never be reported).
- **Neutral**: Jester (wins if voted out), Executioner (wins if their
  secret target is voted out), Survivor (wins by living to the end),
  Arsonist (douse players, then ignite everyone doused at once).

**Sabotage** — Reactor meltdown and Oxygen depletion are timed crises with
two physically separate panels (real co-op pressure); Lights and Comms are
lighter disruptions. Sabotage is on a shared cooldown so it can't be spammed.

**Tasks** — 5 real interactive minigames (not "walk up and press E"):
wire-matching, a Simon-says memory sequence, a timing-bar calibration,
a press-and-hold swipe window, and a memorize-the-order circuit puzzle.

**Host settings & presets** — impostor count, tasks per player, movement
speed, confirm-ejects, anonymous votes, plus five presets (Classic, Casual,
Chaos, Detective, Quick Match) — and per-role checkboxes so the host can
pick exactly which crew/impostor/neutral roles are in the pool for the match.

**Animation & feedback polish** — a full-screen red flash on kills (both for
the killer and, separately, the moment you're eliminated as the victim),
cloak/ghost transitions that fade smoothly instead of snapping, a pulsing
poison-sickness ring, a screen-flash alarm when an emergency meeting is
called, and a dedicated ejection sequence (the ejected player's color spins
and flies off-screen before the reveal text shows).

**Mobile touch controls** — on-screen virtual joystick for movement on touch
devices (auto-detected), with the same tap-to-interact buttons used on
desktop for tasks/abilities/reporting/etc.

**Progression** — lightweight per-browser stats via `localStorage` (games
played/won) and 8 achievements (first win, 10 games played, winning as each
faction/role archetype, etc.), shown on the menu and end screen. This is
explicitly not a full accounts/economy system — see roadmap.

**End of match** — full role reveal for every player, win/loss per player
(Survivors can "also win" alongside the main outcome), newly-unlocked
achievements, and a timestamped event timeline of the whole match.

Verified end-to-end with an automated 4-browser test that plays a full
match through real socket connections: create → join → ready → start →
move → complete a task → kill → report → meeting → vote → eject → crew win →
progression recorded.

## Architecture

- `server/` — Node.js + Express + Socket.IO. Fully server-authoritative:
  the server owns positions, roles, cooldowns, sabotage state, votes, and
  win conditions. Clients send input/intent and render whatever the server
  sends back.
  - `map.js` — the tile grid, rooms, corridors, vents, sabotage panels,
    task spots (all data, no rendering).
  - `roles.js` / `presets.js` — the role catalog and lobby setting presets.
  - `rooms.js` — lobby/room lifecycle (create, join, leave, host).
  - `Game.js` — the match engine: movement tick, abilities, kills,
    sabotage, meetings, voting, win conditions, state snapshots (with
    per-viewer filtering — you don't receive data about cloaked players,
    players in vents, etc. unless you're allowed to see it).
- `public/` — vanilla JS + Canvas, no build step. `net.js` (socket wrapper),
  `main.js` (screen flow), `render.js` (canvas draw), `game.js` (input,
  HUD, proximity actions), `touch.js` (mobile joystick), `progression.js`
  (localStorage stats/achievements), `roles-data.js` (client-side mirror of
  the role catalog for the lobby checkboxes), `ui/lobby.js`, `ui/tasks.js`
  (minigames), `ui/meeting.js` (chat/voting/ejection sequence).

## Known simplifications (and why)

- **Movement netcode is server-tick + client interpolation**, not full
  client-side prediction with reconciliation. It's responsive at LAN/normal
  internet latency for a 2D top-down game at this scale; a rollback system
  would be the next step if you outgrow this.
- **Task completion is client-reported.** The minigames run in the browser
  and tell the server "done"; the server trusts it. Fine for playing with
  friends, not cheat-proof. Hardening this (server-issued task seeds/checks)
  is a natural next step before any public matchmaking.
- **Single process, in-memory state.** Great for one server instance;
  horizontal scaling would need moving room state to Redis or similar.

## Deliberately deferred (not built — scope was enormous, this is what got cut)

- **Voice chat** (proximity + meeting voice). Needs WebRTC mesh/SFU
  infrastructure; text chat covers the same social-deduction function today.
- **A real cosmetics/progression economy** (hats, pets, unlocks, XP curves).
  What exists today is honest per-browser stats + achievements (see above),
  not an economy — no accounts, nothing purchasable, nothing server-tracked.
- **Matchmaking, friends, parties, accounts/profiles.** Only private room
  codes today; stats live in the browser, not on an account.
- **Replay system** (post-match scrub-through with free camera).
- **Multiple maps.** One deep map instead of several shallow ones.
- **Fully cinematic per-ability animations** (a cloak sheet visibly pulling
  over a character in multiple stages, a Sheriff drawing a weapon, a
  Morphling-style transformation, etc.). What's built now is real animated
  feedback — fade transitions, pulsing rings, screen flashes, an ejection
  sequence — just not multi-stage choreographed sequences per ability.

None of this was skipped by accident — the brief asked for a genuinely
commercial-scope game, and the instruction that came with it was to
prioritize functional gameplay, movement, multiplayer stability, and social
deduction over visual polish, progression, and cosmetics. That's the order
this was built in, and it's also the order these remaining items would be
tackled in if you want to keep going — voice chat and a real economy are the
two that need infrastructure/product decisions (hosting, a database, a
WebRTC/TURN setup) rather than just more code.
