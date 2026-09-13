import { getMap } from "./maps/index.js";
import { ROLES, FACTIONS, abilityDef, publicRoleInfo } from "./roles.js";
import { dist, shuffle, nextId } from "./utils.js";
import * as Accounts from "./accounts.js";

const TICK_MS = 50; // 20Hz
const BASE_SPEED = 150; // px/s
const REPORT_RANGE = 130;
const EMERGENCY_RANGE = 150;
const VENT_ENTER_RANGE = 70;
const SABOTAGE_FIX_RANGE = 80;
const REACTOR_TIME_MS = 45000;
const O2_TIME_MS = 60000;
const COMMS_TIME_MS = 30000;
const SABOTAGE_GLOBAL_COOLDOWN_MS = 15000;
const REPLAY_FRAME_EVERY_N_TICKS = 20; // 50ms * 20 = 1Hz replay recording

const PLAYER_COLORS = [
  "#e05252", "#4d8fe0", "#3fae5c", "#e0c23f", "#e07fdc", "#e0873f",
  "#4fd1c5", "#a06be0", "#d4d4d4", "#8a5a3f", "#5ce0a3", "#e0e0e0",
];

export class Game {
  constructor({ code, players, settings, io, onEnded }) {
    this.code = code;
    this.io = io;
    this.settings = settings;
    this.map = getMap(settings.mapId);
    this.onEnded = onEnded;
    this.startedAt = Date.now();
    this.ended = false;
    this.timeline = [];
    this.replayFrames = [];
    this.bodies = [];
    this.voiceReady = new Set();
    this.emergencyUsed = {};
    this.nextSabotageAt = 0;
    this.sabotages = {
      reactor: { active: false }, o2: { active: false },
      lights: { active: false }, comms: { active: false },
    };
    this.meeting = null;
    this.taskTotal = 0;
    this.taskDone = 0;

    this.players = new Map();
    const usedColors = new Set();
    players.forEach((p, i) => {
      let color = p.preferredColor && !usedColors.has(p.preferredColor) ? p.preferredColor : null;
      if (!color) color = PLAYER_COLORS.find((c) => !usedColors.has(c)) || PLAYER_COLORS[i % PLAYER_COLORS.length];
      usedColors.add(color);
      this.players.set(p.id, {
        id: p.id, name: p.name, color, hat: p.equippedHat || null, accountId: p.accountId || null,
        x: this.map.spawnPoint.x, y: this.map.spawnPoint.y,
        alive: true, ghost: false,
        role: "CREWMATE", faction: FACTIONS.CREW,
        input: { dx: 0, dy: 0 },
        tasks: [], cooldowns: {}, effects: {},
        ventId: null, ventGroup: null,
        bond: null, executionerTarget: null, doused: false,
        connected: true,
      });
    });

    this._assignRoles();
    this._spawnAll();
    this._assignTasks();

    this.tickHandle = setInterval(() => this._tick(), TICK_MS);
  }

  // ---------- setup ----------

  _assignRoles() {
    const ids = shuffle([...this.players.keys()]);
    const n = ids.length;
    const impostorCount = Math.max(1, Math.min(this.settings.impostorCount, Math.floor((n - 1) / 2) || 1));
    const impostorIds = ids.slice(0, impostorCount);
    let rest = ids.slice(impostorCount);

    // Neutral roles peel off from the remaining pool first.
    const neutralIds = [];
    for (const roleId of this.settings.neutralRoles || []) {
      if (rest.length === 0) break;
      const pid = rest.shift();
      const p = this.players.get(pid);
      p.role = roleId;
      p.faction = FACTIONS.NEUTRAL;
      neutralIds.push(pid);
    }

    // Remaining crew get CREWMATE by default; some upgraded to special crew roles.
    const crewPool = shuffle(this.settings.crewRolePool || []);
    rest.forEach((pid, i) => {
      const p = this.players.get(pid);
      if (i < crewPool.length) {
        p.role = crewPool[i];
        p.faction = FACTIONS.CREW;
      } else {
        p.role = "CREWMATE";
        p.faction = FACTIONS.CREW;
      }
    });

    const impPool = shuffle(this.settings.impostorRolePool || []);
    impostorIds.forEach((pid, i) => {
      const p = this.players.get(pid);
      p.faction = FACTIONS.IMPOSTOR;
      p.role = i < impPool.length ? impPool[i] : "IMPOSTOR";
    });

    // Executioner target: any alive crew player.
    for (const pid of neutralIds) {
      const p = this.players.get(pid);
      if (p.role === "EXECUTIONER") {
        const crewIds = [...this.players.values()].filter((q) => q.faction === FACTIONS.CREW && q.id !== pid);
        if (crewIds.length) {
          const target = crewIds[Math.floor(Math.random() * crewIds.length)];
          p.executionerTarget = target.id;
        }
      }
    }

    // Guardian bond: random other player.
    for (const p of this.players.values()) {
      if (p.role === "GUARDIAN") {
        const others = [...this.players.values()].filter((q) => q.id !== p.id);
        if (others.length) p.bond = { targetId: others[Math.floor(Math.random() * others.length)].id };
      }
    }
  }

