const RANGE = { report: 130, emergency: 150, vent: 70, sabotageFix: 80 };
const TARGETED_ABILITIES = new Set([
  "impostor_kill", "sheriff_shoot", "medic_shield", "tracker_place",
  "guardian_bond", "poisoner_poison", "arsonist_douse",
]);
const SABOTAGE_TYPES = [
  { type: "reactor", label: "Reactor Meltdown" },
  { type: "o2", label: "Oxygen Depletion" },
  { type: "lights", label: "Lights" },
  { type: "comms", label: "Comms" },
];

const HUD = {
  renderRoleChip(you) {
    document.getElementById("hud-role-chip").innerHTML =
      `<b>${you.roleName}</b> <span style="color:#8b97a8">(${you.faction})</span>`;
  },

  renderTasks() {
    const box = document.getElementById("hud-tasks");
    const real = (App.myTasks || []).filter((t) => !t.isFake);
    if (!real.length) { box.innerHTML = "No tasks assigned."; return; }
    const done = real.filter((t) => t.done).length;
    box.innerHTML = `Tasks: ${done} / ${real.length}<br>` +
      real.map((t) => `<div style="opacity:${t.done ? 0.4 : 1}">${t.done ? "✓" : "○"} ${t.label}</div>`).join("");
  },

  renderAbilities(you) {
    const box = document.getElementById("hud-abilities");
    box.innerHTML = "";
    for (const ab of you.abilities) {
      if (ab.id === "vent_enter") continue; // handled by the proximity action button
      const btn = document.createElement("div");
      btn.className = "ability-btn";
      btn.dataset.abilityId = ab.id;
      btn.innerHTML = `${niceAbilityName(ab.id)}<span class="key">ready</span>`;
      btn.onclick = () => Game.useAbility(ab.id, ab);
      box.appendChild(btn);
    }
  },

  updateCooldowns(cooldowns) {
    if (!cooldowns) return;
    for (const el of document.querySelectorAll(".ability-btn")) {
      const id = el.dataset.abilityId;
      const readyAt = cooldowns[id] || 0;
      const remaining = readyAt - Date.now();
      if (remaining > 0) {
        el.classList.add("on-cooldown");
        el.querySelector(".key").textContent = Math.ceil(remaining / 1000) + "s";
      } else {
        el.classList.remove("on-cooldown");
        el.querySelector(".key").textContent = "ready";
      }
    }
  },

  toast(msg) {
    const el = document.getElementById("ability-toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  },

  sabotageBanner(state) {
    const banner = document.getElementById("hud-sabotage-banner");
    const active = state && (state.sabotages.reactor.active || state.sabotages.o2.active || state.sabotages.lights.active || state.sabotages.comms.active);
    if (!active) { banner.hidden = true; return; }
    banner.hidden = false;
    if (state.sabotages.reactor.active) banner.textContent = "REACTOR MELTDOWN - FIX IMMEDIATELY";
    else if (state.sabotages.o2.active) banner.textContent = "OXYGEN DEPLETING - FIX IMMEDIATELY";
    else if (state.sabotages.lights.active) banner.textContent = "LIGHTS SABOTAGED";
    else banner.textContent = "COMMS SABOTAGED";
  },
};

function niceAbilityName(id) {
  return {
    impostor_kill: "Kill", sheriff_shoot: "Shoot", medic_shield: "Shield",
    tracker_place: "Track", guardian_bond: "Rebind Bond", forensic_examine: "Examine Body",
    poisoner_poison: "Poison", janitor_clean: "Clean Body", swooper_cloak: "Cloak",
    arsonist_douse: "Douse", arsonist_ignite: "Ignite",
  }[id] || id;
}

const Game = {
  keys: {},
  started: false,

  begin() {
    App.myTasks = JSON.parse(JSON.stringify(App.youRole.tasks));
    HUD.renderRoleChip(App.youRole);
    HUD.renderTasks();
    HUD.renderAbilities(App.youRole);
    document.getElementById("hud-sabotage-banner").hidden = true;

    if (App.youRole.faction === "IMPOSTOR") document.getElementById("btn-sabotage").hidden = false;

    if (!this.started) {
      this.started = true;
      window.addEventListener("keydown", (e) => (this.keys[e.key.toLowerCase()] = true));
      window.addEventListener("keyup", (e) => (this.keys[e.key.toLowerCase()] = false));
      this.wireButtons();
      this.loop();
      setInterval(() => this.sendInput(), 50);
    }
  },

  wireButtons() {
    document.getElementById("btn-task").onclick = () => {
      const t = this.nearestOwnTask();
      if (t) TasksUI.open(t);
    };
    document.getElementById("btn-report").onclick = () => {
      const b = this.nearestBody();
      if (b) Net.emit("player:reportBody", { bodyId: b.id }, (res) => { if (res && res.error) HUD.toast(res.error); });
    };
    document.getElementById("btn-emergency").onclick = () => {
      Net.emit("player:callMeeting", {}, (res) => { if (res && res.error) HUD.toast(res.error); });
    };
    document.getElementById("btn-vent").onclick = () => {
      Net.emit("player:ventEnter", {}, (res) => {
        if (!res || res.error) return HUD.toast((res && res.error) || "No vent nearby.");
        const box = document.getElementById("vent-picker");
        const opts = document.getElementById("vent-options");
        opts.innerHTML = "";
        for (const o of res.options) {
          const b = document.createElement("button");
          b.textContent = `Travel to ${o.room}`;
          b.onclick = () => {
            Net.emit("player:ventTravel", { toVentId: o.id }, () => { box.hidden = true; });
          };
          opts.appendChild(b);
        }
        box.hidden = false;
      });
    };
    document.getElementById("btn-vent-cancel").onclick = () => {
      Net.emit("player:ventExit");
      document.getElementById("vent-picker").hidden = true;
    };
    document.getElementById("btn-fix").onclick = () => {
      const panel = this.nearestActiveSabotagePanel();
      if (panel) Net.emit("sabotage:fix", { panelId: panel.id });
    };
    document.getElementById("btn-sabotage").onclick = () => {
      const box = document.getElementById("sabotage-picker");
      const opts = document.getElementById("sabotage-options");
      opts.innerHTML = "";
      const state = App.gameState;
      for (const s of SABOTAGE_TYPES) {
        const b = document.createElement("button");
        const active = state && state.sabotages[s.type].active;
        b.textContent = s.label + (active ? " (active)" : "");
        b.disabled = !!active || !(state && state.sabotageReady);
        b.onclick = () => {
          Net.emit("sabotage:trigger", { type: s.type }, (res) => { if (res && res.error) HUD.toast(res.error); });
          box.hidden = true;
        };
        opts.appendChild(b);
      }
      box.hidden = false;
    };
    document.getElementById("btn-sabotage-cancel").onclick = () => { document.getElementById("sabotage-picker").hidden = true; };
  },

  useAbility(abilityId, def) {
    let targetId = null;
    if (TARGETED_ABILITIES.has(abilityId)) {
      const t = this.nearestOtherPlayer(def.rangePx || 90);
      if (!t) return HUD.toast("No target in range.");
      targetId = t.id;
    }
    Net.emit("player:useAbility", { abilityId, targetId }, (res) => {
      if (!res || res.error) return HUD.toast((res && res.error) || "Failed.");
      if (res.data) HUD.toast(`Clue: cause ${res.data.cause}, ${res.data.timeBucket}${res.data.moved ? ", body was moved" : ""}`);
      else if (abilityId === "sheriff_shoot") HUD.toast(res.hit ? "You eliminated an impostor!" : "You shot an innocent player...");
      else HUD.toast(niceAbilityName(abilityId) + " used.");
    });
  },

  me() {
    return App.gameState && App.gameState.players.find((p) => p.id === App.myId);
  },

  nearestOtherPlayer(range) {
    const me = this.me();
    if (!me) return null;
    let best = null, bestD = range;
    for (const p of App.gameState.players) {
      if (p.id === me.id || p.ghost) continue;
      const d = Math.hypot(p.x - me.x, p.y - me.y);
      if (d <= bestD) { best = p; bestD = d; }
    }
    return best;
  },

  nearestBody() {
    const me = this.me();
    if (!me || !App.gameState) return null;
    let best = null, bestD = RANGE.report;
    for (const b of App.gameState.bodies) {
      const d = Math.hypot(b.x - me.x, b.y - me.y);
      if (d <= bestD) { best = b; bestD = d; }
    }
    return best;
  },

  nearestOwnTask() {
    const me = this.me();
    if (!me || !App.myTasks) return null;
    const tile = App.map.tile;
    for (const t of App.myTasks) {
      if (t.done || t.isFake) continue;
      const wx = t.x * tile + tile / 2, wy = t.y * tile + tile / 2;
      if (Math.hypot(wx - me.x, wy - me.y) <= 55) return t;
    }
    return null;
  },

  nearestActiveSabotagePanel() {
    const me = this.me();
    const state = App.gameState;
    if (!me || !state) return null;
    const tile = App.map.tile;
    for (const p of App.map.sabotagePanels) {
      if (!state.sabotages[p.type] || !state.sabotages[p.type].active) continue;
      const wx = p.x * tile + tile / 2, wy = p.y * tile + tile / 2;
      if (Math.hypot(wx - me.x, wy - me.y) <= RANGE.sabotageFix) return p;
    }
    return null;
  },

  nearestVent() {
    const me = this.me();
    if (!me) return null;
    const tile = App.map.tile;
    for (const v of App.map.vents) {
      const wx = v.x * tile + tile / 2, wy = v.y * tile + tile / 2;
      if (Math.hypot(wx - me.x, wy - me.y) <= RANGE.vent) return v;
    }
    return null;
  },

  sendInput() {
    if (App.current !== "game") return;
    let dx = 0, dy = 0;
    if (this.keys["w"] || this.keys["arrowup"]) dy -= 1;
    if (this.keys["s"] || this.keys["arrowdown"]) dy += 1;
    if (this.keys["a"] || this.keys["arrowleft"]) dx -= 1;
    if (this.keys["d"] || this.keys["arrowright"]) dx += 1;
    Net.emit("player:input", { dx, dy });
  },

  loop() {
    requestAnimationFrame(() => this.loop());
    if (App.current !== "game") return;
    const state = App.gameState;
    const me = this.me();
    App.amIAlive = me ? (me.alive !== false && !me.ghost) : App.amIAlive;

    Render.draw();
    if (state) {
      HUD.updateCooldowns(state.cooldowns);
      HUD.sabotageBanner(state);
      document.getElementById("btn-task").hidden = !this.nearestOwnTask();
      document.getElementById("btn-report").hidden = !this.nearestBody();
      document.getElementById("btn-emergency").hidden = !(state.canCallEmergency && this.withinEmergencyRange());
      document.getElementById("btn-fix").hidden = !this.nearestActiveSabotagePanel();
      const roleHasVent = App.youRole.abilities.some((a) => a.id === "vent_enter");
      document.getElementById("btn-vent").hidden = !(roleHasVent && !me?.inVent && this.nearestVent());
    }
  },

  withinEmergencyRange() {
    const me = this.me();
    if (!me) return false;
    const eb = App.map.emergencyButton;
    const tile = App.map.tile;
    const wx = eb.x * tile + tile / 2, wy = eb.y * tile + tile / 2;
    return Math.hypot(wx - me.x, wy - me.y) <= RANGE.emergency;
  },
};
