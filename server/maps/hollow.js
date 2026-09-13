import { buildMap } from "./mapFactory.js";

// Hollow Manor - original mansion/estate map. Irregular room sizes and a
// looped (not hub-and-spoke) corridor layout, for a maze-ier feel than the
// station or the liner.
const ROOMS = [
  { id: "foyer", name: "Foyer", x: 28, y: 20, w: 14, h: 10, color: "#3a4a5c" },
  { id: "library", name: "Library", x: 2, y: 2, w: 18, h: 14, color: "#4a3a2f" },
  { id: "ballroom", name: "Ballroom", x: 24, y: 2, w: 22, h: 14, color: "#5c4a2f" },
  { id: "study", name: "Study", x: 50, y: 2, w: 16, h: 14, color: "#2f4a5c" },
  { id: "kitchen", name: "Kitchen", x: 2, y: 20, w: 16, h: 14, color: "#5c2f2f" },
  { id: "diningroom", name: "Dining Room", x: 52, y: 20, w: 16, h: 14, color: "#5c5a2f" },
  { id: "conservatory", name: "Conservatory", x: 2, y: 38, w: 18, h: 12, color: "#2f5c2f" },
  { id: "winecellar", name: "Wine Cellar", x: 24, y: 40, w: 16, h: 10, color: "#3f2f3f" },
  { id: "masterbedroom", name: "Master Bedroom", x: 52, y: 38, w: 16, h: 12, color: "#4a2f5c" },
  { id: "gardenterrace", name: "Garden Terrace", x: 70, y: 20, w: 12, h: 14, color: "#3f5c3f" },
];

const CORRIDORS = [
  { x: 20, y: 6, w: 4, h: 3 }, { x: 46, y: 6, w: 4, h: 3 },
  { x: 33, y: 16, w: 3, h: 4 }, { x: 8, y: 16, w: 3, h: 4 }, { x: 58, y: 16, w: 3, h: 4 },
  { x: 18, y: 24, w: 10, h: 3 }, { x: 42, y: 24, w: 10, h: 3 }, { x: 68, y: 24, w: 2, h: 3 },
  { x: 8, y: 34, w: 3, h: 4 }, { x: 30, y: 30, w: 3, h: 10 }, { x: 58, y: 34, w: 3, h: 4 },
  { x: 20, y: 44, w: 4, h: 3 }, { x: 40, y: 44, w: 12, h: 3 },
];

const VENTS = [
  { id: "v_library", room: "library", x: 10, y: 8, group: "A" },
  { id: "v_conservatory", room: "conservatory", x: 10, y: 43, group: "A" },
  { id: "v_winecellar", room: "winecellar", x: 31, y: 44, group: "A" },
  { id: "v_study", room: "study", x: 57, y: 8, group: "B" },
  { id: "v_gardenterrace", room: "gardenterrace", x: 75, y: 26, group: "B" },
  { id: "v_masterbedroom", room: "masterbedroom", x: 59, y: 43, group: "B" },
];

const SABOTAGE_PANELS = [
  { id: "reactor_1", type: "reactor", room: "winecellar", x: 28, y: 45 },
  { id: "reactor_2", type: "reactor", room: "winecellar", x: 34, y: 45 },
  { id: "o2_1", type: "o2", room: "kitchen", x: 8, y: 27 },
  { id: "o2_2", type: "o2", room: "study", x: 57, y: 8 },
  { id: "lights_1", type: "lights", room: "ballroom", x: 35, y: 8 },
  { id: "comms_1", type: "comms", room: "study", x: 63, y: 12 },
];

const TASK_SPOTS = [
  { id: "t_library", room: "library", x: 10, y: 12, type: "wiring", label: "Card Catalog Sort" },
  { id: "t_ballroom", room: "ballroom", x: 35, y: 12, type: "calibration", label: "Chandelier Balance" },
  { id: "t_study", room: "study", x: 58, y: 12, type: "circuit", label: "Telephone Switchboard" },
  { id: "t_kitchen", room: "kitchen", x: 10, y: 30, type: "memory", label: "Recipe Sequence" },
  { id: "t_diningroom", room: "diningroom", x: 60, y: 30, type: "swipe", label: "Silverware Polish" },
  { id: "t_conservatory", room: "conservatory", x: 10, y: 45, type: "wiring", label: "Irrigation Valves" },
  { id: "t_winecellar", room: "winecellar", x: 31, y: 47, type: "circuit", label: "Cask Pressure Release" },
  { id: "t_masterbedroom", room: "masterbedroom", x: 60, y: 45, type: "memory", label: "Safe Combination" },
  { id: "t_gardenterrace", room: "gardenterrace", x: 75, y: 30, type: "swipe", label: "Hedge Trimmer Pass" },
];

const EMERGENCY_BUTTON = { x: 35, y: 25 };

export default buildMap({
  id: "HOLLOW", name: "Hollow Manor", tile: 40, gridW: 84, gridH: 52,
  rooms: ROOMS, corridors: CORRIDORS, vents: VENTS, sabotagePanels: SABOTAGE_PANELS,
  taskSpots: TASK_SPOTS, emergencyButton: EMERGENCY_BUTTON,
  sabotageNames: { reactor: "Furnace Overload", o2: "Gas Leak", lights: "Fuse Box Tripped", comms: "Phone Line Cut" },
  ejectionVerb: "was thrown out of the manor",
});
