// Persistent server-side account: identity (username + a device token saved in
// localStorage), stats/achievements, cosmetics, and friends. Progression is now
// recorded server-side at match end (see accounts.js), not client-trusted.
const Account = {
  state: null,

  init() {
    Net.on("account:state", ({ account }) => { this.state = account; this.render(); });
    Net.on("account:error", ({ message }) => { this.showProfileError(message); });
    Net.on("account:registered", ({ deviceToken }) => {
      try { localStorage.setItem("crewline_device_token", deviceToken); } catch (e) { /* ignore */ }
    });
    Net.on("account:friendStatus", ({ id, online }) => {
      if (!this.state) return;
      const f = this.state.friends.find((x) => x.id === id);
      if (f) { f.online = online; this.renderFriends(); }
    });
    Net.on("account:matchResult", ({ newlyUnlocked, account }) => {
      this.state = account;
      this.render();
      this.renderEndAchievements(newlyUnlocked);
    });
    Net.socket.on("connect", () => this.authenticate());

    document.getElementById("btn-toggle-profile").onclick = () => {
      const panel = document.getElementById("profile-panel");
      panel.hidden = !panel.hidden;
    };
    document.getElementById("btn-rename").onclick = () => {
      const name = document.getElementById("profile-username-input").value.trim();
      if (!name) return;
      Net.emit("account:rename", { username: name }, (res) => {
        if (res && res.error) this.showProfileError(res.error);
      });
    };
    document.getElementById("btn-add-friend").onclick = () => {
      const input = document.getElementById("friend-username-input");
      const name = input.value.trim();
      if (!name) return;
      Net.emit("account:addFriend", { username: name }, (res) => {
        if (res && res.error) this.showProfileError(res.error);
        else input.value = "";
      });
    };
  },

  authenticate() {
    let token = null;
    try { token = localStorage.getItem("crewline_device_token"); } catch (e) { /* private mode */ }
    if (token) {
      Net.emit("account:login", { deviceToken: token });
    } else {
      const guest = "Guest" + Math.floor(1000 + Math.random() * 9000);
      Net.emit("account:register", { username: guest });
    }
  },

  showProfileError(message) {
    const el = document.getElementById("profile-error");
    if (el) el.textContent = message;
  },

  render() {
    if (!this.state) return;
    const nameInput = document.getElementById("input-name");
    if (nameInput && !nameInput.value) nameInput.value = this.state.username;
    document.getElementById("profile-username-input").value = this.state.username;

    const statsEl = document.getElementById("menu-stats");
    statsEl.textContent = this.state.stats.gamesPlayed > 0
      ? `${this.state.username} · Games played: ${this.state.stats.gamesPlayed} · Wins: ${this.state.stats.gamesWon}`
      : this.state.username;

    this.renderCosmeticPickers();
    this.renderAchievements();
    this.renderFriends();
  },

  renderCosmeticPickers() {
    const hatBox = document.getElementById("hat-picker");
    hatBox.innerHTML = "";
    const noneBtn = document.createElement("button");
    noneBtn.textContent = "No Hat";
    noneBtn.className = this.state.equippedHat ? "" : "selected";
    noneBtn.onclick = () => this.setCosmetics({ hat: null });
    hatBox.appendChild(noneBtn);
    for (const hat of HAT_CATALOG) {
      const unlocked = this.state.unlockedHats.includes(hat.id);
      const btn = document.createElement("button");
      btn.textContent = unlocked ? hat.name : `${hat.name} (locked)`;
      btn.disabled = !unlocked;
      btn.className = this.state.equippedHat === hat.id ? "selected" : "";
      btn.onclick = () => this.setCosmetics({ hat: hat.id });
      hatBox.appendChild(btn);
    }

    const colorBox = document.getElementById("color-picker");
    colorBox.innerHTML = "";
    for (const color of COLOR_PALETTE) {
      const swatch = document.createElement("button");
      swatch.className = "color-swatch" + (this.state.preferredColor === color ? " selected" : "");
      swatch.style.background = color;
      swatch.onclick = () => this.setCosmetics({ color });
      colorBox.appendChild(swatch);
    }
  },

  setCosmetics(payload) {
    Net.emit("account:setCosmetics", payload, (res) => {
      if (res && res.error) this.showProfileError(res.error);
    });
  },

  renderAchievements() {
    const box = document.getElementById("profile-achievements");
    box.innerHTML = "";
    if (this.state.achievements.length === 0) {
      box.textContent = "None yet - play a match!";
      return;
    }
    for (const id of this.state.achievements) {
      const badge = document.createElement("span");
      badge.className = "achievement-badge";
      badge.textContent = id.replace(/_/g, " ");
      box.appendChild(badge);
    }
  },

  renderFriends() {
    const list = document.getElementById("friend-list");
    list.innerHTML = "";
    for (const f of this.state.friends) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${f.online ? "\u{1F7E2}" : "⚪"} ${f.username}</span>`;
      const btn = document.createElement("button");
      btn.textContent = "Remove";
      btn.onclick = () => Net.emit("account:removeFriend", { friendId: f.id });
      li.appendChild(btn);
      list.appendChild(li);
    }
  },

  renderEndAchievements(newlyUnlocked) {
    const el = document.getElementById("end-achievements");
    if (!el) return;
    el.innerHTML = "";
    if (!newlyUnlocked || newlyUnlocked.length === 0) return;
    const label = document.createElement("div");
    label.className = "hint";
    label.textContent = "Achievement unlocked:";
    el.appendChild(label);
    for (const name of newlyUnlocked) {
      const badge = document.createElement("span");
      badge.className = "achievement-badge";
      badge.textContent = name;
      el.appendChild(badge);
    }
  },
};

window.addEventListener("DOMContentLoaded", () => Account.init());
