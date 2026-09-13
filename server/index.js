import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

import { RoomManager, MIN_PLAYERS, MAX_PLAYERS } from "./rooms.js";
import { PRESETS } from "./presets.js";
import { Game } from "./Game.js";
import * as Accounts from "./accounts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, "..", "public")));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const rooms = new RoomManager();

function broadcastLobby(room) {
  io.to(room.code).emit("lobby:state", room.publicState());
}

// ---------- accounts: online presence + friend status ----------

const onlineAccounts = new Map(); // accountId -> Set<socketId>

function markOnline(accountId, socketId) {
  if (!onlineAccounts.has(accountId)) onlineAccounts.set(accountId, new Set());
  onlineAccounts.get(accountId).add(socketId);
}
function markOffline(accountId, socketId) {
  const set = onlineAccounts.get(accountId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) onlineAccounts.delete(accountId);
}
function isOnline(accountId) {
  return onlineAccounts.has(accountId);
}
function notifyFriendsStatus(accountId, online) {
  const account = Accounts.getAccount(accountId);
  if (!account) return;
  for (const friendId of account.friends) {
    const sockets = onlineAccounts.get(friendId);
    if (!sockets) continue;
    for (const sid of sockets) io.to(sid).emit("account:friendStatus", { id: accountId, online });
  }
}
function sendAccountState(socket) {
  if (!socket.accountId) return;
  const view = Accounts.publicView(Accounts.getAccount(socket.accountId));
  if (!view) return;
  view.friends = view.friends.map((f) => ({ ...f, online: isOnline(f.id) }));
  socket.emit("account:state", { account: view });
}

