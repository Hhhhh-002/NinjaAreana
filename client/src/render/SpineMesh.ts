import { Container, Mesh, MeshGeometry, type Texture } from 'pixi.js';
import spine, { type SpineData } from '../vendor/spine38';
import { createSkeleton } from './SpineAssets';

export interface SpineLayer { name: string; seconds: number; loop: boolean }

/** Shared RegionAttachment adapter for characters and native Spine effects. Each view owns its pose. */
export class SpineMesh {
  readonly root = new Container();
  readonly skeleton;
  private readonly meshes = new Map<number, { mesh: Mesh; geometry: MeshGeometry }>();
  constructor(private readonly data: SpineData, private readonly texture: Texture,
    private readonly includeSlot: (name: string) => boolean = () => true) {
    this.skeleton = createSkeleton(data);
  }
  present(layers: SpineLayer[]): void {
    this.skeleton.setToSetupPose();
    for (const layer of layers) this.data.findAnimation(layer.name)?.apply(this.skeleton, 0,
      layer.seconds, layer.loop, null, 1, spine.MixBlend.replace, spine.MixDirection.mixIn);
    this.skeleton.updateWorldTransform();
    for (const entry of this.meshes.values()) entry.mesh.visible = false;
    let order = 0;
    for (const slot of this.skeleton.drawOrder) {
      if (!this.includeSlot(slot.data.name)) continue;
      const attachment = slot.getAttachment();
      const alpha = this.skeleton.color.a * slot.color.a * (attachment?.color.a ?? 0);
      if (!attachment || alpha <= 0.001) continue;
      let entry = this.meshes.get(slot.data.index);
      if (!entry) {
        const geometry = new MeshGeometry({ positions: new Float32Array(8), uvs: new Float32Array(8),
          indices: new Uint32Array([0, 1, 2, 2, 3, 0]) });
        const mesh = new Mesh({ geometry, texture: this.texture });
        entry = { mesh, geometry }; this.meshes.set(slot.data.index, entry); this.root.addChild(mesh);
      }
      attachment.computeWorldVertices(slot.bone, entry.geometry.positions, 0, 2);
      entry.geometry.getBuffer('aPosition').update();
      entry.geometry.uvs.set(attachment.uvs); entry.geometry.getBuffer('aUV').update();
      entry.mesh.visible = true; entry.mesh.alpha = alpha;
      const channel = (a: number, b: number, c: number) => Math.round(Math.max(0, Math.min(1, a * b * c)) * 255);
      entry.mesh.tint = channel(this.skeleton.color.r, slot.color.r, attachment.color.r) * 65536
        + channel(this.skeleton.color.g, slot.color.g, attachment.color.g) * 256
        + channel(this.skeleton.color.b, slot.color.b, attachment.color.b);
      entry.mesh.blendMode = (['normal', 'add', 'multiply', 'screen'] as const)[slot.data.blendMode] ?? 'normal';
      this.root.setChildIndex(entry.mesh, order++);
    }
  }
  destroy(): void {
    this.root.destroy({ children: true });
    for (const entry of this.meshes.values()) entry.geometry.destroy();
    this.meshes.clear(); // Atlas texture/data are shared and remain cached.
  }
}
