// Role catalog. Faction + Role + (future) Modifier are kept as separate concepts so the
// system can grow (see README roadmap) without reshaping this table.
// Each role's actual ability *effect* is implemented in Game.js#useAbility, keyed by abilityId.
// This file is the single source of truth for balance numbers (cooldowns/ranges/durations in ms/px).

export const FACTIONS = {
  CREW: "CREW",
  IMPOSTOR: "IMPOSTOR",
  NEUTRAL: "NEUTRAL",
};

export const ROLES = {
  CREWMATE: {
    id: "CREWMATE", name: "Crewmate", faction: FACTIONS.CREW,
    short: "No ability. Complete tasks, watch, deduce.",
    abilities: [],
  },
  ENGINEER: {
    id: "ENGINEER", name: "Engineer", faction: FACTIONS.CREW,
    short: "Can enter vents to travel fast and reach sabotages quickly.",
    abilities: [{ id: "vent_enter", cooldownMs: 0, rangePx: 60 }],
  },
  SHERIFF: {
    id: "SHERIFF", name: "Sheriff", faction: FACTIONS.CREW,
    short: "Can shoot a player they believe is hostile. Guess wrong and you die instead.",
    abilities: [{ id: "sheriff_shoot", cooldownMs: 25000, rangePx: 110 }],
  },
  MEDIC: {
    id: "MEDIC", name: "Medic", faction: FACTIONS.CREW,
    short: "Can shield one player for a short time, blocking the next kill on them.",
    abilities: [{ id: "medic_shield", cooldownMs: 30000, rangePx: 90, durationMs: 12000 }],
  },
  TRACKER: {
    id: "TRACKER", name: "Tracker", faction: FACTIONS.CREW,
    short: "Can place a tracker on a player to see which room they're in for a while.",
    abilities: [{ id: "tracker_place", cooldownMs: 20000, rangePx: 90, durationMs: 20000 }],
  },
  GUARDIAN: {
    id: "GUARDIAN", name: "Guardian", faction: FACTIONS.CREW,
    short: "Bonded to a random player each match. If they're attacked, you die in their place. Can rebind the bond to someone nearby.",
    abilities: [{ id: "guardian_bond", cooldownMs: 20000, rangePx: 90 }],
  },
  FORENSIC: {
    id: "FORENSIC", name: "Forensic Investigator", faction: FACTIONS.CREW,
    short: "Can examine a body for a clue about time of death and whether it was moved.",
    abilities: [{ id: "forensic_examine", cooldownMs: 0, rangePx: 50 }],
  },

  IMPOSTOR: {
    id: "IMPOSTOR", name: "Impostor", faction: FACTIONS.IMPOSTOR,
    short: "Kill crew, sabotage the station, blend in.",
    abilities: [
      { id: "impostor_kill", cooldownMs: 25000, rangePx: 60 },
      { id: "vent_enter", cooldownMs: 0, rangePx: 60 },
    ],
  },
  SWOOPER: {
    id: "SWOOPER", name: "Swooper", faction: FACTIONS.IMPOSTOR,
    short: "Can cloak invisible for a short time. Kill cooldown still applies.",
    abilities: [
      { id: "impostor_kill", cooldownMs: 25000, rangePx: 60 },
      { id: "vent_enter", cooldownMs: 0, rangePx: 60 },
      { id: "swooper_cloak", cooldownMs: 30000, durationMs: 6000 },
    ],
  },
  POISONER: {
    id: "POISONER", name: "Poisoner", faction: FACTIONS.IMPOSTOR,
    short: "Can poison a player. They die from it after a delay unless cured.",
    abilities: [
      { id: "poisoner_poison", cooldownMs: 30000, rangePx: 60, durationMs: 18000 },
      { id: "vent_enter", cooldownMs: 0, rangePx: 60 },
    ],
  },
  JANITOR: {
    id: "JANITOR", name: "Janitor", faction: FACTIONS.IMPOSTOR,
    short: "Can clean up a body, removing it (and its evidence) before it's found.",
    abilities: [
      { id: "impostor_kill", cooldownMs: 25000, rangePx: 60 },
      { id: "vent_enter", cooldownMs: 0, rangePx: 60 },
      { id: "janitor_clean", cooldownMs: 5000, rangePx: 50 },
    ],
  },

  JESTER: {
    id: "JESTER", name: "Jester", faction: FACTIONS.NEUTRAL,
    short: "Wins alone if the crew votes you out.",
    abilities: [],
  },
  EXECUTIONER: {
    id: "EXECUTIONER", name: "Executioner", faction: FACTIONS.NEUTRAL,
    short: "Secretly assigned a target. Wins alone if that target is voted out.",
    abilities: [],
  },
  SURVIVOR: {
    id: "SURVIVOR", name: "Survivor", faction: FACTIONS.NEUTRAL,
    short: "Wins by being alive when the game ends, whoever else wins.",
    abilities: [],
  },
  ARSONIST: {
    id: "ARSONIST", name: "Arsonist", faction: FACTIONS.NEUTRAL,
    short: "Can douse players, then ignite everyone doused at once. Wins alone.",
    abilities: [
      { id: "arsonist_douse", cooldownMs: 8000, rangePx: 60 },
      { id: "arsonist_ignite", cooldownMs: 0 },
    ],
  },
};

export function abilityDef(roleId, abilityId) {
  const role = ROLES[roleId];
  if (!role) return null;
  return role.abilities.find((a) => a.id === abilityId) || null;
}

export const ALL_ROLE_IDS = Object.keys(ROLES);
export const CREW_ROLE_IDS = ALL_ROLE_IDS.filter((r) => ROLES[r].faction === FACTIONS.CREW && r !== "CREWMATE");
export const IMPOSTOR_ROLE_IDS = ALL_ROLE_IDS.filter((r) => ROLES[r].faction === FACTIONS.IMPOSTOR && r !== "IMPOSTOR");
export const NEUTRAL_ROLE_IDS = ALL_ROLE_IDS.filter((r) => ROLES[r].faction === FACTIONS.NEUTRAL);

// Public-safe role summary (no balance internals) for the client role catalog / tutorial cards.
export function publicRoleInfo(roleId) {
  const r = ROLES[roleId];
  if (!r) return null;
  return { id: r.id, name: r.name, faction: r.faction, short: r.short };
}
