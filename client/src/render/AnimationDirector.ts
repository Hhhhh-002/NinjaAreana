import { skillById } from '../catalog';
import type { Cast, Combatant, CombatEvent } from '../model';
import type { AvatarAction, AvatarContext } from './AvatarView';
import { animations } from './SpineAssets';

export interface AnimationLayer { name: string; seconds: number; loop: boolean }
export class AnimationDirector {
  private base = '';
  private baseTime = 0;
  private baseStart = 0;
  private clock = 0;
  private previousAir = false;
  private previousBlocking = false;
  private reaction?: string;
  private reactionTime = 0;
  private reactionTick?: number;
  private castId = '';
  private airCast = false;
  private dead = false;
  private deathTime = 0;
  constructor(private readonly heroId: number) {}
  react(event: CombatEvent): void {
    // Periodic DAMAGE also exists; only authoritative interruption cancels the skill pose.
    if (['BLOCKED', 'CAST_CANCELLED', 'HIT_REACTION'].includes(event.type)) {
      this.reaction = event.type === 'BLOCKED' ? 'guard_hit' : event.skillId === 2001 ? 'hit_heavy' : 'hit_light';
      this.reactionTime = 0;
      this.reactionTick = event.serverTick === undefined ? undefined : Number(event.serverTick);
    }
  }
  private duration(name: string): number {
    const hero = animations.heroes.find(h => h.id === this.heroId)!;
    const meta = (hero.animations as Record<string, { ticks: number } | undefined>)[name];
    return (meta?.ticks ?? 1) / animations.tickRate;
  }
  layers(state: Combatant, action: AvatarAction, delta: number, cast?: Cast, context?: AvatarContext): AnimationLayer[] {
    this.clock = context ? context.tick / context.tickRate : this.clock + delta;
    if (this.base) this.baseTime = Math.max(0, this.clock - this.baseStart);
    const air = state.grounded !== undefined ? !state.grounded : action === 'jump';
    const blocking = !!state.blocking && state.guard > 0;
    const landed = this.previousAir && !air;
    const tookOff = !this.previousAir && air;
    const guardStarted = !this.previousBlocking && blocking;
    const guardEnded = this.previousBlocking && !blocking;
    this.previousAir = air; this.previousBlocking = blocking;
    const select = (name: string, loop = false) => {
      if (this.base !== name) { this.base = name; this.baseTime = 0; this.baseStart = this.clock; }
      return [{ name, seconds: this.baseTime, loop }];
    };
    if (!state.alive) {
      this.reaction = undefined;
      // The server can stop sending ticks at match end. Finish the confirmed death pose locally.
      this.deathTime = this.dead ? Math.min(this.duration('death'), this.deathTime + delta) : 0;
      this.dead = true;
      return [{ name: 'death', seconds: this.deathTime, loop: false }];
    }
    this.dead = false;this.deathTime = 0;
    if (cast && cast.castId !== this.castId) this.reaction = undefined;
    if (this.reaction) {
      this.reactionTime = context && this.reactionTick !== undefined
        ? Math.max(0, context.tick - this.reactionTick) / context.tickRate : this.reactionTime + delta;
      if (this.reactionTime < this.duration(this.reaction)) {
        return [{ name: this.reaction, seconds: this.reactionTime, loop: false }];
      }
      this.reaction = undefined;
    }
    if (cast && context) {
      const config = skillById(cast.skillId);
      const mapping = animations.skills.find(s => s.id === cast.skillId);
      if (config && mapping) {
        if (this.castId !== cast.castId) { this.castId = cast.castId; this.airCast = air; }
        const total = config.startup + config.active + config.recovery;
        const start = Number(cast.endTick) - total;
        const elapsedTicks = Math.max(0, Math.min(total, context.tick - start));
        const animationTicks = elapsedTicks * animations.tickRate / context.tickRate;
        const seconds = animationTicks / animations.tickRate;
        const name = mapping.animations.find(n => this.airCast ? n.endsWith('_air') : n.endsWith('_ground')) ?? mapping.animations[0];
        if (cast.phase === 'STARTUP' && mapping.upper) {
          return [
            { name: action === 'move' || action === 'startup' && this.moving ? 'run' : 'idle', seconds: context.tick / context.tickRate, loop: true },
            { name: mapping.upper, seconds, loop: false },
          ];
        }
        return [{ name, seconds, loop: false }];
      }
    } else if (this.castId) { this.castId = ''; this.base = ''; }
    if (air) {
      if (tookOff || this.base === 'jump_start' && this.baseTime < this.duration('jump_start')) return select('jump_start');
      return select((state.velocityY ?? 0) < 0 ? 'jump_rise' : 'jump_fall', true);
    }
    if (blocking) {
      if (guardStarted || this.base === 'guard_start' && this.baseTime < this.duration('guard_start')) return select('guard_start');
      return select('guard_loop', true);
    }
    if (action === 'move') return select('run', true);
    if (landed || this.base === 'jump_land' && this.baseTime < this.duration('jump_land')) return select('jump_land');
    if (guardEnded || this.base === 'guard_end' && this.baseTime < this.duration('guard_end')) return select('guard_end');
    if (this.base === 'run' || this.base === 'stop' && this.baseTime < this.duration('stop')) return select('stop');
    return select('idle', true);
  }
  moving = false;
}
