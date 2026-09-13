import { buildMap } from "./mapFactory.js";

// Meridian Liner - original cruise-ship map. Deliberately shaped and connected
// differently from Aphelion Station: two long decks (upper/lower) joined by
// three stairwells, instead of a cross/grid layout around a central hub.
const ROOMS = [
  { id: "bridge", name: "Bridge", x: 2, y: 2, w: 14, h: 16, color: "#2f4a5c" },
  { id: "barlounge", name: "Bar Lounge", x: 20, y: 2, w: 14, h: 16, color: "#5c2f4a" },
  { id: "casino", name: "Casino", x: 38, y: 2, w: 14, h: 16, color: "#5c4a2f" },
  { id: "theater", name: "Theater", x: 56, y: 2, w: 14, h: 16, color: "#4a2f5c" },
  { id: "suites", name: "Suites", x: 74, y: 2, w: 14, h: 16, color: "#3f3f3f" },
  { id: "cargohold", name: "Cargo Hold", x: 2, y: 22, w: 14, h: 16, color: "#5c2f2f" },
  { id: "engineroom", name: "Engine Room", x: 20, y: 22, w: 14, h: 16, color: "#2f5c58" },
  { id: "grandatrium", name: "Grand Atrium", x: 38, y: 22, w: 14, h: 16, color: "#3a4a5c" },
  { id: "dininghall", name: "Dining Hall", x: 56, y: 22, w: 14, h: 16, color: "#2f5c2f" },
  { id: "pooldeck", name: "Pool Deck", x: 74, y: 22, w: 14, h: 16, color: "#4a5c2f" },
];

const CORRIDORS = [
  // upper-deck spine
  { x: 16, y: 8, w: 4, h: 3 }, { x: 34, y: 8, w: 4, h: 3 },
  { x: 52, y: 8, w: 4, h: 3 }, { x: 70, y: 8, w: 4, h: 3 },
  // lower-deck spine
  { x: 16, y: 28, w: 4, h: 3 }, { x: 34, y: 28, w: 4, h: 3 },
  { x: 52, y: 28, w: 4, h: 3 }, { x: 70, y: 28, w: 4, h: 3 },
  // stairwells: bow, midship, stern
  { x: 7, y: 18, w: 3, h: 4 }, { x: 43, y: 18, w: 3, h: 4 }, { x: 80, y: 18, w: 3, h: 4 },
];

const VENTS = [
  { id: "v_cargohold", room: "cargohold", x: 9, y: 30, group: "A" },
  { id: "v_engineroom", room: "engineroom", x: 27, y: 30, group: "A" },
  { id: "v_grandatrium", room: "grandatrium", x: 41, y: 30, group: "A" },
  { id: "v_bridge", room: "bridge", x: 9, y: 10, group: "B" },
  { id: "v_casino", room: "casino", x: 45, y: 10, group: "B" },
  { id: "v_suites", room: "suites", x: 81, y: 10, group: "B" },
];

const SABOTAGE_PANELS = [
  { id: "reactor_1", type: "reactor", room: "engineroom", x: 24, y: 32 },
  { id: "reactor_2", type: "reactor", room: "engineroom", x: 30, y: 32 },
  { id: "o2_1", type: "o2", room: "cargohold", x: 9, y: 34 },
  { id: "o2_2", type: "o2", room: "pooldeck", x: 81, y: 34 },
  { id: "lights_1", type: "lights", room: "barlounge", x: 27, y: 10 },
  { id: "comms_1", type: "comms", room: "bridge", x: 9, y: 6 },
];

const TASK_SPOTS = [
  { id: "t_bridge", room: "bridge", x: 9, y: 14, type: "wiring", label: "Helm Controls" },
  { id: "t_barlounge", room: "barlounge", x: 27, y: 14, type: "memory", label: "Cocktail Order" },
  { id: "t_casino", room: "casino", x: 45, y: 14, type: "calibration", label: "Slot Machine Reels" },
  { id: "t_theater", room: "theater", x: 63, y: 14, type: "circuit", label: "Stage Lighting Rig" },
  { id: "t_suites", room: "suites", x: 81, y: 14, type: "swipe", label: "Keycard Lock" },
  { id: "t_cargohold", room: "cargohold", x: 9, y: 26, type: "wiring", label: "Manifest Terminal" },
  { id: "t_engineroom", room: "engineroom", x: 27, y: 36, type: "circuit", label: "Turbine Coolant" },
  { id: "t_dininghall", room: "dininghall", x: 63, y: 30, type: "memory", label: "Course Order" },
  { id: "t_pooldeck", room: "pooldeck", x: 81, y: 30, type: "swipe", label: "Pool Pass Scanner" },
];

const EMERGENCY_BUTTON = { x: 45, y: 30 };

export default buildMap({
  id: "MERIDIAN", name: "Meridian Liner", tile: 40, gridW: 90, gridH: 40,
  rooms: ROOMS, corridors: CORRIDORS, vents: VENTS, sabotagePanels: SABOTAGE_PANELS,
  taskSpots: TASK_SPOTS, emergencyButton: EMERGENCY_BUTTON,
  sabotageNames: { reactor: "Engine Overload", o2: "Flooding", lights: "Power Failure", comms: "Radio Silence" },
  ejectionVerb: "was thrown overboard",
});