  _spawnAll() {
    for (const p of this.players.values()) {
      p.x = this.map.spawnPoint.x + (Math.random() * 60 - 30);
      p.y = this.map.spawnPoint.y + (Math.random() * 60 - 30);
    }
  }

  _assignTasks() {
    for (const p of this.players.values()) {
      const isFake = p.faction !== FACTIONS.CREW;
      const spots = shuffle(this.map.taskSpots).slice(0, Math.min(this.settings.taskCount, this.map.taskSpots.length));
      p.tasks = spots.map((s) => ({ id: s.id, type: s.type, room: s.room, label: s.label, x: s.x, y: s.y, done: false, isFake }));
      if (!isFake) this.taskTotal += p.tasks.length;
    }
  }

  // ---------- lifecycle ----------

  buildStartPayloads() {
    const roster = [...this.players.values()].map((p) => ({ id: p.id, name: p.name, color: p.color, hat: p.hat }));
    const payloads = {};
    for (const p of this.players.values()) {
      const roleMeta = ROLES[p.role];
      payloads[p.id] = {
        map: this.map,
        settings: this.settings,
        roster,
        you: {
          id: p.id, role: p.role, faction: p.faction,
          roleName: roleMeta.name, roleShort: roleMeta.short,
          abilities: roleMeta.abilities,
          tasks: p.tasks,
          executionerTargetName: p.executionerTarget ? this.players.get(p.executionerTarget)?.name : null,
        },
      };
    }
    return payloads;
  }

  destroy() {
    clearInterval(this.tickHandle);
  }

  markDisconnected(id) {
    const p = this.players.get(id);
    if (p) p.connected = false;
    if (this.voiceReady.delete(id)) this._recomputeVoiceGroups();
  }
  markReconnected(id) {
    const p = this.players.get(id);
    if (p) p.connected = true;
  }

  // ---------- voice chat (WebRTC signaling relay) ----------

  handleVoiceReady(id) {
    if (!this.settings.voiceChatEnabled) return { error: "Voice chat is off for this match." };
    const p = this.players.get(id);
    if (!p) return { error: "Not in match." };
    this.voiceReady.add(id);
    this._recomputeVoiceGroups();
    return { ok: true };
  }

  handleVoiceLeave(id) {
    if (this.voiceReady.delete(id)) this._recomputeVoiceGroups();
  }

  // Only relay signaling between players who are supposed to be in the same
  // voice group (both alive, or both ghosts) - prevents a stale/forged peer
  // handshake from crossing the living/dead voice boundary.
  handleVoiceSignal(fromId, toId, data) {
    const a = this.players.get(fromId);
    const b = this.players.get(toId);
    if (!a || !b || a.ghost !== b.ghost) return;
    this.io.to(toId).emit("voice:signal", { from: fromId, data });
  }

  // Full-sync approach: whenever group membership could have changed, tell every
  // voice-ready player in each group who they should currently be connected to.
  // Clients diff this against their own open peer connections and self-heal.
  _recomputeVoiceGroups() {
    if (!this.settings.voiceChatEnabled) return;
    const living = [];
    const ghosts = [];
    for (const p of this.players.values()) {
      if (!this.voiceReady.has(p.id)) continue;
      (p.ghost ? ghosts : living).push(p.id);
    }
    for (const id of living) this.io.to(id).emit("voice:peers", { peers: living.filter((x) => x !== id) });
    for (const id of ghosts) this.io.to(id).emit("voice:peers", { peers: ghosts.filter((x) => x !== id) });
  }

