const GAME_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'Space',
  'KeyR',
  'ShiftLeft',
  'ShiftRight',
]);

export class Input {
  constructor() {
    this.held = new Set();
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
    // Don't leave keys stuck when the tab loses focus.
    window.addEventListener('blur', () => this.held.clear());
  }

  down(code) {
    return this.held.has(code);
  }
}
