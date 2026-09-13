const MeetingUI = {
  state: null,
  timerHandle: null,

  init() {
    Net.on("game:meetingStarted", (payload) => this.open(payload));
    Net.on("game:votingStarted", (payload) => this.startVoting(payload));
    Net.on("game:meetingResult", (payload) => this.showResult(payload));
    Net.on("chat:message", (payload) => this.appendChat(payload));

    document.getElementById("btn-chat-send").onclick = () => this.sendChat();
    document.getElementById("chat-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.sendChat();
    });
  },

  sendChat() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;
    Net.emit("chat:send", { text });
    input.value = "";
  },

  open(payload) {
    this.state = { phase: "discussion", alive: payload.alive, discussionEndsAt: payload.discussionEndsAt, votingEndsAt: null, voted: false };
    document.getElementById("meeting-title").textContent = payload.reason === "emergency"
      ? `${payload.callerName} called an emergency meeting`
      : `${payload.callerName} reported a body in ${payload.roomName}`;
    document.getElementById("chat-log").innerHTML = "";
    document.getElementById("vote-result").hidden = true;
    document.getElementById("ejection-scene").hidden = true;
    App.showScreen("meeting");
    this.renderPlayers();
    this.startTimerLoop();

    if (payload.reason === "emergency") {
      const screen = document.getElementById("screen-meeting");
      screen.classList.add("alarm");
      setTimeout(() => screen.classList.remove("alarm"), 1300);
    }
  },

  startVoting(payload) {
    if (!this.state) return;
    this.state.phase = "voting";
    this.state.votingEndsAt = payload.votingEndsAt;
    this.renderPlayers();
  },

  startTimerLoop() {
    if (this.timerHandle) clearInterval(this.timerHandle);
    const el = document.getElementById("meeting-timer");
    this.timerHandle = setInterval(() => {
      if (!this.state) return;
      const end = this.state.phase === "voting" ? this.state.votingEndsAt : this.state.discussionEndsAt;
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      el.textContent = remaining;
    }, 250);
  },

  renderPlayers() {
    const container = document.getElementById("meeting-players");
    container.innerHTML = "";
    const iAmAlive = App.amIAlive !== false;
    const canVote = this.state.phase === "voting" && iAmAlive && !this.state.voted;

    for (const p of this.state.alive) {
      const card = document.createElement("div");
      card.className = "vote-card";
      const left = document.createElement("div");
      left.className = "name-dot";
      left.innerHTML = `<span class="dot" style="background:${p.color}"></span><span>${p.name}</span>`;
      card.appendChild(left);
      if (canVote && p.id !== App.myId) {
        const btn = document.createElement("button");
        btn.textContent = "Vote";
        btn.onclick = () => this.castVote(p.id, card);
        card.appendChild(btn);
      }
      container.appendChild(card);
    }
    if (canVote) {
      const skipCard = document.createElement("div");
      skipCard.className = "vote-card";
      skipCard.innerHTML = `<div class="name-dot"><span>Skip Vote</span></div>`;
      const btn = document.createElement("button");
      btn.textContent = "Skip";
      btn.onclick = () => this.castVote(null, skipCard);
      skipCard.appendChild(btn);
      container.appendChild(skipCard);
    }
  },

  castVote(targetId, card) {
    if (this.state.voted) return;
    this.state.voted = true;
    Net.emit("player:vote", { targetId });
    for (const c of document.querySelectorAll(".vote-card button")) c.disabled = true;
    card.classList.add("selected");
  },

  appendChat({ from, color, text, dead }) {
    const log = document.getElementById("chat-log");
    const line = document.createElement("div");
    line.className = "chat-line" + (dead ? " ghost" : "");
    line.innerHTML = `<span class="from" style="color:${color || "#fff"}">${from}${dead ? " (dead)" : ""}:</span> ${escapeHtml(text)}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  },

  showResult(payload) {
    if (this.timerHandle) clearInterval(this.timerHandle);
    const ejectedPlayer = payload.ejectedId && this.state
      ? this.state.alive.find((p) => p.id === payload.ejectedId)
      : null;
    this.state = null;

    const box = document.getElementById("vote-result");
    const scene = document.getElementById("ejection-scene");

    const finish = () => {
      box.hidden = false;
      box.textContent = payload.ejectedId
        ? `${payload.ejectedName} was ejected. ${payload.revealText}`
        : "No one was ejected.";
      setTimeout(() => {
        if (App.current === "meeting") App.showScreen("game");
      }, 3200);
    };

    if (!payload.ejectedId) return finish();

    const dot = document.getElementById("ejection-dot");
    const text = document.getElementById("ejection-text");
    dot.style.background = (ejectedPlayer && ejectedPlayer.color) || "#ccc";
    dot.style.animation = "none";
    void dot.offsetHeight;
    dot.style.animation = "";
    text.textContent = `${payload.ejectedName} was ejected...`;
    scene.hidden = false;
    setTimeout(() => {
      scene.hidden = true;
      finish();
    }, 2200);
  },
};

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

window.addEventListener("DOMContentLoaded", () => MeetingUI.init());
