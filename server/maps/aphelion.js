import { buildMap } from "./mapFactory.js";

// Aphelion Station - original space-station map.
const ROOMS = [
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

const CORRIDORS = [
  { x: 14, y: 5, w: 13, h: 3 }, { x: 45, y: 5, w: 9, h: 3 },
  { x: 6, y: 12, w: 3, h: 4 }, { x: 34, y: 12, w: 3, h: 4 }, { x: 58, y: 12, w: 3, h: 4 },
  { x: 13, y: 20, w: 2, h: 3 }, { x: 22, y: 20, w: 5, h: 3 },
  { x: 44, y: 20, w: 2, h: 3 }, { x: 53, y: 20, w: 3, h: 3 },
  { x: 6, y: 27, w: 3, h: 7 }, { x: 34, y: 27, w: 3, h: 7 },
  { x: 13, y: 37, w: 14, h: 3 }, { x: 44, y: 37, w: 12, h: 3 }, { x: 58, y: 27, w: 3, h: 7 },
];

const VENTS = [
  { id: "v_reactor", room: "reactor", x: 6, y: 20, group: "A" },
  { id: "v_security", room: "security", x: 18, y: 20, group: "A" },
  { id: "v_cargo", room: "cargo", x: 61, y: 20, group: "A" },
  { id: "v_medbay", room: "medbay", x: 8, y: 6, group: "B" },
  { id: "v_comms", room: "comms", x: 60, y: 6, group: "B" },
  { id: "v_lifesupport", room: "lifesupport", x: 35, y: 38, group: "B" },
];

const SABOTAGE_PANELS = [
  { id: "reactor_1", type: "reactor", room: "reactor", x: 5, y: 25 },
  { id: "reactor_2", type: "reactor", room: "reactor", x: 10, y: 25 },
  { id: "o2_1", type: "o2", room: "lifesupport", x: 30, y: 40 },
  { id: "o2_2", type: "o2", room: "command", x: 49, y: 25 },
  { id: "lights_1", type: "lights", room: "powergrid", x: 7, y: 39 },
  { id: "comms_1", type: "comms", room: "comms", x: 66, y: 8 },
];

const TASK_SPOTS = [
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

const EMERGENCY_BUTTON = { x: 35, y: 21 };

export default buildMap({
  id: "APHELION", name: "Aphelion Station", tile: 40, gridW: 70, gridH: 46,
  rooms: ROOMS, corridors: CORRIDORS, vents: VENTS, sabotagePanels: SABOTAGE_PANELS,
  taskSpots: TASK_SPOTS, emergencyButton: EMERGENCY_BUTTON,
  ejectionVerb: "was launched into space",
});
