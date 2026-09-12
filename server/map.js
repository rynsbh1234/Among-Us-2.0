// Aphelion Station - the game's original map.
// Tile-grid world: simple, fast, robust AABB collision, easy to extend with more maps later.

export const TILE = 40; // logical px per tile
export const GRID_W = 70;
export const GRID_H = 46;

// Rooms are named rectangles (tile coords, inclusive-exclusive: x..x+w, y..y+h)
export const ROOMS = [
  { id: "atrium", name: "Atrium", x: 27, y: 16, w: 18, h: 12, color: "#3a4a5c" },
  { id: "medbay", name: "Med Bay", x: 2, y: 2, w: 14, h: 10, color: "#2f5c4c" },
  { id: "bridge", name: "Bridge", x: 27, y: 2, w: 18, h: 10, color: "#2f4a5c" },
  { id: "comms", name: "Comms Array", x: 54, y: 2, w: 14, h: 10, color: "#5c4a2f" },
  { id: "security", name: "Security Hub", x: 15, y: 16, w: 8, h: 12, color: "#4a2f5c" },
  { id: "reactor", name: "Reactor Core", x: 2, y: 16, w: 12, h: 12, color: "#5c2f2f" },
  { id: "command", name: "Command", x: 46, y: 16, w: 8, h: 12, color: "#5c5a2f" },
  { id: "cargo", name: "Cargo Bay", x: 56, y: 16, w: 12, h: 12, color: "#3f3f3f" },
  { id: "powergrid", name: "Power Grid", x: 2, y: 34, w: 12, h: 10, color: "#2f5c58" },
  { id: "lifesupport", name: "Life Support", x: 27, y: 34, w: 18, h: 10, color: "#2f5c2f" },
  { id: "armory", name: "Armory", x: 56, y: 34, w: 12, h: 10, color: "#5c2f4a" },
];

// Straight corridors (tile rects) linking rooms together.
const CORRIDORS = [
  { x: 14, y: 5, w: 13, h: 3 },   // medbay -> bridge
  { x: 45, y: 5, w: 9, h: 3 },    // bridge -> comms
  { x: 6, y: 12, w: 3, h: 4 },    // medbay -> reactor
  { x: 34, y: 12, w: 3, h: 4 },   // bridge -> atrium
  { x: 58, y: 12, w: 3, h: 4 },   // comms -> cargo
  { x: 13, y: 20, w: 2, h: 3 },   // reactor -> security
  { x: 22, y: 20, w: 5, h: 3 },   // security -> atrium
  { x: 44, y: 20, w: 2, h: 3 },   // atrium -> command
  { x: 53, y: 20, w: 3, h: 3 },   // command -> cargo
  { x: 6, y: 27, w: 3, h: 7 },    // reactor -> powergrid
  { x: 34, y: 27, w: 3, h: 7 },   // atrium -> lifesupport
  { x: 13, y: 37, w: 14, h: 3 },  // powergrid -> lifesupport
  { x: 44, y: 37, w: 12, h: 3 },  // lifesupport -> armory
  { x: 58, y: 27, w: 3, h: 7 },   // cargo -> armory
];

export const VENTS = [
  { id: "v_reactor", room: "reactor", x: 6, y: 20, group: "A" },
  { id: "v_security", room: "security", x: 18, y: 20, group: "A" },
  { id: "v_cargo", room: "cargo", x: 61, y: 20, group: "A" },
  { id: "v_medbay", room: "medbay", x: 8, y: 6, group: "B" },
  { id: "v_comms", room: "comms", x: 60, y: 6, group: "B" },
  { id: "v_lifesupport", room: "lifesupport", x: 35, y: 38, group: "B" },
];

export const SABOTAGE_PANELS = [
  { id: "reactor_1", type: "reactor", room: "reactor", x: 5, y: 25 },
  { id: "reactor_2", type: "reactor", room: "reactor", x: 10, y: 25 },
  { id: "o2_1", type: "o2", room: "lifesupport", x: 30, y: 40 },
  { id: "o2_2", type: "o2", room: "command", x: 49, y: 25 },
  { id: "lights_1", type: "lights", room: "powergrid", x: 7, y: 39 },
  { id: "comms_1", type: "comms", room: "comms", x: 66, y: 8 },
];

export const TASK_SPOTS = [
  { id: "t_medbay", room: "medbay", x: 12, y: 8, type: "wiring", label: "Scanner Wiring" },
  { id: "t_bridge", room: "bridge", x: 40, y: 8, type: "calibration", label: "Nav Calibration" },
  { id: "t_comms", room: "comms", x: 64, y: 8, type: "memory", label: "Signal Sequence" },
  { id: "t_security", room: "security", x: 19, y: 25, type: "swipe", label: "ID Card Swipe" },
  { id: "t_reactor", room: "reactor", x: 8, y: 22, type: "circuit", label: "Coolant Circuit" },
  { id: "t_command", room: "command", x: 50, y: 22, type: "wiring", label: "Console Wiring" },
  { id: "t_cargo", room: "cargo", x: 62, y: 22, type: "calibration", label: "Crate Scanner" },
  { id: "t_powergrid", room: "powergrid", x: 8, y: 40, type: "memory", label: "Breaker Sequence" },
  { id: "t_lifesupport", room: "lifesupport", x: 40, y: 40, type: "swipe", label: "Filter Card Swipe" },
  { id: "t_armory", room: "armory", x: 62, y: 40, type: "circuit", label: "Weapon Lock Circuit" },
];

export const EMERGENCY_BUTTON = { x: 35, y: 21 };
export const SPAWN_POINT = { x: 35 * TILE + TILE / 2, y: 21 * TILE + TILE / 2 };

// Build a boolean walkable grid from rooms + corridors.
const walkable = Array.from({ length: GRID_H }, () => new Array(GRID_W).fill(false));
function carve(rect) {
  for (let ty = rect.y; ty < rect.y + rect.h; ty++) {
    for (let tx = rect.x; tx < rect.x + rect.w; tx++) {
      if (tx >= 0 && tx < GRID_W && ty >= 0 && ty < GRID_H) walkable[ty][tx] = true;
    }
  }
}
ROOMS.forEach(carve);
CORRIDORS.forEach(carve);

export function isWalkableTile(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false;
  return walkable[ty][tx];
}

// World-space (px) collision check for a circular player radius.
export function isWalkableWorld(px, py, radius = 14) {
  const points = [
    [px - radius, py - radius],
    [px + radius, py - radius],
    [px - radius, py + radius],
    [px + radius, py + radius],
    [px, py],
  ];
  for (const [x, y] of points) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (!isWalkableTile(tx, ty)) return false;
  }
  return true;
}

export function roomAt(px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  for (const r of ROOMS) {
    if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return r;
  }
  return null;
}

export function tileToWorld(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

export const MAP_DATA = {
  name: "Aphelion Station",
  tile: TILE,
  gridW: GRID_W,
  gridH: GRID_H,
  rooms: ROOMS,
  corridors: CORRIDORS,
  vents: VENTS,
  sabotagePanels: SABOTAGE_PANELS,
  taskSpots: TASK_SPOTS,
  emergencyButton: EMERGENCY_BUTTON,
  spawnPoint: SPAWN_POINT,
  walkable, // sent once to client for rendering/collision mirroring
};
