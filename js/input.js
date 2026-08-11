const KEY_LEFT = new Set(["ArrowLeft", "a", "A"]);
const KEY_RIGHT = new Set(["ArrowRight", "d", "D"]);
const KEY_UP = new Set(["ArrowUp", "w", "W"]);
const KEY_DOWN = new Set(["ArrowDown", "s", "S"]);
const KEY_BOMB = new Set([" ", "Spacebar"]);
const KEY_PAUSE = new Set(["Escape", "p", "P"]);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.axisX = 0;
    this.axisY = 0;
    this.pointerActive = false;
    this.pointerX = null;
    this.pointerY = null;
    this._bombPressed = false;
    this._pausePressed = false;
    this.isTouch = window.matchMedia("(pointer: coarse)").matches;

    this._keysDown = new Set();
    this.onFirstInput = null;
    this._firstInputFired = false;

    window.addEventListener("keydown", (e) => this._onKeyDown(e));
    window.addEventListener("keyup", (e) => this._onKeyUp(e));

    canvas.addEventListener("pointerdown", (e) => this._onPointerDown(e), { passive: false });
    canvas.addEventListener("pointermove", (e) => this._onPointerMove(e), { passive: false });
    window.addEventListener("pointerup", (e) => this._onPointerUp(e));
    window.addEventListener("pointercancel", (e) => this._onPointerUp(e));

    canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
  }

  _fireFirst() {
    if (!this._firstInputFired) {
      this._firstInputFired = true;
      if (this.onFirstInput) this.onFirstInput();
    }
  }

  _onKeyDown(e) {
    this._fireFirst();
    this._keysDown.add(e.key);
    if (KEY_BOMB.has(e.key)) { this._bombPressed = true; e.preventDefault(); }
    if (KEY_PAUSE.has(e.key)) { this._pausePressed = true; }
    this._recompute();
  }

  _onKeyUp(e) {
    this._keysDown.delete(e.key);
    this._recompute();
  }

  _recompute() {
    let x = 0, y = 0;
    for (const k of this._keysDown) {
      if (KEY_LEFT.has(k)) x -= 1;
      if (KEY_RIGHT.has(k)) x += 1;
      if (KEY_UP.has(k)) y -= 1;
      if (KEY_DOWN.has(k)) y += 1;
    }
    this.axisX = Math.max(-1, Math.min(1, x));
    this.axisY = Math.max(-1, Math.min(1, y));
  }

  _onPointerDown(e) {
    this._fireFirst();
    if (e.target && e.target.closest && e.target.closest(".bomb-btn, .icon-btn")) return;
    this.pointerActive = true;
    this.pointerX = e.clientX;
    this.pointerY = e.clientY;
  }

  _onPointerMove(e) {
    if (!this.pointerActive) return;
    this.pointerX = e.clientX;
    this.pointerY = e.clientY;
  }

  _onPointerUp() {
    this.pointerActive = false;
    this.pointerX = null;
    this.pointerY = null;
  }

  consumeBomb() {
    const v = this._bombPressed;
    this._bombPressed = false;
    return v;
  }

  triggerBomb() {
    this._fireFirst();
    this._bombPressed = true;
  }

  consumePause() {
    const v = this._pausePressed;
    this._pausePressed = false;
    return v;
  }
}
