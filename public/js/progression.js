// Lightweight, per-browser progression: no accounts/backend, just localStorage.
// This is deliberately NOT a full economy/unlocks system (see README roadmap) -
// it's stats + a handful of achievements to make matches feel like they add up.
const STORAGE_KEY = "aphelion_stats_v1";

const ACHIEVEMENTS = [
  { id: "first_match", name: "First Contact", test: (s) => s.gamesPlayed >= 1 },
  { id: "first_win", name: "First Win", test: (s) => s.gamesWon >= 1 },
  { id: "dedicated", name: "Dedicated", test: (s) => s.gamesPlayed >= 10 },
  { id: "crew_hero", name: "Crewmate of the Month", test: (s) => (s.roleWins.CREW_FACTION || 0) >= 5 },
  { id: "master_of_disguise", name: "Master of Disguise", test: (s) => (s.roleWins.IMPOSTOR_FACTION || 0) >= 1 },
  { id: "sole_survivor", name: "Sole Survivor", test: (s) => (s.roleWins.SURVIVOR || 0) >= 1 },
  { id: "clown_prince", name: "Clown Prince", test: (s) => (s.roleWins.JESTER || 0) >= 1 },
  { id: "arsonist_win", name: "Burn It Down", test: (s) => (s.roleWins.ARSONIST || 0) >= 1 },
];

const Progression = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* private mode / blocked storage - fall through to defaults */ }
    return { gamesPlayed: 0, gamesWon: 0, roleWins: {}, achievements: [] };
  },

  save(stats) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stats)); } catch (e) { /* ignore */ }
  },

  renderMenuStats() {
    const stats = this.load();
    const el = document.getElementById("menu-stats");
    if (!el) return;
    el.textContent = stats.gamesPlayed > 0
      ? `Games played: ${stats.gamesPlayed} · Wins: ${stats.gamesWon}`
      : "";
  },

  // Called once per finished match. Returns newly-unlocked achievement names.
  recordMatchEnd({ won, faction, role }) {
    const stats = this.load();
    stats.gamesPlayed++;
    if (won) {
      stats.gamesWon++;
      const key = (faction === "CREW" || faction === "IMPOSTOR") ? `${faction}_FACTION` : role;
      stats.roleWins[key] = (stats.roleWins[key] || 0) + 1;
    }

    const newly = [];
    for (const ach of ACHIEVEMENTS) {
      if (stats.achievements.includes(ach.id)) continue;
      if (ach.test(stats)) {
        stats.achievements.push(ach.id);
        newly.push(ach.name);
      }
    }

    this.save(stats);
    return newly;
  },

  renderEndAchievements(newlyUnlocked) {
    const el = document.getElementById("end-achievements");
    if (!el) return;
    el.innerHTML = "";
    if (!newlyUnlocked || newlyUnlocked.length === 0) return;
    const label = document.createElement("div");
    label.className = "hint";
    label.textContent = "Achievement unlocked:";
    el.appendChild(label);
    for (const name of newlyUnlocked) {
      const badge = document.createElement("span");
      badge.className = "achievement-badge";
      badge.textContent = name;
      el.appendChild(badge);
    }
  },
};
