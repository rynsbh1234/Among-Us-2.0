const Render = {
  canvas: null,
  ctx: null,

  init() {
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d");
    const resize = () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();
  },

  worldBounds() {
    const m = App.map;
    return { w: m.gridW * m.tile, h: m.gridH * m.tile };
  },

  draw() {
    const ctx = this.ctx;
    const map = App.map;
    const state = App.gameState;
    if (!map || !ctx) return;

    const me = state && state.players.find((p) => p.id === App.myId);
    const camX = me ? me.x : (map.gridW * map.tile) / 2;
    const camY = me ? me.y : (map.gridH * map.tile) / 2;
    const cw = this.canvas.width, ch = this.canvas.height;
    const ox = cw / 2 - camX, oy = ch / 2 - camY;

    ctx.fillStyle = "#05070b";
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.translate(ox, oy);

    // floor tiles (only draw the ones roughly on-screen)
    const tile = map.tile;
    const startTx = Math.max(0, Math.floor((camX - cw / 2) / tile) - 1);
    const endTx = Math.min(map.gridW, Math.floor((camX + cw / 2) / tile) + 1);
    const startTy = Math.max(0, Math.floor((camY - ch / 2) / tile) - 1);
    const endTy = Math.min(map.gridH, Math.floor((camY + ch / 2) / tile) + 1);
    ctx.fillStyle = "#171e29";
    for (let ty = startTy; ty < endTy; ty++) {
      for (let tx = startTx; tx < endTx; tx++) {
        if (map.walkable[ty] && map.walkable[ty][tx]) {
          ctx.fillRect(tx * tile, ty * tile, tile - 1, tile - 1);
        }
      }
    }

    // room tints + labels
    for (const r of map.rooms) {
      ctx.fillStyle = r.color + "55";
      ctx.fillRect(r.x * tile, r.y * tile, r.w * tile, r.h * tile);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x * tile, r.y * tile, r.w * tile, r.h * tile);
      ctx.fillStyle = "#c8d3e0";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(r.name.toUpperCase(), r.x * tile + 10, r.y * tile + 20);
    }

    // vents
    for (const v of map.vents) {
      const wx = v.x * tile + tile / 2, wy = v.y * tile + tile / 2;
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(wx, wy, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#555"; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(wx - 10, wy + i * 6); ctx.lineTo(wx + 10, wy + i * 6); ctx.stroke(); }
    }

    // sabotage panels
    for (const p of map.sabotagePanels) {
      const wx = p.x * tile + tile / 2, wy = p.y * tile + tile / 2;
      const active = state && state.sabotages && state.sabotages[p.type] && state.sabotages[p.type].active;
      ctx.fillStyle = active ? "#ff4444" : "#446";
      ctx.fillRect(wx - 10, wy - 10, 20, 20);
      ctx.strokeStyle = "#fff"; ctx.strokeRect(wx - 10, wy - 10, 20, 20);
    }

    // emergency button
    {
      const wx = map.emergencyButton.x * tile + tile / 2, wy = map.emergencyButton.y * tile + tile / 2;
      ctx.fillStyle = "#e05252";
      ctx.beginPath(); ctx.arc(wx, wy, 18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke();
    }

    // task spots (only mine, undone)
    if (App.myTasks) {
      for (const t of App.myTasks) {
        if (t.done || t.isFake) continue;
        const wx = t.x * tile + tile / 2, wy = t.y * tile + tile / 2;
        ctx.fillStyle = "#ffd24f";
        ctx.beginPath(); ctx.arc(wx, wy, 10, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#7a5a00"; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // bodies
    if (state) {
      for (const b of state.bodies) {
        ctx.fillStyle = "#8b1a1a";
        ctx.beginPath(); ctx.ellipse(b.x, b.y, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "11px sans-serif";
        ctx.fillText("!", b.x - 2, b.y - 14);
      }
    }

    // players
    if (state) {
      for (const p of state.players) {
        this.drawPlayer(ctx, p, p.id === App.myId);
      }
    }

    ctx.restore();

    this.drawMinimap(state);
  },

  drawPlayer(ctx, p, isSelf) {
    const alpha = p.ghost ? 0.45 : (p.cloaked ? 0.35 : 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color || "#ccc";
    ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = isSelf ? "#fff" : "#0008";
    ctx.lineWidth = isSelf ? 3 : 2;
    if (p.cloaked) ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (p.sick) {
      ctx.strokeStyle = "#7CFC00";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2); ctx.stroke();
    }
    if (p.doused) {
      ctx.strokeStyle = "#ff8c00";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.name, p.x, p.y - 24);
    ctx.textAlign = "left";
  },

  drawMinimap(state) {
    const ctx = this.ctx;
    const map = App.map;
    const size = 170, pad = 16;
    const x0 = this.canvas.width - size - pad, y0 = pad;
    const scale = size / (map.gridW * map.tile);

    ctx.fillStyle = "rgba(10,14,20,.85)";
    ctx.fillRect(x0, y0, size, size * (map.gridH / map.gridW));
    ctx.strokeStyle = "#2a3444"; ctx.strokeRect(x0, y0, size, size * (map.gridH / map.gridW));

    for (const r of map.rooms) {
      ctx.fillStyle = r.color + "aa";
      ctx.fillRect(x0 + r.x * map.tile * scale, y0 + r.y * map.tile * scale, r.w * map.tile * scale, r.h * map.tile * scale);
    }
    if (state) {
      for (const p of state.players) {
        if (p.ghost && p.id !== App.myId) continue;
        ctx.fillStyle = p.id === App.myId ? "#fff" : p.color;
        ctx.beginPath();
        ctx.arc(x0 + p.x * scale, y0 + p.y * scale, p.id === App.myId ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
};

window.addEventListener("DOMContentLoaded", () => Render.init());