  // ---------- input handlers ----------

  handleInput(id, { dx, dy }) {
    const p = this.players.get(id);
    if (!p || (!p.alive && !p.ghost) || p.ventId) return;
    let mag = Math.hypot(dx, dy);
    if (mag > 1) { dx /= mag; dy /= mag; }
    p.input = { dx: dx || 0, dy: dy || 0 };
  }

  handleVentEnter(id) {
    const p = this.players.get(id);
    if (!p || !p.alive || p.ventId || this.meeting) return { error: "Can't vent right now." };
    const roleMeta = ROLES[p.role];
    if (!roleMeta.abilities.some((a) => a.id === "vent_enter")) return { error: "Your role can't use vents." };
    const vent = this.map.vents.find((v) => {
      const w = this.map.tileToWorld(v.x, v.y);
      return dist(p.x, p.y, w.x, w.y) <= VENT_ENTER_RANGE;
    });
    if (!vent) return { error: "No vent nearby." };
    p.ventId = vent.id;
    p.ventGroup = vent.group;
    const options = this.map.vents.filter((v) => v.group === vent.group && v.id !== vent.id)
      .map((v) => ({ id: v.id, room: v.room }));
    return { ok: true, options };
  }

  handleVentTravel(id, toVentId) {
    const p = this.players.get(id);
    if (!p || !p.ventId) return { error: "Not in a vent." };
    const target = this.map.vents.find((v) => v.id === toVentId && v.group === p.ventGroup);
    if (!target) return { error: "Invalid vent." };
    const w = this.map.tileToWorld(target.x, target.y);
    p.x = w.x; p.y = w.y;
    p.ventId = null; p.ventGroup = null;
    return { ok: true };
  }

  handleVentExit(id) {
    const p = this.players.get(id);
    if (p) { p.ventId = null; p.ventGroup = null; }
    return { ok: true };
  }

  handleUseAbility(id, abilityId, targetId) {
    const p = this.players.get(id);
    if (!p || !p.alive) return { error: "You can't do that right now." };
    if (this.meeting) return { error: "Not during a meeting." };
    const def = abilityDef(p.role, abilityId);
    if (!def) return { error: "Unknown ability." };
    const now = Date.now();
    const readyAt = p.cooldowns[abilityId] || 0;
    if (now < readyAt) return { error: "Ability on cooldown.", remainingMs: readyAt - now };

    const target = targetId ? this.players.get(targetId) : null;
    if (def.rangePx && target && dist(p.x, p.y, target.x, target.y) > def.rangePx) {
      return { error: "Target is too far away." };
    }

    let result = { ok: true };
    switch (abilityId) {
      case "impostor_kill": {
        if (!target || !target.alive || target.id === p.id) return { error: "Invalid target." };
        if (target.faction === FACTIONS.IMPOSTOR) return { error: "Can't target a fellow impostor." };
        this._attemptKill(target, "kill", p.id);
        result.fx = "kill";
        break;
      }
      case "sheriff_shoot": {
        if (!target || !target.alive || target.id === p.id) return { error: "Invalid target." };
        if (target.faction === FACTIONS.IMPOSTOR) {
          this._killPlayer(target, "sheriff", p.id);
          result.fx = "sheriff_hit";
          result.hit = true;
        } else {
          this._killPlayer(p, "sheriff_mistake", p.id);
          result.fx = "sheriff_miss";
          result.hit = false;
        }
        break;
      }
      case "medic_shield": {
        const t = target || p;
        t.effects.shielded = now + def.durationMs;
        result.fx = "shield";
        break;
      }
      case "tracker_place": {
        if (!target || !target.alive || target.id === p.id) return { error: "Invalid target." };
        p.tracking = { targetId: target.id, expiresAt: now + def.durationMs };
        result.fx = "track";
        break;
      }
      case "guardian_bond": {
        if (!target || target.id === p.id) return { error: "Invalid target." };
        p.bond = { targetId: target.id };
        result.fx = "bond";
        break;
      }
      case "forensic_examine": {
        const body = this.bodies.find((b) => !b.cleaned && dist(p.x, p.y, b.x, b.y) <= def.rangePx);
        if (!body) return { error: "No body nearby." };
        const elapsed = now - body.time;
        const timeBucket = elapsed < 15000 ? "very recent" : elapsed < 45000 ? "a little while ago" : "long ago";
        result.data = { cause: body.cause === "poison" ? "poison" : "violence", moved: !!body.moved, timeBucket };
        break;
      }
      case "poisoner_poison": {
        if (!target || !target.alive || target.id === p.id) return { error: "Invalid target." };
        if (target.faction === FACTIONS.IMPOSTOR) return { error: "Can't target a fellow impostor." };
        target.effects.poisoned = { expiresAt: now + def.durationMs, visibleAt: now + def.durationMs - 6000, by: p.id };
        result.fx = "poison";
        break;
      }
      case "janitor_clean": {
        const body = this.bodies.find((b) => !b.cleaned && dist(p.x, p.y, b.x, b.y) <= def.rangePx);
        if (!body) return { error: "No body nearby." };
        body.cleaned = true;
        result.fx = "clean";
        break;
      }
      case "swooper_cloak": {
        p.effects.cloaked = now + def.durationMs;
        result.fx = "cloak";
        break;
      }
      case "arsonist_douse": {
        if (!target || !target.alive || target.id === p.id) return { error: "Invalid target." };
        target.doused = true;
        result.fx = "douse";
        break;
      }
      case "arsonist_ignite": {
        const targets = [...this.players.values()].filter((q) => q.alive && q.doused && q.id !== p.id);
        if (targets.length === 0) return { error: "No one is doused." };
        targets.forEach((t) => this._killPlayer(t, "ignite", p.id));
        const remaining = [...this.players.values()].filter((q) => q.alive && q.id !== p.id);
        if (remaining.length === 0) {
          this._endGame({ faction: "ARSONIST", winners: [p.id], reason: "The Arsonist burned everyone else." });
        }
        result.fx = "ignite";
        break;
      }
      default:
        return { error: "Unhandled ability." };
    }

    if (def.cooldownMs) p.cooldowns[abilityId] = now + def.cooldownMs;
    return result;
  }

