/** One RAF owns the frame. At most 10 fixed updates, then one interpolated render. */
export class FixedStepClock {
  private last?: number;
  private accumulator = 0;
  public droppedSteps = 0;
  constructor(public readonly hz = 30, public readonly maxCatchUp = 10) {}
  reset(): void { this.last = undefined; this.accumulator = 0; }
  advance(now: number, update: (seconds: number) => void): { steps: number; alpha: number; dropped: number } {
    if (this.last === undefined) { this.last = now; return { steps: 0, alpha: 0, dropped: 0 }; }
    const delta = Math.max(0, now - this.last);
    this.last = now;
    this.accumulator += delta;
    const step = 1000 / this.hz;
    let steps = 0;
    while (this.accumulator + 1e-7 >= step && steps < this.maxCatchUp) {
      update(1 / this.hz);
      this.accumulator -= step;
      steps++;
    }
    const dropped = Math.floor((this.accumulator + 1e-7) / step);
    if (dropped > 0) { this.accumulator -= dropped * step; this.droppedSteps += dropped; }
    return { steps, alpha: Math.max(0, Math.min(1, this.accumulator / step)), dropped };
  }
}
export class FixedStepLoop {
  readonly clock = new FixedStepClock(30, 10);
  private handle = 0;
  private running = false;
  fps = 0;
  lastSteps = 0;
  constructor(private readonly update: (seconds: number) => void,
    private readonly render: (alpha: number, elapsedSeconds: number, dropped: number) => void) {}
  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.reset();
    let last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      const elapsed = Math.max(0, now - last) / 1000;
      last = now;
      const result = this.clock.advance(now, this.update);
      this.lastSteps = result.steps;
      if (elapsed > 0) this.fps = this.fps * 0.9 + (1 / elapsed) * 0.1;
      this.render(result.alpha, elapsed, result.dropped);
      this.handle = requestAnimationFrame(frame);
    };
    this.handle = requestAnimationFrame(frame);
  }
  stop(): void { this.running = false; cancelAnimationFrame(this.handle); this.clock.reset(); }
}
