import type { BattleSnapshot } from '../model';

/** Buffer authoritative snapshots. Only position is interpolated; HP, phase and existence use the earlier frame. */
export class SnapshotBuffer {
  private frames: BattleSnapshot[] = [];
  private battleId = '';
  private previousTick = 0;
  private currentTick = 0;
  private initialized = false;
  readonly delayTicks = 2;
  get latest(): BattleSnapshot | undefined { return this.frames.at(-1); }
  clear(): void { this.frames = []; this.battleId = ''; this.initialized = false; }
  push(frame: BattleSnapshot): boolean {
    if (frame.battleId !== this.battleId) { this.clear(); this.battleId = frame.battleId; }
    const tick = Number(frame.serverTick); // Only bounded per-match ticks, never IDs.
    if (!Number.isSafeInteger(tick) || tick < 0 || !Number.isFinite(frame.width) || frame.width < 200) return false;
    if (frame.combatants.some(c => !Number.isFinite(c.centerX) || !Number.isFinite(c.feetY))
      || frame.projectiles.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return false;
    const latest = this.latest;
    if (latest && Number(latest.serverTick) > tick) return false;
    if (latest && Number(latest.serverTick) === tick) this.frames[this.frames.length - 1] = frame;
    else this.frames.push(frame);
    if (this.frames.length > 120) this.frames.shift();
    if (!this.initialized) {
      this.previousTick = this.currentTick = Math.max(0, tick - this.delayTicks);
      this.initialized = true;
    }
    return true;
  }
  step(seconds: number): void {
    if (!this.latest) return;
    this.previousTick = this.currentTick;
    const newest = Number(this.latest.serverTick);
    if (newest - this.currentTick > 12) {
      // No replay of old damage/input: rebase presentation after a long stall.
      this.previousTick = this.currentTick = Math.max(0, newest - this.delayTicks);
    } else this.currentTick = Math.min(newest, this.currentTick + seconds * (this.latest.tickRate || 30));
  }
  rebase(): void {
    if (this.latest) this.previousTick = this.currentTick = Math.max(0, Number(this.latest.serverTick) - this.delayTicks);
  }
  sample(alpha: number): BattleSnapshot | undefined {
    if (!this.latest) return undefined;
    const renderTick = this.previousTick + (this.currentTick - this.previousTick) * alpha;
    const first = this.frames[0];
    if (renderTick < Number(first.serverTick)) return first;
    let before = first;
    for (const after of this.frames) {
      if (Number(after.serverTick) <= renderTick) { before = after; continue; }
      const range = Number(after.serverTick) - Number(before.serverTick);
      const t = range ? Math.max(0, Math.min(1, (renderTick - Number(before.serverTick)) / range)) : 0;
      const nextCombatants = new Map(after.combatants.map(c => [c.entityId, c]));
      const nextProjectiles = new Map(after.projectiles.map(p => [p.instanceId, p]));
      return {
        ...before,
        presentationTick: renderTick,
        combatants: before.combatants.map(c => {
          const next = nextCombatants.get(c.entityId);
          return next ? { ...c, centerX: mix(c.centerX, next.centerX, t), feetY: mix(c.feetY, next.feetY, t) } : c;
        }),
        projectiles: before.projectiles.map(p => {
          const next = nextProjectiles.get(p.instanceId);
          return next ? { ...p, x: mix(p.x, next.x, t), y: mix(p.y, next.y, t) } : p;
        }),
      };
    }
    return this.latest; // Freeze at last known state, no unbounded extrapolation.
  }
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