  _attemptKill(target, cause, byId) {
    if (target.effects.shielded && target.effects.shielded > Date.now()) {
      target.effects.shielded = null;
      this.timeline.push({ t: Date.now() - this.startedAt, text: `${target.name} was attacked but a shield saved them.` });
      return { blocked: true };
    }
    const guardian = [...this.players.values()].find((g) => g.alive && g.role === "GUARDIAN" && g.bond && g.bond.targetId === target.id);
    if (guardian) {
      this._killPlayer(guardian, cause, byId);
      return { redirected: guardian.id };
    }
    this._killPlayer(target, cause, byId);
    return { killed: target.id };
  }

  _killPlayer(target, cause, byId) {
    if (!target.alive) return;
    target.alive = false;
    target.ghost = true;
    const room = this.map.roomAt(target.x, target.y);
    const body = {
      id: nextId("body"), x: target.x, y: target.y, room: room ? room.name : "the corridor",
      victimId: target.id, victimName: target.name, victimRole: target.role,
      cause, by: byId, time: Date.now(), cleaned: false, moved: false,
    };
    this.bodies.push(body);
    this.timeline.push({ t: Date.now() - this.startedAt, text: `${target.name} was eliminated near ${body.room}.` });
    this._recomputeVoiceGroups();
    this._checkWinConditions();
  }

  handleReportBody(id, bodyId) {
    const p = this.players.get(id);
    if (!p || !p.alive || this.meeting) return { error: "Can't report right now." };
    const body = this.bodies.find((b) => b.id === bodyId && !b.cleaned);
    if (!body) return { error: "No body there." };
    if (dist(p.x, p.y, body.x, body.y) > REPORT_RANGE) return { error: "Too far from the body." };
    this._startMeeting("report", p.id, body.id);
    return { ok: true };
  }

