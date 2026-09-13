// Shared engine for building a playable map instance from room/corridor/vent/task
// data. Every map file (aphelion.js, meridian.js, hollow.js) calls buildMap() with
// its own layout; this is what turns that data into walkability + collision helpers.
const DEFAULT_SABOTAGE_NAMES = { reactor: "Reactor Meltdown", o2: "Oxygen Depleting", lights: "Lights Sabotaged", comms: "Comms Sabotaged" };

export function buildMap({
  id, name, tile = 40, gridW, gridH,
  rooms, corridors, vents, sabotagePanels, taskSpots, emergencyButton, spawnPoint,
  sabotageNames, ejectionVerb,
}) {
  const walkable = Array.from({ length: gridH }, () => new Array(gridW).fill(false));
  function carve(rect) {
    for (let ty = rect.y; ty < rect.y + rect.h; ty++) {
      for (let tx = rect.x; tx < rect.x + rect.w; tx++) {
        if (tx >= 0 && tx < gridW && ty >= 0 && ty < gridH) walkable[ty][tx] = true;
      }
    }
  }
  rooms.forEach(carve);
  corridors.forEach(carve);

  function isWalkableTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= gridW || ty >= gridH) return false;
    return walkable[ty][tx];
  }

  function isWalkableWorld(px, py, radius = 14) {
    const points = [
      [px - radius, py - radius], [px + radius, py - radius],
      [px - radius, py + radius], [px + radius, py + radius], [px, py],
    ];
    for (const [x, y] of points) {
      if (!isWalkableTile(Math.floor(x / tile), Math.floor(y / tile))) return false;
    }
    return true;
  }

  function roomAt(px, py) {
    const tx = Math.floor(px / tile), ty = Math.floor(py / tile);
    for (const r of rooms) {
      if (tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h) return r;
    }
    return null;
  }

  function tileToWorld(tx, ty) {
    return { x: tx * tile + tile / 2, y: ty * tile + tile / 2 };
  }

  const spawnWorld = spawnPoint || tileToWorld(emergencyButton.x, emergencyButton.y);

  return {
    id, name, tile, gridW, gridH,
    rooms, corridors, vents, sabotagePanels, taskSpots, emergencyButton,
    spawnPoint: spawnWorld,
    sabotageNames: { ...DEFAULT_SABOTAGE_NAMES, ...(sabotageNames || {}) },
    ejectionVerb: ejectionVerb || "was ejected",
    walkable, // sent to the client once per match for rendering/minimap
    isWalkableTile, isWalkableWorld, roomAt, tileToWorld,
  };
}
