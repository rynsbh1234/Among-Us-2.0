// On-screen virtual joystick for touch devices. Feeds Game.touchVector, which
// sendInput() blends in alongside WASD/arrow-key input.
const TouchControls = {
  isTouchDevice() {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  },

  init() {
    if (!this.isTouchDevice()) return;
    const zone = document.getElementById("touch-joystick-zone");
    const stick = document.getElementById("touch-joystick-stick");
    const radius = 50;
    let activeTouchId = null;

    const setStick = (dx, dy) => {
      stick.style.left = 34 + dx * radius + "px";
      stick.style.top = 34 + dy * radius + "px";
    };

    const update = (touch) => {
      const rect = zone.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = (touch.clientX - cx) / radius;
      let dy = (touch.clientY - cy) / radius;
      const mag = Math.hypot(dx, dy);
      if (mag > 1) { dx /= mag; dy /= mag; }
      Game.touchVector = { dx, dy };
      setStick(dx, dy);
    };

    const reset = () => {
      activeTouchId = null;
      Game.touchVector = null;
      setStick(0, 0);
    };

    zone.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      activeTouchId = t.identifier;
      update(t);
    }, { passive: false });

    zone.addEventListener("touchmove", (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === activeTouchId) update(t);
      }
    }, { passive: false });

    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === activeTouchId) reset();
      }
    };
    zone.addEventListener("touchend", end);
    zone.addEventListener("touchcancel", end);

    document.getElementById("touch-controls").hidden = false;
  },
};

window.addEventListener("DOMContentLoaded", () => TouchControls.init());
