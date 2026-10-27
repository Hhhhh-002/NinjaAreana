import { Container } from 'pixi.js';
import { effects, skillById } from '../catalog';
import type { BattleSnapshot, Cast, Combatant, CombatEvent } from '../model';
import { fxLibrary, spineEffectResource, spineResource, type SpineResource } from './SpineAssets';
import { SpineMesh } from './SpineMesh';

type FxName = keyof typeof fxLibrary.effects;
export interface FxAnchor { x: number; y: number; scale: number; facing: number }
export interface FxView {
  readonly root: Container;
  present(name: FxName, seconds: number, loop: boolean): void;
  destroy(): void;
}
type FxFactory = (name: FxName) => FxView;
interface Instance { view: FxView; name: FxName; start: number; end: number; entity: string;
  follow: boolean; loop: boolean; source: 'cast' | 'status' | 'projectile' | 'result'; castId?: string }
interface CastRecord { cast: Cast; start: number; end: number }
const statusFx: Record<string, FxName> = { INVINCIBLE: 'fx_invincible', DAMAGE_REDUCTION: 'fx_ironwall',
  SHIELD: 'fx_rock_shield', MOVE_SPEED_UP: 'fx_wind_speed', POISON: 'fx_poison', BLEED: 'fx_bleed',
  BURN: 'fx_burn', REGEN: 'fx_regen' };

/** DAMAGE is also used by DOT. Only direct contact produces sparks and a cosmetic hurt pose. */
export function isDirectHit(event: CombatEvent, frame: BattleSnapshot): boolean {
  if (!['DAMAGE', 'CRITICAL_DAMAGE'].includes(event.type)) return false;
  const cast = frame.casts.find(c => c.castId === event.castId), skill = skillById(event.skillId);
  if (cast && skill) {
    const activeStart = Number(cast.endTick) - skill.active - skill.recovery;
    if (Number(event.serverTick) >= activeStart && Number(event.serverTick) < activeStart + skill.active) return true;
  }
  // Projectiles can outlive their cast; status application identifies their actual contact snapshot.
  return frame.results.some(e => ['STATUS_APPLIED_POISON', 'STATUS_APPLIED_BURN', 'STATUS_APPLIED_BLEED'].includes(e.type)
    && e.castId === event.castId && e.targetUserId === event.targetUserId
    && e.sourceUserId === event.sourceUserId && e.serverTick === event.serverTick);
}

/** Native region attachments and slot/bone timelines from the supplied independent effect library. */
class NativeEffect implements FxView {
  readonly root: Container;
  private readonly mesh: SpineMesh;
  constructor(name: FxName, resource: SpineResource = spineEffectResource()) {
    const parts = new Set<string>(fxLibrary.effects[name].parts);
    this.mesh = new SpineMesh(resource.data, resource.texture, slot => parts.has(slot));
    this.root = this.mesh.root;
  }
  present(name: FxName, seconds: number, loop: boolean): void { this.mesh.present([{ name, seconds, loop }]); }
  destroy(): void { this.mesh.destroy(); }
}

/** Presentation only: no local damage, status timers, collision detection, or preview flight tracks. */
export class SkillVfx {
  readonly root = new Container();
  private readonly instances = new Map<string, Instance>();
  private readonly casts = new Map<string, CastRecord>();
  constructor(private readonly factory: FxFactory = name => new NativeEffect(name),
    private readonly heroScale: (id: number) => number = id => spineResource(id).scale) {}