io.on("connection", (socket) => {
  socket.on("account:register", ({ username } = {}) => {
    const res = Accounts.register(username);
    if (res.error) return socket.emit("account:error", { message: res.error });
    socket.accountId = res.account.id;
    markOnline(socket.accountId, socket.id);
    socket.emit("account:registered", { deviceToken: res.account.deviceToken });
    sendAccountState(socket);
    notifyFriendsStatus(socket.accountId, true);
  });

  socket.on("account:login", ({ deviceToken } = {}) => {
    const res = Accounts.login(deviceToken);
    if (res.error) return socket.emit("account:error", { message: res.error });
    socket.accountId = res.account.id;
    markOnline(socket.accountId, socket.id);
    sendAccountState(socket);
    notifyFriendsStatus(socket.accountId, true);
  });

  socket.on("account:rename", ({ username } = {}, cb) => {
    if (!socket.accountId) return cb && cb({ error: "Not logged in." });
    const res = Accounts.renameAccount(socket.accountId, username);
    if (res.error) return cb && cb({ error: res.error });
    sendAccountState(socket);
    cb && cb({ ok: true });
  });

  socket.on("account:addFriend", ({ username } = {}, cb) => {
    if (!socket.accountId) return cb && cb({ error: "Not logged in." });
    const res = Accounts.addFriend(socket.accountId, username);
    if (res.error) return cb && cb({ error: res.error });
    sendAccountState(socket);
    const friendSockets = onlineAccounts.get(res.friend.id);
    if (friendSockets) for (const sid of friendSockets) { const s = io.sockets.sockets.get(sid); if (s) sendAccountState(s); }
    cb && cb({ ok: true });
  });

  socket.on("account:removeFriend", ({ friendId } = {}, cb) => {
    if (!socket.accountId) return cb && cb({ error: "Not logged in." });
    Accounts.removeFriend(socket.accountId, friendId);
    sendAccountState(socket);
    cb && cb({ ok: true });
  });

  socket.on("account:setCosmetics", ({ hat, color } = {}, cb) => {
    if (!socket.accountId) return cb && cb({ error: "Not logged in." });
    const res = Accounts.setCosmetics(socket.accountId, { hat, color });
    if (res.error) return cb && cb({ error: res.error });
    sendAccountState(socket);
    cb && cb({ ok: true });
  });

  socket.on("lobby:create", ({ name } = {}) => {
    const room = rooms.create(socket.id, name || "Host", socket.accountId);
    socket.join(room.code);
    socket.emit("lobby:created", { code: room.code });
    broadcastLobby(room);
  });

  socket.on("lobby:join", ({ code, name } = {}) => {
    const result = rooms.join(code, socket.id, name, socket.accountId);
    if (result.error) return socket.emit("error:lobby", { message: result.error });
    socket.join(result.room.code);
    socket.emit("lobby:joined", { code: result.room.code });
    broadcastLobby(result.room);
  });

  socket.on("lobby:quickPlay", ({ name } = {}) => {
    const result = rooms.quickPlay(socket.id, name || "Player", socket.accountId);
    socket.join(result.room.code);
    socket.emit(result.isHost ? "lobby:created" : "lobby:joined", { code: result.room.code });
    broadcastLobby(result.room);
  });

  socket.on("lobby:toggleReady", () => {
    const room = rooms.findRoomOf(socket.id);
    if (!room || room.phase !== "LOBBY") return;
    const p = room.players.get(socket.id);
    if (p) p.ready = !p.ready;
    broadcastLobby(room);
  });

  socket.on("lobby:updateSettings", (overrides = {}) => {
    const room = rooms.findRoomOf(socket.id);
    if (!room || room.hostId !== socket.id || room.phase !== "LOBBY") return;
    room.applySettings(overrides);
    broadcastLobby(room);
  });

  socket.on("lobby:applyPreset", (presetName) => {
    const room = rooms.findRoomOf(socket.id);
    if (!room || room.hostId !== socket.id || room.phase !== "LOBBY") return;
    const preset = PRESETS[presetName];
    if (!preset) return;
    room.applySettings(preset);
    broadcastLobby(room);
  });

  socket.on("lobby:start", () => {
    const room = rooms.findRoomOf(socket.id);
    if (!room || room.hostId !== socket.id || room.phase !== "LOBBY") return;
    if (room.players.size < MIN_PLAYERS) {
      return socket.emit("error:lobby", { message: `Need at least ${MIN_PLAYERS} players (max ${MAX_PLAYERS}).` });
    }
    room.phase = "GAME";
    const playerList = [...room.players.values()].map((p) => {
      const account = p.accountId ? Accounts.getAccount(p.accountId) : null;
      return { ...p, preferredColor: account?.preferredColor || null, equippedHat: account?.equippedHat || null };
    });
    room.game = new Game({
      code: room.code,
      players: playerList,
      settings: room.settings,
      io,
      onEnded: () => {
        room.phase = "LOBBY";
        for (const p of room.players.values()) p.ready = false;
        room.game = null;
        broadcastLobby(room);
      },
    });
    const payloads = room.game.buildStartPayloads();
    for (const [id, payload] of Object.entries(payloads)) {
      io.to(id).emit("game:start", payload);
    }
  });

  socket.on("lobby:leave", () => {
    const room = rooms.findRoomOf(socket.id);
    if (!room) return;
    socket.leave(room.code);
    const updated = rooms.leave(room.code, socket.id);
    if (updated) broadcastLobby(updated);
  });

  // ---------- in-game events ----------

  const withGame = (fn) => (...args) => {
    const room = rooms.findRoomOf(socket.id);
    if (!room || !room.game) return;
    fn(room, room.game, ...args);
  };

  socket.on("player:input", withGame((room, game, input) => game.handleInput(socket.id, input || {})));

  socket.on("player:useAbility", withGame((room, game, { abilityId, targetId } = {}, cb) => {
    const res = game.handleUseAbility(socket.id, abilityId, targetId);
    if (typeof cb === "function") cb(res);
  }));

  socket.on("player:ventEnter", withGame((room, game, _payload, cb) => {
    const res = game.handleVentEnter(socket.id);
    if (typeof cb === "function") cb(res);
  }));
  socket.on("player:ventTravel", withGame((room, game, { toVentId } = {}, cb) => {
    const res = game.handleVentTravel(socket.id, toVentId);
    if (typeof cb === "function") cb(res);
  }));
  socket.on("player:ventExit", withGame((room, game, _payload, cb) => {
    const res = game.handleVentExit(socket.id);
    if (typeof cb === "function") cb(res);
  }));

  socket.on("player:reportBody", withGame((room, game, { bodyId } = {}, cb) => {
    const res = game.handleReportBody(socket.id, bodyId);
    if (typeof cb === "function") cb(res);
  }));

  socket.on("voice:ready", withGame((room, game, _payload, cb) => {
    const res = game.handleVoiceReady(socket.id);
    if (typeof cb === "function") cb(res);
  }));
  socket.on("voice:leave", withGame((room, game) => game.handleVoiceLeave(socket.id)));
  socket.on("voice:signal", withGame((room, game, { to, data } = {}) => game.handleVoiceSignal(socket.id, to, data)));

  socket.on("player:callMeeting", withGame((room, game, _payload, cb) => {
    const res = game.handleCallMeeting(socket.id);
    if (typeof cb === "function") cb(res);
  }));

  socket.on("player:vote", withGame((room, game, { targetId } = {}, cb) => {
    const res = game.handleVote(socket.id, targetId);
    if (typeof cb === "function") cb(res);
  }));

  socket.on("chat:send", withGame((room, game, { text } = {}) => game.handleChat(socket.id, text)));

  socket.on("player:completeTask", withGame((room, game, { taskId, success } = {}, cb) => {
    const res = game.handleTaskComplete(socket.id, taskId, success !== false);
    if (typeof cb === "function") cb(res);
  }));

  socket.on("sabotage:trigger", withGame((room, game, { type } = {}, cb) => {
    const res = game.handleSabotage(socket.id, type);
    if (typeof cb === "function") cb(res);
  }));
  socket.on("sabotage:fix", withGame((room, game, { panelId } = {}, cb) => {
    const res = game.handleSabotageFix(socket.id, panelId);
    if (typeof cb === "function") cb(res);
  }));

  socket.on("disconnect", () => {
    if (socket.accountId) {
      markOffline(socket.accountId, socket.id);
      if (!isOnline(socket.accountId)) notifyFriendsStatus(socket.accountId, false);
    }
    const room = rooms.findRoomOf(socket.id);
    if (!room) return;
    if (room.phase === "GAME" && room.game) {
      room.game.markDisconnected(socket.id);
      return;
    }
    const updated = rooms.leave(room.code, socket.id);
    if (updated) broadcastLobby(updated);
  });
});

server.listen(PORT, () => {
  console.log(`Crewline server listening on http://localhost:${PORT}`);
});