  handleCallMeeting(id) {
    const p = this.players.get(id);
    if (!p || !p.alive || this.meeting) return { error: "Can't call a meeting right now." };
    if (this.sabotages.comms.active) return { error: "Comms are down." };
    const eb = this.map.tileToWorld(this.map.emergencyButton.x, this.map.emergencyButton.y);
    if (dist(p.x, p.y, eb.x, eb.y) > EMERGENCY_RANGE) {
      return { error: "You need to be at the emergency button." };
    }
    const used = this.emergencyUsed[id] || 0;
    if (used >= this.settings.maxEmergencyMeetingsPerPlayer) return { error: "No emergency meetings left." };
    this.emergencyUsed[id] = used + 1;
    this._startMeeting("emergency", p.id, null);
    return { ok: true };
  }

  _startMeeting(reason, callerId, bodyId) {
    if (this.meeting) return;
    const body = bodyId ? this.bodies.find((b) => b.id === bodyId) : null;
    this.meeting = {
      reason, callerId, bodyId, roomName: body ? body.room : "the Atrium",
      phase: "discussion",
      startedAt: Date.now(),
      discussionEndsAt: Date.now() + this.settings.discussionSeconds * 1000,
      votingEndsAt: null,
      votes: new Map(),
      voteOrder: [],
    };
    for (const p of this.players.values()) p.input = { dx: 0, dy: 0 };
    this.timeline.push({
      t: Date.now() - this.startedAt,
      text: reason === "emergency"
        ? `${this.players.get(callerId)?.name} called an emergency meeting.`
        : `${this.players.get(callerId)?.name} reported a body in ${this.meeting.roomName}.`,
    });
    this._broadcast("game:meetingStarted", {
      reason, callerName: this.players.get(callerId)?.name,
      roomName: this.meeting.roomName,
      discussionEndsAt: this.meeting.discussionEndsAt,
      alive: [...this.players.values()].filter((p) => p.alive).map((p) => ({ id: p.id, name: p.name, color: p.color })),
    });
  }

  handleChat(id, text) {
    const p = this.players.get(id);
    if (!p || !this.meeting) return;
    const clean = String(text).slice(0, 240);
    if (!clean.trim()) return;
    if (p.alive) {
      this._broadcast("chat:message", { from: p.name, color: p.color, text: clean, dead: false });
    } else {
      this._broadcastToGhosts("chat:message", { from: p.name, color: p.color, text: clean, dead: true });
    }
  }

  handleVote(id, targetId) {
    const p = this.players.get(id);
    if (!p || !p.alive || !this.meeting || this.meeting.phase !== "voting") return { error: "Can't vote right now." };
    if (!this.meeting.votes.has(id)) this.meeting.voteOrder.push(id);
    this.meeting.votes.set(id, targetId || null);
    this._broadcast("game:voteCast", { voterId: id, votedCount: this.meeting.votes.size });
    return { ok: true };
  }

  handleSabotage(id, type) {
    const p = this.players.get(id);
    if (!p || !p.alive || p.faction !== FACTIONS.IMPOSTOR) return { error: "Not available." };
    const now = Date.now();
    if (now < this.nextSabotageAt) return { error: "Sabotage is cooling down." };
    if (!this.sabotages[type] || this.sabotages[type].active) return { error: "Invalid sabotage." };
    if (type === "reactor") this.sabotages.reactor = { active: true, expiresAt: now + REACTOR_TIME_MS, panelsFixed: new Set() };
    else if (type === "o2") this.sabotages.o2 = { active: true, expiresAt: now + O2_TIME_MS, panelsFixed: new Set() };
    else if (type === "lights") this.sabotages.lights = { active: true };
    else if (type === "comms") this.sabotages.comms = { active: true, expiresAt: now + COMMS_TIME_MS };
    this.nextSabotageAt = now + SABOTAGE_GLOBAL_COOLDOWN_MS;
    this.timeline.push({ t: now - this.startedAt, text: `Sabotage: ${type} triggered.` });
    this._broadcast("game:sabotageStarted", { type, expiresAt: this.sabotages[type].expiresAt || null });
    return { ok: true };
  }

