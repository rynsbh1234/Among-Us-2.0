const Lobby = {
  render(state) {
    document.getElementById("lobby-code").textContent = state.code;
    document.getElementById("lobby-count").textContent = state.players.length;

    const list = document.getElementById("lobby-player-list");
    list.innerHTML = "";
    for (const p of state.players) {
      const li = document.createElement("li");
      const hostTag = p.id === state.hostId ? " (host)" : "";
      li.innerHTML = `<span>${p.name}${hostTag}</span><span class="${p.ready ? "ready" : "not-ready"}">${p.ready ? "Ready" : "Not ready"}</span>`;
      list.appendChild(li);
    }

    const me = state.players.find((p) => p.id === App.myId);
    const readyBtn = document.getElementById("btn-ready");
    readyBtn.textContent = me && me.ready ? "Cancel Ready" : "Ready Up";

    const settingsPanel = document.getElementById("host-settings");
    settingsPanel.classList.toggle("disabled", state.hostId !== App.myId);

    const s = state.settings;
    document.getElementById("set-impostors").value = s.impostorCount;
    document.getElementById("val-impostors").textContent = s.impostorCount;
    document.getElementById("set-tasks").value = s.taskCount;
    document.getElementById("val-tasks").textContent = s.taskCount;
    document.getElementById("set-speed").value = s.movementSpeed;
    document.getElementById("val-speed").textContent = s.movementSpeed.toFixed(2) + "x";
    document.getElementById("set-confirm").checked = s.confirmEjects;
    document.getElementById("set-anon").checked = s.anonymousVotes;

    this.syncRolePoolChecks("pool-crew", s.crewRolePool);
    this.syncRolePoolChecks("pool-impostor", s.impostorRolePool);
    this.syncRolePoolChecks("pool-neutral", s.neutralRoles);

    const allReady = state.players.length > 0 && state.players.every((p) => p.ready);
    document.getElementById("btn-start").disabled = !(allReady && state.players.length >= 4);
  },

  init() {
    document.getElementById("btn-ready").onclick = () => Net.emit("lobby:toggleReady");
    document.getElementById("btn-start").onclick = () => Net.emit("lobby:start");

    document.getElementById("set-preset").onchange = (e) => Net.emit("lobby:applyPreset", e.target.value);

    const push = () => {
      Net.emit("lobby:updateSettings", {
        impostorCount: Number(document.getElementById("set-impostors").value),
        taskCount: Number(document.getElementById("set-tasks").value),
        movementSpeed: Number(document.getElementById("set-speed").value),
        confirmEjects: document.getElementById("set-confirm").checked,
        anonymousVotes: document.getElementById("set-anon").checked,
      });
    };
    ["set-impostors", "set-tasks", "set-speed", "set-confirm", "set-anon"].forEach((id) => {
      document.getElementById(id).addEventListener("change", push);
    });

    this.buildRolePoolChecks("pool-crew", ROLE_CATALOG.crew, "crewRolePool");
    this.buildRolePoolChecks("pool-impostor", ROLE_CATALOG.impostor, "impostorRolePool");
    this.buildRolePoolChecks("pool-neutral", ROLE_CATALOG.neutral, "neutralRoles");
  },

  buildRolePoolChecks(containerId, roles, settingKey) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    for (const role of roles) {
      const label = document.createElement("label");
      label.className = "role-pool-check";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.dataset.roleId = role.id;
      box.addEventListener("change", () => {
        const checked = [...container.querySelectorAll("input:checked")].map((el) => el.dataset.roleId);
        Net.emit("lobby:updateSettings", { [settingKey]: checked });
      });
      label.appendChild(box);
      label.appendChild(document.createTextNode(" " + role.name));
      container.appendChild(label);
    }
  },

  syncRolePoolChecks(containerId, activeIds) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const active = new Set(activeIds || []);
    for (const box of container.querySelectorAll("input[type=checkbox]")) {
      const isActive = active.has(box.dataset.roleId);
      if (document.activeElement !== box) box.checked = isActive;
    }
  },
};

window.addEventListener("DOMContentLoaded", () => Lobby.init());