  update(frame: BattleSnapshot, _delta = 0,
    anchor?: (entityId: string, bone: string) => FxAnchor | undefined): void {
    const tick = frame.presentationTick ?? Number(frame.serverTick), rate = frame.tickRate || 30;
    const entities = new Map(frame.combatants.map(c => [c.entityId, c]));
    const currentCasts = new Set(frame.casts.map(c => c.castId));
    const wanted = new Set<string>();
    for (const cast of frame.casts) {
      const config = skillById(cast.skillId);
      if (config) this.casts.set(cast.castId, { cast, end: Number(cast.endTick),
        start: Number(cast.endTick) - config.startup - config.active - config.recovery });
    }
    for (const [id, record] of this.casts) {
      const owner = entities.get(record.cast.casterEntityId);
      const cancelled = !currentCasts.has(id) && tick < record.end;
      if (!owner?.alive || cancelled || tick > record.end + 30) {
        this.casts.delete(id);
        for (const [key, instance] of this.instances) if (instance.castId === id) this.remove(key);
        continue;
      }
      const skill = skillById(record.cast.skillId)!;
      const cues: { name: FxName; offset: number; length?: number; follow?: boolean }[] = [];
      if (skill.id === 1001) cues.push({ name: 'fx_wind_charge', offset: 0, length: skill.startup },
        { name: 'fx_wind_slash', offset: skill.startup });
      if (skill.id === 1002) cues.push({ name: 'fx_shadow_afterimage', offset: skill.startup });
      if (skill.id === 2001) cues.push({ name: 'fx_rock_swing', offset: skill.startup },
        { name: 'fx_rock_impact', offset: skill.startup + skill.active, follow: false });
      if (skill.id === 1101 || skill.id === 2101) cues.push({ name: skill.id === 1101 ? 'fx_wind_slash' : 'fx_rock_swing', offset: skill.startup });
      for (const cue of cues) {
        const start = record.start + cue.offset, end = start + (cue.length ?? fxLibrary.effects[cue.name].ticks);
        if (tick < start || tick >= end) continue;
        const key = `cast:${id}:${cue.name}`;wanted.add(key);
        const instance = this.ensure(key, cue.name, start, end, owner.entityId, cue.follow ?? true, false, 'cast');
        instance.castId = id;
        if (instance.follow || !instance.view.root.visible) this.place(instance, owner, frame.groundY, anchor);
      }
    }
    for (const owner of frame.combatants) {
      if (!owner.alive) continue;
      for (const status of owner.statuses) {
        const definition = effects.get(status.effectId), name = statusFx[definition?.type ?? ''];
        if (!name || tick >= Number(status.endTick)) continue;
        const key = `status:${owner.entityId}:${status.instanceId}`; wanted.add(key);
        const start = Number(status.endTick) - (definition?.duration || fxLibrary.effects[name].ticks);
        const instance = this.ensure(key, name, start, Number(status.endTick), owner.entityId, true, true, 'status');
        // Refreshes retain the server instance ID but change endTick; seek the refreshed timeline.
        instance.start = start; instance.end = Number(status.endTick);
        this.place(instance, owner, frame.groundY, anchor);
      }
    }
    for (const p of frame.projectiles) {
      const key = `projectile:${p.instanceId}`;wanted.add(key);
      const instance = this.ensure(key, 'fx_shuriken', tick, Infinity, p.ownerEntityId, false, true, 'projectile');
      const owner = entities.get(p.ownerEntityId), scale = this.heroScale(owner?.heroId ?? 101);
      const origin = fxLibrary.effects.fx_shuriken.origin, facing = p.facing < 0 ? -1 : 1;
      instance.view.root.position.set(p.x - origin.x * scale * facing, p.y + origin.y * scale);
      instance.view.root.scale.set(scale * facing, -scale);instance.view.root.visible = true;
    }
    for (const [key, instance] of this.instances) {
      if (tick >= instance.end || (instance.source !== 'result' && !wanted.has(key))) { this.remove(key); continue; }
      // Use the same interpolated server clock as the pose. Freeze on missing snapshots.
      instance.view.present(instance.name, Math.max(0, tick - instance.start) / rate, instance.loop);
    }
  }
  result(event: CombatEvent, frame: BattleSnapshot): void {
    const name: FxName | undefined = event.type === 'BLOCKED' || event.type === 'HIT_REACTION' || isDirectHit(event, frame) ? 'fx_guard_contact'
      : event.type === 'HEAL' && event.value > 0 ? 'fx_regen_pulse' : undefined;
    if (!name) return;
    const target = frame.combatants.find(c => c.userId === event.targetUserId);
    if (!target) return;
    const start = Number(event.serverTick), end = start + fxLibrary.effects[name].ticks;
    const tick = frame.presentationTick ?? Number(frame.serverTick);
    if (tick >= end) return;
    const key = `result:${event.serverTick}:${event.type}:${event.castId}:${event.targetUserId}:${event.skillId}`;
    const instance = this.ensure(key, name, start, end, target.entityId, false, false, 'result');
    const scale = this.heroScale(target.heroId), origin = fxLibrary.effects[name].origin;
    // Contact/pulse artwork is centered at its body anchor in the source skeleton.
    instance.view.root.position.set(target.centerX - origin.x * scale, target.feetY);
    instance.view.root.scale.set(scale, -scale);instance.view.root.visible = true;
  }
  private place(instance: Instance, owner: Combatant, groundY: number,
    anchor?: (entityId: string, bone: string) => FxAnchor | undefined): void {
    const definition = fxLibrary.effects[instance.name], scale = this.heroScale(owner.heroId);
    const facing = owner.facing < 0 ? -1 : 1;
    const socket = definition.anchor === 'weapon' ? anchor?.(owner.entityId, 'weapon') : undefined;
    if (socket) instance.view.root.position.set(socket.x - definition.origin.x * scale * facing,
      socket.y + definition.origin.y * scale);
    else instance.view.root.position.set(owner.centerX, definition.anchor === 'ground' ? groundY : owner.feetY);
    instance.view.root.scale.set(scale * facing, -scale);instance.view.root.visible = true;
  }
  private ensure(key: string, name: FxName, start: number, end: number, entity: string,
    follow: boolean, loop: boolean, source: Instance['source']): Instance {
    let instance = this.instances.get(key);
    if (!instance) {
      const view = this.factory(name);view.root.visible = false;
      instance = { view, name, start, end, entity, follow, loop, source };
      this.instances.set(key, instance);this.root.addChild(view.root);
      if (this.instances.size > 96) this.remove(this.instances.keys().next().value!);
    }
    return instance;
  }
  private remove(key: string): void { this.instances.get(key)?.view.destroy();this.instances.delete(key); }
  reset(): void {
    for (const key of this.instances.keys()) this.remove(key);
    this.casts.clear();
  }
}