  handleSabotageFix(id, panelId) {
    const p = this.players.get(id);
    if (!p || !p.alive) return { error: "Not available." };
    const panel = this.map.sabotagePanels.find((x) => x.id === panelId);
    if (!panel) return { error: "Invalid panel." };
    const pw = this.map.tileToWorld(panel.x, panel.y);
    if (dist(p.x, p.y, pw.x, pw.y) > SABOTAGE_FIX_RANGE) return { error: "Too far from panel." };
    const sab = this.sabotages[panel.type];
    if (!sab || !sab.active) return { error: "Nothing to fix." };
    if (panel.type === "reactor" || panel.type === "o2") {
      sab.panelsFixed.add(panelId);
      const required = this.map.sabotagePanels.filter((x) => x.type === panel.type).length;
      if (sab.panelsFixed.size >= required) sab.active = false;
    } else {
      sab.active = false;
    }
    if (!sab.active) {
      this.timeline.push({ t: Date.now() - this.startedAt, text: `Sabotage: ${panel.type} fixed.` });
      this._broadcast("game:sabotageFixed", { type: panel.type });
    }
    return { ok: true };
  }

  handleTaskComplete(id, taskId, success) {
    const p = this.players.get(id);
    if (!p || (!p.alive && !p.ghost)) return { error: "Not available." };
    const task = p.tasks.find((t) => t.id === taskId && !t.done);
    if (!task) return { error: "Task not found." };
    if (success) {
      task.done = true;
      if (!task.isFake) {
        this.taskDone++;
        this._checkWinConditions();
      }
    }
    return { ok: true };
  }

  // ---------- tick ----------

  _tick() {
    if (this.ended) return;
    const now = Date.now();
    const dt = TICK_MS / 1000;
    const speed = BASE_SPEED * (this.settings.movementSpeed || 1);

    if (!this.meeting) {
      for (const p of this.players.values()) {
        if ((!p.alive && !p.ghost) || p.ventId) continue;
        const { dx, dy } = p.input;
        if (!dx && !dy) continue;
        const nx = p.x + dx * speed * dt;
        const ny = p.y + dy * speed * dt;
        if (p.ghost) {
          p.x = Math.max(20, Math.min(this.map.gridW * this.map.tile - 20, nx));
          p.y = Math.max(20, Math.min(this.map.gridH * this.map.tile - 20, ny));
        } else {
          if (this.map.isWalkableWorld(nx, p.y)) p.x = nx;
          if (this.map.isWalkableWorld(p.x, ny)) p.y = ny;
        }
      }
    }

    // sabotage critical failure
    if (this.sabotages.reactor.active && now > this.sabotages.reactor.expiresAt) {
      this._endGame({ faction: "IMPOSTOR", reason: "Reactor meltdown - crew failed to fix it in time." });
    } else if (this.sabotages.o2.active && now > this.sabotages.o2.expiresAt) {
      this._endGame({ faction: "IMPOSTOR", reason: "Oxygen depleted - crew failed to fix it in time." });
    }
    if (this.sabotages.comms.active && this.sabotages.comms.expiresAt && now > this.sabotages.comms.expiresAt) {
      this.sabotages.comms.active = false;
    }

    // meeting phase transitions
    if (this.meeting) {
      if (this.meeting.phase === "discussion" && now >= this.meeting.discussionEndsAt) {
        this.meeting.phase = "voting";
        this.meeting.votingEndsAt = now + this.settings.votingSeconds * 1000;
        this._broadcast("game:votingStarted", { votingEndsAt: this.meeting.votingEndsAt });
      } else if (this.meeting.phase === "voting" && now >= this.meeting.votingEndsAt) {
        this._resolveVotes();
      }
    }

    if (this.ended) return;
    this._broadcastState();

    this._tickCount = (this._tickCount || 0) + 1;
    if (this._tickCount % REPLAY_FRAME_EVERY_N_TICKS === 0) this._recordReplayFrame();
  }

  // Post-match replay: a low-rate positional recording (not the live 20Hz tick), reusing
  // the same event timeline for the scrub-through UI's event list. Session-only, in memory.
  _recordReplayFrame() {
    this.replayFrames.push({
      t: Date.now() - this.startedAt,
      players: [...this.players.values()].map((p) => ({
        id: p.id, name: p.name, color: p.color, hat: p.hat,
        x: Math.round(p.x), y: Math.round(p.y), alive: p.alive, ghost: p.ghost,
      })),
      bodies: this.bodies.filter((b) => !b.cleaned).map((b) => ({ id: b.id, x: Math.round(b.x), y: Math.round(b.y) })),
      sabotages: {
        reactor: this.sabotages.reactor.active, o2: this.sabotages.o2.active,
        lights: this.sabotages.lights.active, comms: this.sabotages.comms.active,
      },
    });
  }

