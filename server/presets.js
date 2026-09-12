// Lobby setting presets. Hosts can start from one of these and then tweak individual values.
export const DEFAULT_SETTINGS = {
  impostorCount: 2,
  crewRolePool: ["ENGINEER", "SHERIFF", "MEDIC", "TRACKER", "GUARDIAN", "FORENSIC"],
  impostorRolePool: ["SWOOPER", "POISONER", "JANITOR"],
  neutralRoles: ["JESTER"],
  taskCount: 5,
  movementSpeed: 1,
  discussionSeconds: 30,
  votingSeconds: 20,
  maxEmergencyMeetingsPerPlayer: 1,
  anonymousVotes: false,
  confirmEjects: true,
  killCooldownMs: 25000,
  visionRadius: 260,
  impostorVisionRadius: 320,
};

export const PRESETS = {
  CLASSIC: { ...DEFAULT_SETTINGS },
  CASUAL: {
    ...DEFAULT_SETTINGS,
    taskCount: 3,
    discussionSeconds: 45,
    votingSeconds: 30,
    killCooldownMs: 30000,
  },
  CHAOS: {
    ...DEFAULT_SETTINGS,
    impostorCount: 3,
    crewRolePool: ["ENGINEER", "SHERIFF", "MEDIC", "TRACKER", "GUARDIAN", "FORENSIC"],
    impostorRolePool: ["SWOOPER", "POISONER", "JANITOR"],
    neutralRoles: ["JESTER", "EXECUTIONER", "ARSONIST", "SURVIVOR"],
    killCooldownMs: 18000,
  },
  DETECTIVE: {
    ...DEFAULT_SETTINGS,
    crewRolePool: ["SHERIFF", "TRACKER", "FORENSIC", "MEDIC"],
    impostorRolePool: ["JANITOR"],
    taskCount: 4,
  },
  QUICK_MATCH: {
    ...DEFAULT_SETTINGS,
    taskCount: 2,
    discussionSeconds: 15,
    votingSeconds: 15,
    killCooldownMs: 15000,
  },
};

export function mergeSettings(base, overrides = {}) {
  const merged = { ...base, ...overrides };
  merged.impostorCount = Math.max(1, Math.min(4, Number(merged.impostorCount) || 1));
  merged.taskCount = Math.max(1, Math.min(10, Number(merged.taskCount) || 1));
  merged.movementSpeed = Math.max(0.5, Math.min(2, Number(merged.movementSpeed) || 1));
  return merged;
}
