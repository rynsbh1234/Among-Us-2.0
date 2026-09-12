const TasksUI = {
  activeTask: null,
  cleanup: null,

  open(task) {
    this.activeTask = task;
    const box = document.getElementById("task-overlay");
    box.hidden = false;
    box.innerHTML = "";

    const title = document.createElement("h3");
    title.textContent = task.label;
    box.appendChild(title);

    const body = document.createElement("div");
    body.className = "task-body";
    box.appendChild(body);

    const cancel = document.createElement("button");
    cancel.className = "ghost";
    cancel.textContent = "Cancel";
    cancel.style.marginTop = "14px";
    cancel.onclick = () => this.close();
    box.appendChild(cancel);

    const builders = { wiring: this.buildWiring, memory: this.buildMemory, calibration: this.buildCalibration, swipe: this.buildSwipe, circuit: this.buildCircuit };
    const builder = builders[task.type] || this.buildWiring;
    this.cleanup = builder.call(this, body) || null;

    this._escHandler = (e) => { if (e.key === "Escape") this.close(); };
    window.addEventListener("keydown", this._escHandler);
  },

  close() {
    document.getElementById("task-overlay").hidden = true;
    if (this.cleanup) this.cleanup();
    this.cleanup = null;
    this.activeTask = null;
    if (this._escHandler) window.removeEventListener("keydown", this._escHandler);
  },

  succeed() {
    const task = this.activeTask;
    if (!task) return;
    Net.emit("player:completeTask", { taskId: task.id, success: true }, (res) => {
      if (res && res.ok) {
        const local = App.myTasks && App.myTasks.find((t) => t.id === task.id);
        if (local) local.done = true;
        HUD.renderTasks();
      }
    });
    this.close();
  },

  // ---- 1. Wiring: connect matching colors ----
  buildWiring(body) {
    const colors = ["#e05252", "#4d8fe0", "#3fae5c", "#e0c23f"];
    const left = shuffleArr(colors.map((c, i) => ({ c, i })));
    const right = shuffleArr(colors.map((c, i) => ({ c, i })));
    let selectedLeft = null;
    let matched = 0;

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.justifyContent = "space-between";
    wrap.style.gap = "60px";
    const colL = document.createElement("div");
    const colR = document.createElement("div");
    wrap.appendChild(colL); wrap.appendChild(colR);
    body.appendChild(wrap);

    const mkBtn = (item, side) => {
      const b = document.createElement("button");
      b.style.display = "block";
      b.style.width = "70px";
      b.style.margin = "8px 0";
      b.style.background = item.c;
      b.dataset.i = item.i;
      b.onclick = () => {
        if (b.disabled) return;
        if (side === "L") { selectedLeft = { btn: b, i: item.i }; return; }
        if (!selectedLeft) return;
        if (selectedLeft.i === item.i) {
          selectedLeft.btn.disabled = true; selectedLeft.btn.style.opacity = 0.3;
          b.disabled = true; b.style.opacity = 0.3;
          matched++;
          selectedLeft = null;
          if (matched >= colors.length) this.succeed();
        } else {
          selectedLeft = null;
        }
      };
      return b;
    };
    left.forEach((item) => colL.appendChild(mkBtn(item, "L")));
    right.forEach((item) => colR.appendChild(mkBtn(item, "R")));
  },

  // ---- 2. Memory: repeat the flashed sequence ----
  buildMemory(body) {
    const colors = ["#e05252", "#4d8fe0", "#3fae5c", "#e0c23f"];
    const seq = Array.from({ length: 4 }, () => Math.floor(Math.random() * colors.length));
    let step = 0;
    let showing = true;

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr 1fr";
    grid.style.gap = "12px";
    grid.style.width = "220px";
    body.appendChild(grid);
    const status = document.createElement("p");
    status.textContent = "Watch the sequence...";
    body.appendChild(status);

    const tiles = colors.map((c) => {
      const t = document.createElement("div");
      t.style.background = c; t.style.height = "70px"; t.style.borderRadius = "8px"; t.style.cursor = "pointer";
      t.style.opacity = 0.5;
      grid.appendChild(t);
      return t;
    });

    let timer = null;
    const playSeq = (i) => {
      if (i >= seq.length) { showing = false; status.textContent = "Your turn - repeat it!"; return; }
      tiles[seq[i]].style.opacity = 1;
      timer = setTimeout(() => {
        tiles[seq[i]].style.opacity = 0.5;
        timer = setTimeout(() => playSeq(i + 1), 220);
      }, 450);
    };
    playSeq(0);

    tiles.forEach((t, idx) => {
      t.onclick = () => {
        if (showing) return;
        if (idx === seq[step]) {
          t.style.opacity = 1; setTimeout(() => (t.style.opacity = 0.5), 200);
          step++;
          if (step >= seq.length) this.succeed();
        } else {
          status.textContent = "Wrong! Watch again...";
          step = 0; showing = true;
          setTimeout(() => playSeq(0), 700);
        }
      };
    });

    return () => { if (timer) clearTimeout(timer); };
  },

  // ---- 3. Calibration: click when the needle is in the zone, 3x in a row ----
  buildCalibration(body) {
    const track = document.createElement("div");
    track.style.position = "relative";
    track.style.width = "260px"; track.style.height = "26px";
    track.style.background = "#232c3a"; track.style.borderRadius = "6px"; track.style.margin = "16px 0";
    const zoneStart = 0.4, zoneEnd = 0.6;
    const zone = document.createElement("div");
    zone.style.position = "absolute"; zone.style.top = 0; zone.style.bottom = 0;
    zone.style.left = zoneStart * 100 + "%"; zone.style.width = (zoneEnd - zoneStart) * 100 + "%";
    zone.style.background = "#3fae5c88";
    track.appendChild(zone);
    const needle = document.createElement("div");
    needle.style.position = "absolute"; needle.style.top = "-4px"; needle.style.width = "4px"; needle.style.height = "34px";
    needle.style.background = "#fff";
    track.appendChild(needle);
    body.appendChild(track);

    const status = document.createElement("p");
    status.textContent = "Locks: 0 / 3";
    body.appendChild(status);
    const btn = document.createElement("button");
    btn.className = "primary";
    btn.textContent = "Lock";
    body.appendChild(btn);

    let t0 = performance.now();
    let raf;
    let pos = 0;
    const tick = (t) => {
      const dt = (t - t0) / 1000;
      pos = (Math.sin(dt * 2.2) + 1) / 2;
      needle.style.left = pos * 100 + "%";
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    let locks = 0;
    btn.onclick = () => {
      if (pos >= zoneStart && pos <= zoneEnd) {
        locks++;
        status.textContent = `Locks: ${locks} / 3`;
        if (locks >= 3) this.succeed();
      } else {
        locks = 0;
        status.textContent = "Missed! Locks: 0 / 3";
      }
    };

    return () => cancelAnimationFrame(raf);
  },

  // ---- 4. Swipe: hold then release inside the target window ----
  buildSwipe(body) {
    const track = document.createElement("div");
    track.style.position = "relative";
    track.style.width = "260px"; track.style.height = "26px";
    track.style.background = "#232c3a"; track.style.borderRadius = "6px"; track.style.margin = "16px 0";
    const zoneStart = 0.55, zoneEnd = 0.75;
    const zone = document.createElement("div");
    zone.style.position = "absolute"; zone.style.top = 0; zone.style.bottom = 0;
    zone.style.left = zoneStart * 100 + "%"; zone.style.width = (zoneEnd - zoneStart) * 100 + "%";
    zone.style.background = "#3fae5c88";
    track.appendChild(zone);
    const marker = document.createElement("div");
    marker.style.position = "absolute"; marker.style.top = "-4px"; marker.style.width = "4px"; marker.style.height = "34px";
    marker.style.background = "#fff"; marker.style.left = "0%";
    track.appendChild(marker);
    body.appendChild(track);

    const status = document.createElement("p");
    status.textContent = "Press and hold, release in the green zone.";
    body.appendChild(status);
    const btn = document.createElement("button");
    btn.className = "primary";
    btn.textContent = "Hold to swipe";
    body.appendChild(btn);

    let raf = null, holding = false, t0 = 0, pos = 0;
    const tick = (t) => {
      pos = Math.min(1, (t - t0) / 1400);
      marker.style.left = pos * 100 + "%";
      if (pos < 1) raf = requestAnimationFrame(tick);
    };
    const start = () => { holding = true; t0 = performance.now(); pos = 0; raf = requestAnimationFrame(tick); };
    const end = () => {
      if (!holding) return;
      holding = false;
      cancelAnimationFrame(raf);
      if (pos >= zoneStart && pos <= zoneEnd) this.succeed();
      else { status.textContent = "Missed the window - try again."; marker.style.left = "0%"; }
    };
    btn.addEventListener("mousedown", start);
    btn.addEventListener("touchstart", (e) => { e.preventDefault(); start(); });
    window.addEventListener("mouseup", end);
    window.addEventListener("touchend", end);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchend", end);
    };
  },

  // ---- 5. Circuit: click nodes in the order briefly shown ----
  buildCircuit(body) {
    const n = 5;
    const order = shuffleArr([...Array(n).keys()]);
    const wrap = document.createElement("div");
    wrap.style.position = "relative"; wrap.style.width = "260px"; wrap.style.height = "180px";
    body.appendChild(wrap);
    const status = document.createElement("p");
    status.textContent = "Memorize the order...";
    body.appendChild(status);

    const positions = Array.from({ length: n }, () => ({ x: 20 + Math.random() * 210, y: 20 + Math.random() * 140 }));
    const nodes = positions.map((pos, idx) => {
      const d = document.createElement("div");
      d.style.position = "absolute"; d.style.left = pos.x + "px"; d.style.top = pos.y + "px";
      d.style.width = "34px"; d.style.height = "34px"; d.style.borderRadius = "50%";
      d.style.background = "#232c3a"; d.style.border = "2px solid #4fd1c5";
      d.style.display = "flex"; d.style.alignItems = "center"; d.style.justifyContent = "center";
      d.style.cursor = "pointer"; d.style.color = "#fff"; d.style.fontWeight = "700";
      wrap.appendChild(d);
      return d;
    });

    let step = 0, showing = true, timer = null;
    const flash = (i) => {
      if (i >= order.length) { showing = false; status.textContent = "Click them back in order!"; return; }
      const node = nodes[order[i]];
      node.style.background = "#4fd1c5";
      timer = setTimeout(() => { node.style.background = "#232c3a"; timer = setTimeout(() => flash(i + 1), 200); }, 500);
    };
    flash(0);

    nodes.forEach((node, idx) => {
      node.onclick = () => {
        if (showing) return;
        if (idx === order[step]) {
          node.style.background = "#3fae5c";
          step++;
          if (step >= order.length) this.succeed();
        } else {
          status.textContent = "Wrong node! Watch again...";
          step = 0; showing = true;
          nodes.forEach((nd) => (nd.style.background = "#232c3a"));
          setTimeout(() => flash(0), 700);
        }
      };
    });

    return () => { if (timer) clearTimeout(timer); };
  },
};

function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
