import { Container, Graphics, Mesh, MeshGeometry } from 'pixi.js';
import spine from '../vendor/spine38';
import type { Cast, Combatant, CombatEvent } from '../model';
import type { Hero } from '../catalog';
import type { AvatarAction, AvatarContext, AvatarView } from './AvatarView';
import { AnimationDirector } from './AnimationDirector';
import { createSkeleton, spineResource, validateSkeleton, type SpineResource } from './SpineAssets';

/** Spine owns local poses/IK. The server snapshot owns all world movement and gameplay. */
export class SpineAvatar implements AvatarView {
  readonly root = new Container();
  private readonly body = new Container();
  private readonly skeleton;
  private readonly director;
  private readonly slots = new Map<number, { mesh: Mesh; geometry: MeshGeometry }>();
  private lastX?: number;
  constructor(hero: Hero, private readonly resource: SpineResource = spineResource(hero.id)) {
    this.skeleton = createSkeleton(this.resource.data);
    this.director = new AnimationDirector(hero.id);
    this.root.addChild(new Graphics().ellipse(0, 0, 28, 6).fill({ color: 0x080e12, alpha: 0.45 }), this.body);
    validateSkeleton(this.skeleton);
    for (const slot of this.skeleton.slots) {
      const attachment = slot.getAttachment();
      if (!attachment) continue;
      const geometry = new MeshGeometry({ positions: new Float32Array(8),
        uvs: Float32Array.from(attachment.uvs), indices: new Uint32Array([0, 1, 2, 2, 3, 0]) });
      const mesh = new Mesh({ geometry, texture: this.resource.texture });
      this.body.addChild(mesh); this.slots.set(slot.data.index, { mesh, geometry });
    }
    this.present({ centerX: 0, feetY: 0, alive: true, facing: 1, grounded: true } as Combatant, 'idle', 0);
  }
  react(event: CombatEvent): void { this.director.react(event); }
  present(state: Combatant, action: AvatarAction, delta: number, cast?: Cast, context?: AvatarContext): void {
    this.root.position.set(state.centerX, state.feetY);
    const scale = this.resource.scale;
    this.body.scale.set(state.facing < 0 ? -scale : scale, -scale);
    this.director.moving = this.lastX !== undefined && Math.abs(state.centerX - this.lastX) > 0.02;
    this.lastX = state.centerX;
    const layers = this.director.layers(state, action, delta, cast, context);
    const skeleton = this.skeleton;
    skeleton.setToSetupPose();
    for (const layer of layers) {
      this.resource.data.findAnimation(layer.name)?.apply(skeleton, 0, layer.seconds, layer.loop, null,
        1, spine.MixBlend.replace, spine.MixDirection.mixIn);
    }
    skeleton.updateWorldTransform();
    for (const entry of this.slots.values()) entry.mesh.visible = false;
    for (let order = 0; order < skeleton.drawOrder.length; order++) {
      const slot = skeleton.drawOrder[order];
      const attachment = slot.getAttachment();
      const entry = this.slots.get(slot.data.index);
      if (!attachment || !entry) continue;
      attachment.computeWorldVertices(slot.bone, entry.geometry.positions, 0, 2);
      entry.geometry.getBuffer('aPosition').update();
      entry.geometry.uvs.set(attachment.uvs);
      entry.geometry.getBuffer('aUV').update();
      entry.mesh.visible = true;
      entry.mesh.alpha = skeleton.color.a * slot.color.a * attachment.color.a;
      const channel = (a: number, b: number, c: number) => Math.round(Math.max(0, Math.min(1, a * b * c)) * 255);
      entry.mesh.tint = channel(skeleton.color.r, slot.color.r, attachment.color.r) * 65536
        + channel(skeleton.color.g, slot.color.g, attachment.color.g) * 256
        + channel(skeleton.color.b, slot.color.b, attachment.color.b);
      entry.mesh.blendMode = (['normal', 'add', 'multiply', 'screen'] as const)[slot.data.blendMode] ?? 'normal';
      this.body.setChildIndex(entry.mesh, Math.min(order, this.body.children.length - 1));
    }
  }
  destroy(): void {
    this.root.destroy({ children: true });
    for (const entry of this.slots.values()) entry.geometry.destroy();
    this.slots.clear(); // Atlas texture is shared between avatars and stays in the asset cache.
  }
}
