const GAME_KEYS = new Set(['KeyW', 'KeyS', 'KeyR', 'ShiftLeft', 'ShiftRight']);

export class Input {
  constructor(canvas) {
    this.held = new Set();
    // Mouse state, in canvas-internal (world-scale) pixels. null until the
    // first move so the plane holds heading before the player touches it.
    this.mouseX = null;
    this.mouseY = null;
    this.buttons = new Set(); // 0 = left (fire), 2 = right (special)

    window.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code)) {
        e.preventDefault();
        this.held.add(e.code);
      }
    });
    window.addEventListener('keyup', (e) => {
      if (GAME_KEYS.has(e.code)) {
        e.preventDefault();
        this.held.delete(e.code);
      }
    });
    // Don't leave keys/buttons stuck when the tab loses focus.
    window.addEventListener('blur', () => {
      this.held.clear();
      this.buttons.clear();
    });

    if (canvas) {
      window.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        this.mouseX = ((e.clientX - rect.left) * canvas.width) / rect.width;
        this.mouseY = ((e.clientY - rect.top) * canvas.height) / rect.height;
      });
      window.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.buttons.add(e.button);
      });
      window.addEventListener('mouseup', (e) => this.buttons.delete(e.button));
      // Right button is the special — keep the browser menu out of the way.
      window.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  down(code) {
    return this.held.has(code);
  }

  get fireDown() {
    return this.buttons.has(0);
  }

  get specialDown() {
    return this.buttons.has(2);
  }
}
