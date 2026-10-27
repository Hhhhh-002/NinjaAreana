import { Container, Graphics } from 'pixi.js';
import type { Cast, Combatant, CombatEvent } from '../model';
import type { Hero } from '../catalog';
import type { AvatarAction, AvatarContext, AvatarView } from './AvatarView';
import { AnimationDirector } from './AnimationDirector';
import { spineResource, type SpineResource } from './SpineAssets';
import { SpineMesh } from './SpineMesh';

/** Spine owns local poses. The authoritative snapshot owns world movement and state. */
export class SpineAvatar implements AvatarView {
  readonly root = new Container();
  private readonly body: SpineMesh;
  private readonly director;
  private lastX?: number;
  private facing = 1;
  constructor(hero: Hero, private readonly resource: SpineResource = spineResource(hero.id)) {
    // Native shadow-pose slots stay in the character. FX slots use separate authoritative lifetimes.
    this.body = new SpineMesh(resource.data, resource.texture, name => !name.startsWith('fx_'));
    this.director = new AnimationDirector(hero.id);
    this.root.addChild(new Graphics().ellipse(0, 0, 28, 6).fill({ color: 0x080e12, alpha: 0.45 }), this.body.root);
    this.present({ centerX: 0, feetY: 0, alive: true, facing: 1, grounded: true } as Combatant, 'idle', 0);
  }
  react(event: CombatEvent): void { this.director.react(event); }
  anchor(name: string): { x: number; y: number; scale: number; facing: number } | undefined {
    const bone = this.body.skeleton.bones.find(b => b.data.name === name);
    if (!bone) return;
    const scale = this.resource.scale;
    return { x: this.root.x + bone.worldX * scale * this.facing,
      y: this.root.y - bone.worldY * scale, scale, facing: this.facing };
  }
  present(state: Combatant, action: AvatarAction, delta: number, cast?: Cast, context?: AvatarContext): void {
    this.root.position.set(state.centerX, state.feetY);
    this.facing = state.facing < 0 ? -1 : 1;
    this.body.root.scale.set(this.facing * this.resource.scale, -this.resource.scale);
    this.director.moving = this.lastX !== undefined && Math.abs(state.centerX - this.lastX) > 0.02;
    this.lastX = state.centerX;
    this.body.present(this.director.layers(state, action, delta, cast, context));
  }
  destroy(): void {
    this.body.destroy(); this.root.destroy({ children: true });
  }
}
