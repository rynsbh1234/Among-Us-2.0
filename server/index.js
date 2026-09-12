import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

import { RoomManager, MIN_PLAYERS, MAX_PLAYERS } from "./rooms.js";
import { PRESETS } from "./presets.js";
import { Game } from "./Game.js";

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

io.on("connection", (socket) => {
  socket.on("lobby:create", ({ name } = {}) => {
    const room = rooms.create(socket.id, name || "Host");
    socket.join(room.code);
    socket.emit("lobby:created", { code: room.code });
    broadcastLobby(room);
  });

  socket.on("lobby:join", ({ code, name } = {}) => {
    const result = rooms.join(code, socket.id, name);
    if (result.error) return socket.emit("error:lobby", { message: result.error });
    socket.join(result.room.code);
    socket.emit("lobby:joined", { code: result.room.code });
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
    const playerList = [...room.players.values()];
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
  console.log(`Aphelion Station server listening on http://localhost:${PORT}`);
});
