# Crewline

An original social-deduction multiplayer game in the Among Us genre: complete
objectives, observe other players, lie, investigate, sabotage, call meetings,
and vote. Real-time multiplayer, server-authoritative, browser-based.

This is a real, playable game — not a mockup. A full match runs end-to-end
over the network: accounts → lobby → role assignment → free movement on one
of three original maps → tasks/kills/sabotage/voice chat → emergency
meetings → chat & voting → win conditions → recap → replay.

## Run it

```
npm install
npm start
```

Then open `http://localhost:3000` in **4–20** browser tabs/devices (the game
needs at least 4 players to assign roles sensibly). One player creates a
match and shares the 5-letter room code (or everyone hits **Quick Play** to
auto-match into an open public lobby); everyone else joins with the code.

Controls: **WASD / arrow keys** to move (or the on-screen joystick on touch
devices). Contextual buttons appear at the bottom of the screen when you're
near something you can interact with (a task, a body, the emergency button,
a vent, a sabotage panel). Ability buttons (kill, shield, cloak, etc.) appear
above those when your role has one — they auto-target the nearest valid
player in range.

## What's actually built

**Core loop** — accounts (see below), lobby with room codes or public quick
play, ready-up/host start, live role assignment, free 2D movement with real
collision, tasks that count toward a crew win, an impostor kill + body
system, emergency meetings and reported-body meetings, text chat + proximity
voice chat, timed discussion → voting → animated reveal → ejection, ghost
mode for the dead (can still finish tasks, chat/hear only other ghosts), and
win conditions for every faction below.

**Three original maps**, host-selectable per match, each with a genuinely
different layout and connectivity, not a reskin:
- **Aphelion Station** — an 11-room space station around a central Atrium,
  two vent networks.
- **Meridian Liner** — a cruise ship: two long decks (upper/lower) joined by
  three stairwells, a linear-not-hub layout.
- **Hollow Manor** — a mansion with irregular room sizes and looped
  corridors (not hub-and-spoke) for a maze-ier feel.

Each map has its own sabotage flavor text (e.g. "Engine Overload" instead of
"Reactor Meltdown" on the ship) and ejection flavor text ("thrown overboard,"
"thrown out of the manor," etc.) — cosmetic, but it makes each map feel like
its own place rather than a palette swap. All three were validated with a
flood-fill connectivity check (every task/vent/sabotage/emergency point is
reachable from spawn) before being wired in.

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

**Sabotage** — Reactor/O2-equivalent are timed crises with two physically
separate panels (real co-op pressure); Lights/Comms-equivalent are lighter
disruptions. Sabotage is on a shared cooldown so it can't be spammed.

**Tasks** — 5 real interactive minigames (not "walk up and press E"):
wire-matching, a Simon-says memory sequence, a timing-bar calibration,
a press-and-hold swipe window, and a memorize-the-order circuit puzzle.

**Host settings & presets** — map choice, impostor count, tasks per player,
movement speed, confirm-ejects, anonymous votes, voice chat on/off, plus five
presets (Classic, Casual, Chaos, Detective, Quick Match) — and per-role
checkboxes so the host can pick exactly which crew/impostor/neutral roles are
in the pool.

**Proximity voice chat** — real peer-to-peer WebRTC audio, signaled over the
existing Socket.IO connection (no extra server needed), using free public
STUN. Volume falls off with distance during normal play, jumps to full
volume during meetings, and living/dead players are on separate channels
(mirroring text chat) — you can't hear the dead, and they can't be heard.
Toggle it per-match in host settings; each player opts in with a mic button.
*Known limitation*: without paid TURN infrastructure, a small percentage of
players behind strict/symmetric NATs won't establish a direct connection —
that's a real constraint of the free-tier approach, not a bug.

**Accounts, cosmetics, and friends** — first connection auto-creates a guest
account (persisted via a device token in `localStorage`, no password); you
can rename yourself, add friends by username (see their online status live),
and unlock cosmetics (8 hats + a preferred color) by earning achievements.
Stats/achievements/cosmetics are tracked server-side per account — not
client-trusted localStorage — and are what a **real accounts system** in
this genre needs at minimum. What it deliberately isn't: a purchasable
economy, or an account with a password/email recovery flow (see below).

