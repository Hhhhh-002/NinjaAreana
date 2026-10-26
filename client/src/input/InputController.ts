export interface InputActions { move(axis: number): void; block(active: boolean): void; jump(): void; skill(key: string): void }
/** Keyboard and pointer holds share one state. Blur/visibility/focus changes release every held input. */
export class InputController {
  private held = new Map<string, string>();
  private axis = 0;
  private blocking = false;
  private active = false;
  constructor(private readonly actions: InputActions) {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.release);
    document.addEventListener('visibilitychange', this.release);
    document.addEventListener('focusin', event => { if (this.editing(event.target)) this.release(); });
  }
  setEnabled(active: boolean): void { if (!active) this.release(); this.active = active; }
  private blockedByDialog(): boolean { return !!document.querySelector('dialog[open]'); }
  private editing(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && (!!target.closest('input,textarea,select,[contenteditable=true],dialog[open]'));
  }
  private down = (event: KeyboardEvent) => {
    if (!this.active || this.blockedByDialog() || this.editing(event.target) || event.ctrlKey || event.altKey || event.metaKey) return;
    const key = ({ KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      KeyW: 'jump', ArrowUp: 'jump', Space: 'jump', KeyK: 'block', KeyU: 'U', KeyI: 'I', KeyJ: 'J', KeyL: 'L' } as Record<string, string>)[event.code];
    if (!key) return;
    event.preventDefault();
    if (event.repeat) return;
    this.press(key, `keyboard:${event.code}`);
  };
  private up = (event: KeyboardEvent) => {
    const key = ({ KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyK: 'block' } as Record<string, string>)[event.code];
    if (key) this.lift(key, `keyboard:${event.code}`);
  };
  press(key: string, source = key): void {
    if (!this.active || this.blockedByDialog()) return;
    if (['left', 'right', 'block'].includes(key)) { this.held.set(source, key); this.flush(); }
    else if (key === 'jump') this.actions.jump();
    else this.actions.skill(key);
  }
  lift(key: string, source = key): void { this.held.delete(source); this.flush(); }
  release = (): void => { this.held.clear(); this.flush(); };
  private flush(): void {
    const keys = new Set(this.held.values());
    const axis = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    const block = keys.has('block');
    if (axis !== this.axis) { this.axis = axis; this.actions.move(axis); }
    if (block !== this.blocking) { this.blocking = block; this.actions.block(block); }
  }
  /** Callers should bind each hold button once. Pointer capture handles releases outside the button. */
  bindButton(button: HTMLElement, key: string): void {
    button.addEventListener('pointerdown', event => {
      if (!this.active || (button instanceof HTMLButtonElement && button.disabled)) return;
      event.preventDefault(); button.setPointerCapture(event.pointerId); this.press(key, `pointer:${event.pointerId}`);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, event => this.lift(key, `pointer:${(event as PointerEvent).pointerId}`));
    // Native keyboard activation still works for accessible buttons.
    button.addEventListener('click', event => { if (event.detail === 0) { this.press(key); this.lift(key); } });
  }
}
