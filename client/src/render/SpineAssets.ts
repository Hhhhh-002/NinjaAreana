import { Assets, Texture } from 'pixi.js';
import spine, { type SpineData, type SpineSkeleton } from '../vendor/spine38';
import animations from '../generated/animations.json';
import fxLibrary from '../generated/spine-fx.json';
import { refineRunPose } from './RunPose';

export { animations, fxLibrary };
export interface SpineResource { data: SpineData; texture: Texture; scale: number }
const resources = new Map<number, SpineResource>();
let effectResource: SpineResource | undefined;

export function parseSpine(json: unknown, atlasText: string, width: number, height: number): SpineData {
  refineRunPose(json);
  const texture = { getImage: () => ({ width, height }), setFilters() {}, setWraps() {}, dispose() {} };
  const atlas = new spine.TextureAtlas(atlasText, () => texture);
  return new spine.SkeletonJson(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(json);
}

export function createSkeleton(data: SpineData): SpineSkeleton { return new spine.Skeleton(data); }

/** The supplied cutout exports use RegionAttachment quads. Reject future unsupported exports explicitly. */
export function validateSkeleton(skeleton: SpineSkeleton): void {
  for (const slot of skeleton.drawOrder) {
    const attachment = slot.getAttachment();
    if (attachment && (!('offset' in attachment) || attachment.uvs.length !== 8)) {
      throw new Error('此骨骼包含当前渲染适配器不支持的附件，请更新 Spine 适配器');
    }
  }
}

async function loadResource(key: string): Promise<SpineResource> {
  const base = `/assets/spine/${key}/${key}`;
  const [jsonResponse, atlasResponse, texture] = await Promise.all([
    fetch(`${base}.json`), fetch(`${base}.atlas`),
    Assets.load<Texture>({ src: `${base}.png`, data: { alphaMode: 'premultiply-alpha-on-upload' } }),
  ]);
  if (!jsonResponse.ok || !atlasResponse.ok) throw new Error(`无法加载 ${key} 骨骼资源`);
  const data = parseSpine(await jsonResponse.json(), await atlasResponse.text(), texture.width, texture.height);
  validateSkeleton(createSkeleton(data));
  return { data, texture, scale: 1 };
}
export async function loadSpineResources(): Promise<void> {
  await Promise.all(animations.heroes.map(async hero => {
    if (resources.has(hero.id)) return;
    const { data, texture } = await loadResource(hero.key);
    const skeleton = createSkeleton(data);
    validateSkeleton(skeleton);
    // Fit the neutral body to the existing 120px character height, without rescaling world movement.
    skeleton.setToSetupPose();
    data.findAnimation('idle')!.apply(skeleton, 0, 0, true, null, 1, spine.MixBlend.replace, spine.MixDirection.mixIn);
    skeleton.updateWorldTransform();
    let top = 0;
    const vertices = new Float32Array(8);
    for (const slot of skeleton.drawOrder) {
      // Invisible FX/ghost slots can extend far beyond the body; never use them to fit the hero.
      if (slot.data.name.startsWith('fx_') || slot.data.name.startsWith('shadow_pose_')) continue;
      const attachment = slot.getAttachment();
      if (!attachment || slot.color.a <= 0.001) continue;
      attachment.computeWorldVertices(slot.bone, vertices, 0, 2);
      for (let i = 1; i < vertices.length; i += 2) top = Math.max(top, vertices[i]);
    }
    resources.set(hero.id, { data, texture, scale: 120 / Math.max(1, top) });
  }));
  effectResource ??= await loadResource(fxLibrary.key);
}
export function spineEffectResource(): SpineResource {
  if (!effectResource) throw new Error('Spine 特效尚未加载');
  return effectResource;
}
export function spineResource(heroId: number): SpineResource {
  const resource = resources.get(heroId);
  if (!resource) throw new Error(`角色 ${heroId} 骨骼尚未加载`);
  return resource;
}
