import { customAlphabet } from "nanoid";
import { DEFAULT_SETTINGS, mergeSettings } from "./presets.js";

const genCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 20;

export class Room {
  constructor(code, hostId) {
    this.code = code;
    this.hostId = hostId;
    this.players = new Map(); // id -> {id, name, ready}
    this.settings = { ...DEFAULT_SETTINGS };
    this.phase = "LOBBY"; // LOBBY | GAME
    this.game = null;
    this.isPublic = false;
  }

  publicState() {
    return {
      code: this.code,
      hostId: this.hostId,
      phase: this.phase,
      settings: this.settings,
      players: [...this.players.values()].map((p) => ({ id: p.id, name: p.name, ready: p.ready })),
    };
  }

  applySettings(overrides) {
    this.settings = mergeSettings(this.settings, overrides);
  }
}

export class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  create(hostId, hostName, accountId) {
    let code;
    do { code = genCode(); } while (this.rooms.has(code));
    const room = new Room(code, hostId);
    room.players.set(hostId, { id: hostId, name: hostName.slice(0, 16) || "Host", ready: false, accountId: accountId || null });
    this.rooms.set(code, room);
    return room;
  }

  get(code) {
    return this.rooms.get((code || "").toUpperCase());
  }

  join(code, id, name, accountId) {
    const room = this.get(code);
    if (!room) return { error: "Room not found." };
    if (room.phase !== "LOBBY") return { error: "That match already started." };
    if (room.players.size >= MAX_PLAYERS) return { error: "Room is full." };
    room.players.set(id, { id, name: (name || "Player").slice(0, 16), ready: false, accountId: accountId || null });
    return { room };
  }

  // Quick Play: join an existing open public lobby, or start a new one.
  quickPlay(id, name, accountId) {
    let room = [...this.rooms.values()].find((r) => r.isPublic && r.phase === "LOBBY" && r.players.size < MAX_PLAYERS);
    if (!room) {
      room = this.create(id, name, accountId);
      room.isPublic = true;
      return { room, isHost: true };
    }
    const res = this.join(room.code, id, name, accountId);
    return { room: res.room, isHost: false };
  }

  leave(code, id) {
    const room = this.get(code);
    if (!room) return;
    room.players.delete(id);
    if (room.game) room.game.markDisconnected(id);
    if (room.players.size === 0) {
      if (room.game) room.game.destroy();
      this.rooms.delete(room.code);
      return null;
    }
    if (room.hostId === id) {
      room.hostId = [...room.players.keys()][0];
    }
    return room;
  }

  findRoomOf(id) {
    for (const room of this.rooms.values()) {
      if (room.players.has(id)) return room;
    }
    return null;
  }
}
