interface Color { r: number; g: number; b: number; a: number }
export interface SpineAttachment {
  type?: number; region: unknown; uvs: ArrayLike<number>; color: Color;
  computeWorldVertices(bone: unknown, out: Float32Array, offset: number, stride: number): void;
}
export interface SpineSlot {
  bone: unknown; color: Color; data: { index: number; blendMode: number; name?: string };
  getAttachment(): SpineAttachment | null;
}
export interface SpineAnimation {
  name: string; duration: number;
  apply(skeleton: SpineSkeleton, last: number, time: number, loop: boolean, events: null,
    alpha: number, blend: number, direction: number): void;
}
export interface SpineData {
  animations: SpineAnimation[];
  findAnimation(name: string): SpineAnimation | null;
}
export interface SpineSkeleton {
  drawOrder: SpineSlot[]; slots: SpineSlot[]; color: Color;
  bones: { data: { name: string }; worldX: number; worldY: number; a: number; b: number; c: number; d: number }[];
  setToSetupPose(): void;
  updateWorldTransform(): void;
}
declare const spine: {
  TextureAtlas: new (text: string, loader: (path: string) => unknown) => unknown;
  AtlasAttachmentLoader: new (atlas: unknown) => unknown;
  SkeletonJson: new (loader: unknown) => { readSkeletonData(json: unknown): SpineData };
  Skeleton: new (data: SpineData) => SpineSkeleton;
  MixBlend: { replace: number }; MixDirection: { mixIn: number };
};
export default spine;
