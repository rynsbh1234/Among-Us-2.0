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

  draw(overrideState, followId) {
    const ctx = this.ctx;
    const map = App.map;
    const state = overrideState || App.gameState;
    const focusId = followId || App.myId;
    if (!map || !ctx) return;

    const me = state && state.players.find((p) => p.id === focusId);
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

    // task spots (only mine, undone; not applicable during replay)
    if (!overrideState && App.myTasks) {
      for (const t of App.myTasks) {
        if (t.done || t.isFake) continue;
        const wx = t.x * tile + tile / 2, wy = t.y * tile + tile / 2;
        ctx.fillStyle = "#ffd24f";
        ctx.beginPath(); ctx.arc(wx, wy, 10, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#7a5a00"; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // bodies (freshly-discovered ones get a brief expanding ring so a kill nearby reads as an event)
    if (state) {
      if (!this._seenBodies) this._seenBodies = {};
      const nowT = performance.now();
      for (const b of state.bodies) {
        if (this._seenBodies[b.id] === undefined) this._seenBodies[b.id] = nowT;
        const age = nowT - this._seenBodies[b.id];
        ctx.fillStyle = "#8b1a1a";
        ctx.beginPath(); ctx.ellipse(b.x, b.y, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "11px sans-serif";
        ctx.fillText("!", b.x - 2, b.y - 14);
        if (age < 900) {
          const p = age / 900;
          ctx.strokeStyle = `rgba(224,82,82,${1 - p})`;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(b.x, b.y, 16 + p * 26, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }

    // players
    if (state) {
      for (const p of state.players) {
        this.drawPlayer(ctx, p, p.id === focusId);
      }
    }

    ctx.restore();

    this.drawMinimap(state, focusId);
  },

  drawPlayer(ctx, p, isSelf) {
    // Smoothly fade toward the target alpha instead of snapping, so cloak/ghost
    // transitions read as an animation rather than an instant state flip. While
    // mid-fade, flash a grey "desaturated" wash under the token for a cloak-sheet feel.
    const target = p.ghost ? 0.45 : (p.cloaked ? 0.3 : 1);
    if (!this._alpha) this._alpha = {};
    const prev = this._alpha[p.id] !== undefined ? this._alpha[p.id] : target;
    const alpha = prev + (target - prev) * 0.1;
    this._alpha[p.id] = alpha;
    const transitionAmount = Math.min(1, Math.abs(target - alpha) * 4);

    if (transitionAmount > 0.02) {
      ctx.globalAlpha = transitionAmount * 0.5;
      ctx.fillStyle = "#888";
      ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, Math.PI * 2); ctx.fill();
    }

    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color || "#ccc";
    ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = isSelf ? "#fff" : "#0008";
    ctx.lineWidth = isSelf ? 3 : 2;
    if (p.cloaked) ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (p.sick) {
      // pulses faster and redder as the poison gets closer to killing them
      const intensity = p.sickIntensity || 0;
      const speed = 180 - intensity * 90;
      const pulse = 20 + Math.sin(performance.now() / speed) * (4 + intensity * 4);
      const g = Math.round(255 - intensity * 140);
      ctx.strokeStyle = `rgb(124,${g},0)`;
      ctx.lineWidth = 2 + intensity * 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2); ctx.stroke();
    }
    if (p.doused) {
      ctx.strokeStyle = "#ff8c00";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.stroke();
    }
    if (p.hat && !p.ghost) this.drawHat(ctx, p.hat, p.x, p.y);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(p.name, p.x, p.y - 24);
    ctx.textAlign = "left";
  },

  // Cosmetic-only, drawn with plain canvas primitives (no image assets needed).
  drawHat(ctx, hat, x, y) {
    ctx.globalAlpha = 1;
    const top = y - 15;
    switch (hat) {
      case "cap":
        ctx.fillStyle = "#2f4a5c";
        ctx.beginPath(); ctx.arc(x, top, 10, Math.PI, 0); ctx.fill();
        ctx.fillRect(x, top - 2, 14, 4);
        break;
      case "party_hat":
        ctx.fillStyle = "#e07fdc";
        ctx.beginPath(); ctx.moveTo(x, top - 20); ctx.lineTo(x - 10, top); ctx.lineTo(x + 10, top); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#ffd24f";
        ctx.beginPath(); ctx.arc(x, top - 20, 3, 0, Math.PI * 2); ctx.fill();
        break;
      case "top_hat":
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(x - 9, top - 16, 18, 16);
        ctx.fillRect(x - 13, top - 2, 26, 4);
        break;
      case "halo":
        ctx.strokeStyle = "#ffe98a";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(x, top - 12, 10, 4, 0, 0, Math.PI * 2); ctx.stroke();
        break;
      case "devil_horns":
        ctx.fillStyle = "#a01818";
        ctx.beginPath(); ctx.moveTo(x - 9, top); ctx.lineTo(x - 12, top - 12); ctx.lineTo(x - 3, top - 2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 9, top); ctx.lineTo(x + 12, top - 12); ctx.lineTo(x + 3, top - 2); ctx.closePath(); ctx.fill();
        break;
      case "flower":
        ctx.fillStyle = "#ff6fae";
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * 5, top - 8 + Math.sin(a) * 5, 3.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = "#ffd24f";
        ctx.beginPath(); ctx.arc(x, top - 8, 3, 0, Math.PI * 2); ctx.fill();
        break;
      case "jester_hat":
        ctx.fillStyle = "#4fd1c5";
        ctx.beginPath(); ctx.moveTo(x - 10, top); ctx.lineTo(x - 12, top - 16); ctx.lineTo(x - 2, top); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#e0873f";
        ctx.beginPath(); ctx.moveTo(x + 10, top); ctx.lineTo(x + 12, top - 16); ctx.lineTo(x + 2, top); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#ffd24f";
        ctx.beginPath(); ctx.arc(x - 12, top - 16, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 12, top - 16, 2.5, 0, Math.PI * 2); ctx.fill();
        break;
      case "flame_hat":
        ctx.fillStyle = "#ff7a1a";
        ctx.beginPath(); ctx.moveTo(x, top - 18); ctx.quadraticCurveTo(x + 9, top - 6, x, top); ctx.quadraticCurveTo(x - 9, top - 6, x, top - 18); ctx.fill();
        ctx.fillStyle = "#ffd24f";
        ctx.beginPath(); ctx.moveTo(x, top - 12); ctx.quadraticCurveTo(x + 4, top - 6, x, top - 2); ctx.quadraticCurveTo(x - 4, top - 6, x, top - 12); ctx.fill();
        break;
      default:
        break;
    }
  },

  drawMinimap(state, focusId) {
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
        if (p.ghost && p.id !== focusId) continue;
        ctx.fillStyle = p.id === focusId ? "#fff" : p.color;
        ctx.beginPath();
        ctx.arc(x0 + p.x * scale, y0 + p.y * scale, p.id === focusId ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
};

window.addEventListener("DOMContentLoaded", () => Render.init());
