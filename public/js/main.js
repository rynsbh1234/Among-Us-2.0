const App = {
  myId: null,
  name: "",
  roomCode: null,
  isHost: false,
  lobby: null,
  youRole: null,
  map: null,
  roster: [],
  settings: null,
  gameState: null,
  meeting: null,

  screens: {},

  showScreen(id) {
    for (const key of Object.keys(this.screens)) {
      this.screens[key].classList.toggle("active", key === id);
    }
    this.current = id;
  },

  init() {
    for (const el of document.querySelectorAll(".screen")) this.screens[el.id.replace("screen-", "")] = el;

    Net.socket.on("connect", () => { this.myId = Net.socket.id; });

    document.getElementById("btn-create").onclick = () => {
      this.name = document.getElementById("input-name").value.trim() || "Player";
      Net.emit("lobby:create", { name: this.name });
    };
    document.getElementById("btn-join").onclick = () => {
      this.name = document.getElementById("input-name").value.trim() || "Player";
      const code = document.getElementById("input-code").value.trim().toUpperCase();
      if (!code) return;
      Net.emit("lobby:join", { code, name: this.name });
    };
    document.getElementById("btn-quickplay").onclick = () => {
      this.name = document.getElementById("input-name").value.trim() || "Player";
      Net.emit("lobby:quickPlay", { name: this.name });
    };

    Net.on("lobby:created", ({ code }) => { this.roomCode = code; this.showScreen("lobby"); });
    Net.on("lobby:joined", ({ code }) => { this.roomCode = code; this.showScreen("lobby"); });
    Net.on("error:lobby", ({ message }) => {
      const target = this.current === "lobby" ? "lobby-error" : "menu-error";
      document.getElementById(target).textContent = message;
    });

    Net.on("lobby:state", (state) => {
      this.lobby = state;
      this.isHost = state.hostId === this.myId;
      Lobby.render(state);
    });

    document.getElementById("btn-leave").onclick = () => {
      Net.emit("lobby:leave");
      this.roomCode = null;
      this.showScreen("menu");
    };

    Net.on("game:start", (payload) => {
      this.youRole = payload.you;
      this.map = payload.map;
      this.roster = payload.roster;
      this.settings = payload.settings;
      this.showRoleCard(payload.you);
    });

    document.getElementById("btn-role-continue").onclick = () => {
      this.showScreen("game");
      Game.begin();
    };

    Net.on("game:state", (state) => { this.gameState = state; });

    Net.on("game:over", (payload) => {
      Voice.disable();
      this.showEndScreen(payload);
    });

    document.getElementById("btn-play-again").onclick = () => {
      this.showScreen("lobby");
    };

    document.getElementById("btn-watch-replay").onclick = () => {
      Replay.start(this.lastReplayFrames, this.lastTimeline);
    };
  },

  showRoleCard(you) {
    const card = document.getElementById("role-card");
    card.className = "role-card faction-" + you.faction;
    document.getElementById("role-faction").textContent = you.faction;
    document.getElementById("role-name").textContent = you.roleName;
    document.getElementById("role-desc").textContent = you.roleShort;
    const targetEl = document.getElementById("role-target");
    targetEl.textContent = you.executionerTargetName ? `Your target: ${you.executionerTargetName}` : "";
    this.showScreen("role");
  },

  showEndScreen(payload) {
    document.getElementById("end-achievements").innerHTML = "";
    document.getElementById("end-banner").textContent = `${payload.faction} WINS`;
    document.getElementById("end-reason").textContent = payload.reason || "";
    const list = document.getElementById("end-roster");
    list.innerHTML = "";
    for (const p of payload.roster) {
      const li = document.createElement("li");
      li.className = p.won ? "won" : "";
      li.innerHTML = `<span>${p.name} - ${p.roleName} (${p.faction})</span><span>${p.alive ? "alive" : "dead"}${p.won ? " • WON" : ""}</span>`;
      list.appendChild(li);
    }
    const tl = document.getElementById("end-timeline");
    tl.innerHTML = "";
    for (const e of payload.timeline) {
      const d = document.createElement("div");
      const secs = Math.floor(e.t / 1000);
      d.textContent = `[${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}] ${e.text}`;
      tl.appendChild(d);
    }

    this.lastReplayFrames = payload.replayFrames || [];
    this.lastTimeline = payload.timeline || [];
    document.getElementById("btn-watch-replay").disabled = this.lastReplayFrames.length === 0;

    this.showScreen("end");
  },
};

window.addEventListener("DOMContentLoaded", () => App.init());
