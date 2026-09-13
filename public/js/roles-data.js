// Mirrors the public (non-balance) fields of server/roles.js so the lobby can render
// role-pool checkboxes without a network round trip. Keep IDs in sync with the server.
const ROLE_CATALOG = {
  crew: [
    { id: "ENGINEER", name: "Engineer" },
    { id: "SHERIFF", name: "Sheriff" },
    { id: "MEDIC", name: "Medic" },
    { id: "TRACKER", name: "Tracker" },
    { id: "GUARDIAN", name: "Guardian" },
    { id: "FORENSIC", name: "Forensic Investigator" },
  ],
  impostor: [
    { id: "SWOOPER", name: "Swooper" },
    { id: "POISONER", name: "Poisoner" },
    { id: "JANITOR", name: "Janitor" },
  ],
  neutral: [
    { id: "JESTER", name: "Jester" },
    { id: "EXECUTIONER", name: "Executioner" },
    { id: "SURVIVOR", name: "Survivor" },
    { id: "ARSONIST", name: "Arsonist" },
  ],
};
