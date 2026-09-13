import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { hatsUnlockedFor } from "./cosmetics.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "accounts.json");

// Server-side (not client-trusted) achievement catalog - this is what actually
// gets recorded, unlike the earlier localStorage-only version.
export const ACHIEVEMENTS = [
  { id: "first_match", name: "First Contact", test: (s) => s.gamesPlayed >= 1 },
  { id: "first_win", name: "First Win", test: (s) => s.gamesWon >= 1 },
  { id: "dedicated", name: "Dedicated", test: (s) => s.gamesPlayed >= 10 },
  { id: "crew_hero", name: "Crewmate of the Month", test: (s) => (s.roleWins.CREW_FACTION || 0) >= 5 },
  { id: "master_of_disguise", name: "Master of Disguise", test: (s) => (s.roleWins.IMPOSTOR_FACTION || 0) >= 1 },
  { id: "sole_survivor", name: "Sole Survivor", test: (s) => (s.roleWins.SURVIVOR || 0) >= 1 },
  { id: "clown_prince", name: "Clown Prince", test: (s) => (s.roleWins.JESTER || 0) >= 1 },
  { id: "arsonist_win", name: "Burn It Down", test: (s) => (s.roleWins.ARSONIST || 0) >= 1 },
];

let db = { accounts: {}, usernameIndex: {} };

function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    db = JSON.parse(raw);
    if (!db.accounts) db.accounts = {};
    if (!db.usernameIndex) db.usernameIndex = {};
  } catch {
    db = { accounts: {}, usernameIndex: {} };
  }
}

let saveScheduled = false;
function save() {
  if (saveScheduled) return;
  saveScheduled = true;
  setTimeout(() => {
    saveScheduled = false;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
      console.error("Failed to save accounts.json:", e.message);
    }
  }, 250);
}

load();

function normalize(username) {
  return String(username || "").trim().slice(0, 20);
}

function newAccount(username) {
  const id = crypto.randomUUID();
  const deviceToken = crypto.randomUUID();
  const account = {
    id, username, deviceToken, createdAt: Date.now(),
    stats: { gamesPlayed: 0, gamesWon: 0, roleWins: {} },
    achievements: [],
    equippedHat: null,
    preferredColor: null,
    friends: [],
  };
  db.accounts[id] = account;
  db.usernameIndex[username.toLowerCase()] = id;
  save();
  return account;
}

export function register(username) {
  const name = normalize(username);
  if (!name) return { error: "Enter a username." };
  if (db.usernameIndex[name.toLowerCase()]) return { error: "That username is taken." };
  const account = newAccount(name);
  return { account };
}

export function login(deviceToken) {
  const account = Object.values(db.accounts).find((a) => a.deviceToken === deviceToken);
  if (!account) return { error: "Unknown device token." };
  return { account };
}

export function getAccount(id) {
  return db.accounts[id] || null;
}

export function renameAccount(id, newUsername) {
  const account = db.accounts[id];
  if (!account) return { error: "No account." };
  const name = normalize(newUsername);
  if (!name) return { error: "Enter a username." };
  const taken = db.usernameIndex[name.toLowerCase()];
  if (taken && taken !== id) return { error: "That username is taken." };
  delete db.usernameIndex[account.username.toLowerCase()];
  account.username = name;
  db.usernameIndex[name.toLowerCase()] = id;
  save();
  return { account };
}

export function findByUsername(username) {
  const id = db.usernameIndex[normalize(username).toLowerCase()];
  return id ? db.accounts[id] : null;
}

export function addFriend(id, friendUsername) {
  const account = db.accounts[id];
  const friend = findByUsername(friendUsername);
  if (!account) return { error: "No account." };
  if (!friend) return { error: "No player with that username." };
  if (friend.id === id) return { error: "That's you." };
  if (!account.friends.includes(friend.id)) account.friends.push(friend.id);
  if (!friend.friends.includes(id)) friend.friends.push(id);
  save();
  return { account, friend };
}

export function removeFriend(id, friendId) {
  const account = db.accounts[id];
  const friend = db.accounts[friendId];
  if (!account) return { error: "No account." };
  account.friends = account.friends.filter((f) => f !== friendId);
  if (friend) friend.friends = friend.friends.filter((f) => f !== id);
  save();
  return { account };
}

export function setCosmetics(id, { hat, color }) {
  const account = db.accounts[id];
  if (!account) return { error: "No account." };
  const unlockedHats = hatsUnlockedFor(account.achievements);
  if (hat !== undefined) {
    account.equippedHat = hat === null || unlockedHats.includes(hat) ? hat : account.equippedHat;
  }
  if (color !== undefined) account.preferredColor = color;
  save();
  return { account };
}

// Called by Game.js at match end. Returns names of newly-unlocked achievements.
export function recordMatchResult(id, { won, faction, role }) {
  const account = db.accounts[id];
  if (!account) return [];
  account.stats.gamesPlayed++;
  if (won) {
    account.stats.gamesWon++;
    const key = (faction === "CREW" || faction === "IMPOSTOR") ? `${faction}_FACTION` : role;
    account.stats.roleWins[key] = (account.stats.roleWins[key] || 0) + 1;
  }
  const newly = [];
  for (const ach of ACHIEVEMENTS) {
    if (account.achievements.includes(ach.id)) continue;
    if (ach.test(account.stats)) {
      account.achievements.push(ach.id);
      newly.push(ach.name);
    }
  }
  save();
  return newly;
}

export function publicView(account, viewerId) {
  if (!account) return null;
  return {
    id: account.id,
    username: account.username,
    stats: account.stats,
    achievements: account.achievements,
    unlockedHats: hatsUnlockedFor(account.achievements),
    equippedHat: account.equippedHat,
    preferredColor: account.preferredColor,
    friends: account.friends.map((fid) => {
      const f = db.accounts[fid];
      return f ? { id: f.id, username: f.username } : null;
    }).filter(Boolean),
  };
}