  _resolveVotes() {
    const tally = new Map();
    const detail = [];
    for (const [voterId, targetId] of this.meeting.votes.entries()) {
      const key = targetId || "skip";
      tally.set(key, (tally.get(key) || 0) + 1);
      detail.push({ voterName: this.players.get(voterId)?.name || "?", targetName: targetId ? this.players.get(targetId)?.name : "Skip" });
    }
    // Anyone alive who never voted counts as a skip for tally purposes but not in the reveal list.
    let ejectedId = null;
    let topCount = -1;
    let tie = false;
    for (const [key, count] of tally.entries()) {
      if (count > topCount) { topCount = count; ejectedId = key; tie = false; }
      else if (count === topCount) tie = true;
    }
    if (tie || !ejectedId || ejectedId === "skip") ejectedId = null;

    let revealText = null;
    let ejectedName = null;
    let specialEnd = null;

    if (ejectedId) {
      const ejected = this.players.get(ejectedId);
      ejectedName = ejected.name;
      ejected.alive = false;
      ejected.ghost = true;
      this._recomputeVoiceGroups();
      const roleMeta = ROLES[ejected.role];
      revealText = this.settings.confirmEjects
        ? `${ejected.name} was the ${roleMeta.name}.`
        : `${ejected.name} was ${ejected.faction === FACTIONS.IMPOSTOR ? "an Impostor" : "not an Impostor"}.`;
      this.timeline.push({ t: Date.now() - this.startedAt, text: `${ejected.name} was ejected (${roleMeta.name}).` });

      if (ejected.role === "JESTER") {
        specialEnd = { faction: "JESTER", winners: [ejected.id], reason: `${ejected.name} (the Jester) got voted out.` };
      } else {
        const executioner = [...this.players.values()].find((q) => q.role === "EXECUTIONER" && q.alive && q.executionerTarget === ejected.id);
        if (executioner) {
          specialEnd = { faction: "EXECUTIONER", winners: [executioner.id], reason: `${executioner.name} (the Executioner) got their target ejected.` };
        }
      }
    } else {
      this.timeline.push({ t: Date.now() - this.startedAt, text: `No one was ejected.` });
    }

    this._broadcast("game:meetingResult", {
      ejectedId, ejectedName, revealText, tally: [...tally.entries()], detail,
    });
    this.meeting = null;

    if (specialEnd) { this._endGame(specialEnd); return; }
    this._checkWinConditions();
  }

  _checkWinConditions() {
    if (this.ended) return;
    const all = [...this.players.values()];
    const aliveImpostors = all.filter((p) => p.alive && p.faction === FACTIONS.IMPOSTOR);
    const aliveOthers = all.filter((p) => p.alive && p.faction !== FACTIONS.IMPOSTOR);

    if (aliveImpostors.length === 0) {
      this._endGame({ faction: "CREW", reason: "All impostors were eliminated." });
    } else if (aliveImpostors.length >= aliveOthers.length) {
      this._endGame({ faction: "IMPOSTOR", winners: aliveImpostors.map((p) => p.id), reason: "The impostors reached parity." });
    } else if (this.taskTotal > 0 && this.taskDone >= this.taskTotal) {
      this._endGame({ faction: "CREW", reason: "The crew completed every task." });
    }
  }

  _endGame(result) {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.tickHandle);

    let winners = result.winners ? [...result.winners] : [];
    if (!result.winners) {
      winners = [...this.players.values()].filter((p) => {
        if (result.faction === "CREW") return p.faction === FACTIONS.CREW;
        if (result.faction === "IMPOSTOR") return p.faction === FACTIONS.IMPOSTOR;
        return false;
      }).map((p) => p.id);
    }
    // Survivors bolt on to whatever the outcome was.
    for (const p of this.players.values()) {
      if (p.role === "SURVIVOR" && p.alive && !winners.includes(p.id)) winners.push(p.id);
    }

    const roster = [...this.players.values()].map((p) => ({
      id: p.id, name: p.name, role: p.role, roleName: ROLES[p.role].name,
      faction: p.faction, alive: p.alive, won: winners.includes(p.id),
    }));

    this._broadcast("game:over", {
      faction: result.faction, reason: result.reason, winners, roster,
      timeline: this.timeline, replayFrames: this.replayFrames,
    });

