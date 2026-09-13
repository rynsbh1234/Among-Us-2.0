import aphelion from "./aphelion.js";
import meridian from "./meridian.js";
import hollow from "./hollow.js";

export const MAPS = {
  APHELION: aphelion,
  MERIDIAN: meridian,
  HOLLOW: hollow,
};

export const DEFAULT_MAP_ID = "APHELION";

export const MAP_LIST = Object.values(MAPS).map((m) => ({ id: m.id, name: m.name }));

export function getMap(id) {
  return MAPS[id] || MAPS[DEFAULT_MAP_ID];
}