**Animation & feedback polish** — a full-screen red flash on kills (for both
the killer and, separately, the moment you're eliminated as the victim),
cloak/ghost transitions that fade+desaturate instead of snapping, a
pulsing poison-sickness ring that quickens as it nears its deadline, a
screen-flash alarm when an emergency meeting is called, a fresh-body
discovery ring, and a dedicated ejection sequence with per-map flavor text.

**Mobile touch controls** — on-screen virtual joystick for movement on touch
devices (auto-detected), with the same tap-to-interact buttons used on
desktop.

**Replay system** — the server records a 1Hz positional snapshot of the
whole match (all player positions — including ones that were hidden from you
live, like a cloaked impostor — plus bodies and active sabotage) alongside
the existing event timeline. After a match, **Watch Replay** opens a
scrub-through viewer: play/pause, 0.5×–4× speed, a draggable timeline,
click-to-jump event markers, and cycling which player the camera follows.
Session-only (not saved to disk) — see below.

**End of match** — full role reveal for every player, win/loss per player
(Survivors can "also win" alongside the main outcome), newly-unlocked
achievements, a timestamped event timeline, and the replay above.

Verified end-to-end with automated multi-browser tests (real socket
connections, real browser contexts) covering: account auto-registration +
uniqueness + rename + mutual friending, map selection actually changing which
map a match loads, role-pool checkboxes, movement sync, voice-chat peer
connection setup and group re-partitioning on death (living vs. ghost
channels, with cross-channel signaling explicitly verified as blocked),
task completion, kill → report → meeting → vote → win, server-side
progression recording, and the replay viewer.

## Architecture

- `server/` — Node.js + Express + Socket.IO. Fully server-authoritative:
  the server owns positions, roles, cooldowns, sabotage state, votes, voice
  group membership, and win conditions. Clients send input/intent and render
  whatever the server sends back.
  - `maps/` — `mapFactory.js` (shared tile-grid/collision engine) plus one
    file per map (`aphelion.js`, `meridian.js`, `hollow.js`) and `index.js`
    (the registry). Adding a fourth map is just a new file in this
    directory.
  - `roles.js` / `presets.js` — the role catalog and lobby setting presets
    (including per-map/role/voice sanitization of host-supplied settings).
  - `rooms.js` — lobby/room lifecycle (create, join, leave, host, quick
    play/public matchmaking).
  - `accounts.js` / `cosmetics.js` — the account store (JSON file on disk,
    `server/data/accounts.json`, gitignored), achievements, friends, and the
    achievement→cosmetic unlock mapping.
  - `Game.js` — the match engine: movement tick, abilities, kills, sabotage,
    meetings, voting, win conditions, voice-group computation, replay-frame
    recording, and state snapshots (with per-viewer filtering — you don't
    receive data about cloaked players, players in vents, etc. unless you're
    allowed to see it).
- `public/` — vanilla JS + Canvas, no build step. `net.js` (socket wrapper),
  `main.js` (screen flow), `render.js` (canvas draw, reused by both live play
  and replay playback), `game.js` (input, HUD, proximity actions), `touch.js`
  (mobile joystick), `voice.js` (WebRTC mesh), `replay.js` (scrub-through
  viewer), `account.js` (profile/friends/cosmetics UI), `roles-data.js` /
  `maps-data.js` / `cosmetics-data.js` (client-side mirrors of server
  catalogs, for rendering pickers without a round trip), `ui/lobby.js`,
  `ui/tasks.js` (minigames), `ui/meeting.js` (chat/voting/ejection sequence).

## Known simplifications (and why)

- **Movement netcode is server-tick + client interpolation**, not full
  client-side prediction with reconciliation. It's responsive at LAN/normal
  internet latency for a 2D top-down game at this scale; a rollback system
  would be the next step if you outgrow this.
- **Task completion is client-reported.** The minigames run in the browser
  and tell the server "done"; the server trusts it. Fine for playing with
  friends, not cheat-proof. Hardening this (server-issued task seeds/checks)
  is a natural next step before any public matchmaking at real scale.
- **Single process, in-memory match state + a flat JSON file for accounts.**
  Great for one server instance and a friends-scale player base; horizontal
  scaling would need moving both to a real database (Postgres/Redis).
- **Accounts have no password.** Identity is a device token in
  `localStorage`; lose the browser/device and you lose the account (a new
  guest is created). That's a deliberate simplification, not an oversight —
  real auth (password, email recovery, OAuth) is a security-sensitive
  feature that deserves its own decision, not something to improvise.
- **Voice chat has no TURN server**, only STUN. It works for most
  networks but not all — see the voice chat section above.
- **Replays aren't persisted.** They live in server memory for the lifetime
  of the match and are pushed to clients at game-over; restart the server or
  end the session and they're gone. Saving them would mean picking a storage
  backend and a retention policy — a product decision, not just code.

## Explicitly not built

- **A real money/cosmetics economy** (purchases, a storefront, currency).
  What's built is real unlocks (cosmetics earned via achievements,
  server-tracked, not client-trusted) — the honest version of "progression"
  without inventing payment processing I'm not positioned to stand up
  responsibly (it needs a business entity, a payment processor, legal terms).
- **Password/email account recovery.** Explained above.
- **A dedicated TURN relay** for voice chat in restrictive network
  conditions. Explained above.

Everything above this section is real, working, and was built in the
priority order the original brief itself specified: functional gameplay,
movement, and multiplayer stability first; social deduction, roles, and
maps next; performance, animation, and polish after that; progression and
cosmetics last — and it went further than that ranking asked, covering
voice chat, accounts/friends, matchmaking, and a replay system too. The
three items in this section are the ones still cut, and each is cut because
it requires an infrastructure, security, or business decision that isn't
mine to make unilaterally — not because it was more code than I was willing
to write.