    // Record progression server-side per account (not client-trusted).
    for (const p of this.players.values()) {
      if (!p.accountId) continue;
      const newly = Accounts.recordMatchResult(p.accountId, {
        won: winners.includes(p.id), faction: p.faction, role: p.role,
      });
      const account = Accounts.getAccount(p.accountId);
      this.io.to(p.id).emit("account:matchResult", {
        newlyUnlocked: newly,
        account: Accounts.publicView(account),
      });
    }

    this.onEnded && this.onEnded();
  }

  // ---------- state broadcast ----------

  _broadcast(event, payload) {
    this.io.to(this.code).emit(event, payload);
  }
  _broadcastToGhosts(event, payload) {
    for (const p of this.players.values()) {
      if (p.ghost) this.io.to(p.id).emit(event, payload);
    }
  }

  _broadcastState() {
    for (const viewer of this.players.values()) {
      this.io.to(viewer.id).emit("game:state", this._snapshotFor(viewer));
    }
  }

  _snapshotFor(viewer) {
    const now = Date.now();
    const players = [];
    for (const p of this.players.values()) {
      if (p.id === viewer.id) {
        players.push(this._selfView(p, now));
        continue;
      }
      if (p.ghost) {
        if (viewer.ghost) players.push({ id: p.id, name: p.name, color: p.color, hat: p.hat, x: p.x, y: p.y, ghost: true });
        continue;
      }
      if (p.ventId) continue; // hidden while inside vent tunnels
      const cloaked = p.effects.cloaked && p.effects.cloaked > now;
      if (cloaked && viewer.faction !== FACTIONS.IMPOSTOR) continue;
      const poison = p.effects.poisoned;
      const isSick = !!(poison && poison.visibleAt <= now && poison.expiresAt > now);
      const sickIntensity = isSick
        ? Math.min(1, Math.max(0, (now - poison.visibleAt) / (poison.expiresAt - poison.visibleAt)))
        : 0;
      players.push({
        id: p.id, name: p.name, color: p.color, hat: p.hat, x: p.x, y: p.y, ghost: false,
        cloaked: !!cloaked,
        sick: isSick, sickIntensity,
        doused: viewer.id === p.id ? p.doused : (viewer.role === "ARSONIST" ? p.doused : undefined),
      });
    }

    let tracking = null;
    if (viewer.tracking && viewer.tracking.expiresAt > now) {
      const t = this.players.get(viewer.tracking.targetId);
      if (t && t.alive) {
        const r = this.map.roomAt(t.x, t.y);
        tracking = { targetName: t.name, room: r ? r.name : "unknown" };
      }
    } else if (viewer.tracking) {
      viewer.tracking = null;
    }

    return {
      t: now,
      players,
      bodies: this.bodies.filter((b) => !b.cleaned).map((b) => ({ id: b.id, x: b.x, y: b.y, room: b.room })),
      sabotages: {
        reactor: { active: this.sabotages.reactor.active, expiresAt: this.sabotages.reactor.expiresAt || null },
        o2: { active: this.sabotages.o2.active, expiresAt: this.sabotages.o2.expiresAt || null },
        lights: { active: this.sabotages.lights.active },
        comms: { active: this.sabotages.comms.active },
      },
      taskProgress: this.sabotages.comms.active ? null : { done: this.taskDone, total: this.taskTotal },
      tracking,
      cooldowns: viewer.cooldowns,
      effects: {
        shieldedUntil: viewer.effects.shielded || null,
        cloakedUntil: viewer.effects.cloaked || null,
        poisonedUntil: viewer.effects.poisoned ? viewer.effects.poisoned.expiresAt : null,
      },
      canCallEmergency: !this.meeting && !this.sabotages.comms.active && (this.emergencyUsed[viewer.id] || 0) < this.settings.maxEmergencyMeetingsPerPlayer,
      sabotageReady: Date.now() >= this.nextSabotageAt,
    };
  }

  _selfView(p, now) {
    return {
      id: p.id, name: p.name, color: p.color, hat: p.hat, x: p.x, y: p.y,
      alive: p.alive, ghost: p.ghost, inVent: !!p.ventId,
      cloaked: !!(p.effects.cloaked && p.effects.cloaked > now),
    };
  }
}
