// Cosmetics are purely visual (a hat shape drawn above the player token, or a
// preferred token color) - zero gameplay effect, unlocked by achievements
// rather than purchased. See ACHIEVEMENTS in accounts.js for the source of truth
// on what's unlocked; this file just maps each achievement to what it grants.
export const ACHIEVEMENT_TO_HAT = {
  first_match: "cap",
  first_win: "party_hat",
  dedicated: "top_hat",
  crew_hero: "halo",
  master_of_disguise: "devil_horns",
  sole_survivor: "flower",
  clown_prince: "jester_hat",
  arsonist_win: "flame_hat",
};

export const HAT_CATALOG = [
  { id: "cap", name: "Cap" },
  { id: "party_hat", name: "Party Hat" },
  { id: "top_hat", name: "Top Hat" },
  { id: "halo", name: "Halo" },
  { id: "devil_horns", name: "Devil Horns" },
  { id: "flower", name: "Flower" },
  { id: "jester_hat", name: "Jester Cap" },
  { id: "flame_hat", name: "Flame Crown" },
];

export const COLOR_PALETTE = [
  "#e05252", "#4d8fe0", "#3fae5c", "#e0c23f", "#e07fdc", "#e0873f",
  "#4fd1c5", "#a06be0", "#d4d4d4", "#8a5a3f", "#5ce0a3", "#e0e0e0",
];

export function hatsUnlockedFor(achievementIds) {
  const set = new Set();
  for (const a of achievementIds) {
    if (ACHIEVEMENT_TO_HAT[a]) set.add(ACHIEVEMENT_TO_HAT[a]);
  }
  return [...set];
}
