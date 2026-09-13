// Post-match replay viewer. Reuses the live game screen + Render module (fed a
// recorded frame instead of App.gameState) so we don't duplicate the map/player
// drawing code. Game.loop() and sendInput() both bail out while Replay.active.
const Replay = {
  active: false,
  frames: [],
  timeline: [],
  index: 0,
  playing: true,
  speed: 1,
  followId: null,
  _accum: 0,
  _lastTick: 0,

  init() {
    document.getElementById("replay-playpause").onclick = () => this.togglePlay();
    document.getElementById("replay-scrub").oninput = (e) => this.seek(Number(e.target.value));
    document.getElementById("replay-speed").onchange = (e) => { this.speed = Number(e.target.value); };
    document.getElementById("replay-follow-prev").onclick = () => this.cycleFollow(-1);
    document.getElementById("replay-follow-next").onclick = () => this.cycleFollow(1);
    document.getElementById("replay-close").onclick = () => this.stop();
  },

  start(frames, timeline) {
    if (!frames || frames.length === 0) return;
    this.frames = frames;
    this.timeline = timeline || [];
    this.index = 0;
    this._accum = 0;
    this.playing = true;
    this.speed = 1;
    document.getElementById("replay-speed").value = "1";
    this.followId = frames[0].players[0] ? frames[0].players[0].id : null;
    this.active = true;

    document.body.classList.add("replay-mode");
    document.getElementById("replay-controls").hidden = false;
    App.showScreen("game");

    const scrub = document.getElementById("replay-scrub");
    scrub.max = String(this.frames.length - 1);
    scrub.value = "0";

    this.renderEvents();
    this.updateFollowLabel();
    this._updatePlayPauseLabel();
    this._lastTick = performance.now();
    this._loop();
  },

  stop() {
    this.active = false;
    document.body.classList.remove("replay-mode");
    document.getElementById("replay-controls").hidden = true;
    App.showScreen("end");
  },

  _loop() {
    if (!this.active) return;
    requestAnimationFrame(() => this._loop());
    const now = performance.now();
    const dt = (now - this._lastTick) / 1000;
    this._lastTick = now;

    if (this.playing) {
      this._accum += dt * this.speed; // frames are recorded at 1Hz
      while (this._accum >= 1 && this.index < this.frames.length - 1) {
        this._accum -= 1;
        this.index++;
      }
      document.getElementById("replay-scrub").value = String(this.index);
      if (this.index >= this.frames.length - 1) { this.playing = false; this._updatePlayPauseLabel(); }
    }

    const frame = this.frames[this.index];
    if (frame) {
      Render.draw(frame, this.followId);
      document.getElementById("replay-clock").textContent = this._fmt(frame.t);
      this.updateFollowLabel();
    }
  },

  _fmt(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  },

  togglePlay() {
    this.playing = !this.playing;
    this._updatePlayPauseLabel();
  },
  _updatePlayPauseLabel() {
    document.getElementById("replay-playpause").textContent = this.playing ? "Pause" : "Play";
  },

  seek(index) {
    this.index = Math.max(0, Math.min(this.frames.length - 1, index));
    this._accum = 0;
  },

  cycleFollow(dir) {
    const frame = this.frames[this.index];
    if (!frame || frame.players.length === 0) return;
    const ids = frame.players.map((p) => p.id);
    let i = ids.indexOf(this.followId);
    i = (i + dir + ids.length) % ids.length;
    this.followId = ids[i];
    this.updateFollowLabel();
  },

  updateFollowLabel() {
    const frame = this.frames[this.index];
    const p = frame && frame.players.find((x) => x.id === this.followId);
    document.getElementById("replay-follow-name").textContent = p ? p.name : "-";
  },

  renderEvents() {
    const box = document.getElementById("replay-events");
    box.innerHTML = "";
    for (const e of this.timeline) {
      const d = document.createElement("div");
      d.className = "replay-event";
      d.textContent = `[${this._fmt(e.t)}] ${e.text}`;
      d.onclick = () => {
        let idx = this.frames.findIndex((f) => f.t >= e.t);
        if (idx === -1) idx = this.frames.length - 1;
        this.seek(idx);
      };
      box.appendChild(d);
    }
  },
};

window.addEventListener("DOMContentLoaded", () => Replay.init());
