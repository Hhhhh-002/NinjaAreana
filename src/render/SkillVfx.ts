import { Container, Graphics } from 'pixi.js';
import { effects, skillById } from '../catalog';
import type { BattleSnapshot, CombatEvent } from '../model';

/** Presentation only: server casts/statuses/results drive VFX, never damage or hit detection. */
export class SkillVfx {
  readonly root = new Container();
  private readonly played = new Set<string>();
  private readonly bursts: { graphic: Graphics; age: number; duration: number; expand: boolean }[] = [];
  private readonly auras = new Map<string, Graphics>();

  update(frame: BattleSnapshot, delta: number): void {
    const tick = frame.presentationTick ?? Number(frame.serverTick);
    const current = new Set(frame.casts.map(c => c.castId));
    for (const id of this.played) if (!current.has(id)) this.played.delete(id);
    for (const cast of frame.casts) {
      const config = skillById(cast.skillId);
      if (!config || this.played.has(cast.castId)) continue;
      const activeTick = Number(cast.endTick) - config.active - config.recovery;
      if (tick < activeTick) continue;
      this.played.add(cast.castId);
      const owner = frame.combatants.find(c => c.entityId === cast.casterEntityId);
      if (!owner || tick - activeTick > 8) continue;
      const g = new Graphics();
      const color = owner.heroId === 101 ? 0x9effed : 0xffc575;
      if ([1001, 1101, 2101].includes(cast.skillId)) {
        g.arc(15, -60, cast.skillId === 1001 ? 94 : 74, -1.25, 1.2)
          .stroke({ color, width: cast.skillId === 1001 ? 12 : 7, alpha: 0.8 });
        g.arc(15, -60, cast.skillId === 1001 ? 84 : 65, -1.15, 0.9).stroke({ color: 0xffffff, width: 2 });
      } else if (cast.skillId === 2001) {
        g.ellipse(65, -3, 90, 20).stroke({ color, width: 6 });
        for (let i = 0; i < 5; i++) g.moveTo(30 + i * 18, -4).lineTo(20 + i * 22, -35 - i % 2 * 26)
          .stroke({ color, width: 4 });
      } else if (cast.skillId === 1002) {
        for (let i = 0; i < 4; i++) g.moveTo(20, -25 - i * 23).lineTo(135, -35 - i * 23)
          .stroke({ color: 0xb2a8ff, width: 5 - i, alpha: 0.8 });
      } else {
        g.ellipse(0, -60, 40, 68).stroke({ color, width: 4 });
      }
      g.position.set(owner.centerX, owner.feetY); g.scale.x = owner.facing < 0 ? -1 : 1;
      this.add(g, 0.26, cast.skillId === 2001);
    }
    const activeAuras = new Set<string>();
    for (const c of frame.combatants) for (const status of c.statuses) {
      const type = effects.get(status.effectId)?.type;
      const color = ({ SHIELD: 0xffda87, DAMAGE_REDUCTION: 0xffbe6e, INVINCIBLE: 0xb2a8ff,
        MOVE_SPEED_UP: 0x86ffe2, BURN: 0xff804f, POISON: 0x9be66e, BLEED: 0xe66778,
        REGEN: 0x79f2ba } as Record<string, number>)[type ?? ''];
      if (color === undefined || !c.alive) continue;
      const key = `${c.entityId}:${status.instanceId}`;
      activeAuras.add(key);
      let g = this.auras.get(key);
      if (!g) {
        g = new Graphics();
        if (['SHIELD', 'DAMAGE_REDUCTION', 'INVINCIBLE'].includes(type!))
          g.ellipse(0, -60, 39, 69).fill({ color, alpha: 0.08 }).stroke({ color, width: 2, alpha: 0.8 });
        else {
          g.ellipse(0, -3, 32, 9).stroke({ color, width: 2 });
          for (let i = 0; i < 4; i++) g.circle(-21 + i * 14, -16 - i % 2 * 15, 3).fill(color);
        }
        this.root.addChild(g); this.auras.set(key, g);
      }
      g.position.set(c.centerX, c.feetY);
      g.alpha = 0.65 + Math.sin(tick * 0.25) * 0.2;
    }
    for (const [key, g] of this.auras) if (!activeAuras.has(key)) { g.destroy(); this.auras.delete(key); }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]; b.age += delta;
      if (b.age >= b.duration) { b.graphic.destroy(); this.bursts.splice(i, 1); continue; }
      b.graphic.alpha = 1 - b.age / b.duration;
      if (b.expand) b.graphic.scale.set(1 + b.age * 2);
    }
  }
  result(event: CombatEvent, frame: BattleSnapshot): void {
    if (!['DAMAGE', 'CRITICAL_DAMAGE', 'BLOCKED', 'EVADED', 'PASSIVE_TRIGGERED'].includes(event.type)) return;
    const target = frame.combatants.find(c => c.userId === event.targetUserId);
    if (!target) return;
    const color = event.type === 'BLOCKED' || event.type === 'PASSIVE_TRIGGERED' ? 0xffda87
      : event.type === 'EVADED' ? 0xb2a8ff : 0xfff0cc;
    const g = new Graphics().star(0, 0, 7, 24, 7).fill({ color, alpha: 0.75 });
    g.circle(0, 0, 27).stroke({ color, width: 2 });
    g.position.set(target.centerX, target.feetY - 65);
    this.add(g, 0.2, true);
  }
  private add(graphic: Graphics, duration: number, expand = false): void {
    this.root.addChild(graphic); this.bursts.push({ graphic, age: 0, duration, expand });
    if (this.bursts.length > 96) this.bursts.shift()!.graphic.destroy();
  }
  reset(): void {
    this.played.clear(); this.auras.clear(); this.bursts.length = 0;
    for (const child of this.root.removeChildren()) child.destroy();
  }
}
