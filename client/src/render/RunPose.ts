/** Retouch only the supplied placeholder cutouts; future artist exports keep their own animation. */
export function refineRunPose(json: any): void {
  if (!['shadow-duel-generated-v1', 'y9GIuQgeCgwUu5f5lKkPCFnB9NM', '+co3anCn2w6d8JjvEX0+d/P024I']
    .includes(json.skeleton?.hash)) return;
  const run = json.animations?.run?.bones;
  if (!run) return;
  const setup = new Map<string, number>(json.bones.map((bone: any) => [bone.name, bone.rotation ?? 0]));
  for (const [side, direction] of [['front', 1], ['back', -1]] as const) {
    const rotations = { thigh: [] as any[], calf: [] as any[], foot: [] as any[] };
    for (let step = 0; step <= 16; step++) {
      const swing = Math.sin(step / 16 * Math.PI * 2) * direction;
      const thigh = -90 + swing * 26;
      const calf = 12 + Math.max(0, -swing) * 36;
      // Both knees bend in the same direction; the soles stay nearly parallel to the ground.
      const foot = -90 - thigh - calf + Math.max(0, -swing) * 8;
      for (const [part, angle] of Object.entries({ thigh, calf, foot })) {
        rotations[part as keyof typeof rotations].push({ time: step * 0.8 / 16,
          angle: angle - (setup.get(`${part}_${side}`) ?? 0) });
      }
    }
    for (const part of ['thigh', 'calf', 'foot'] as const) run[`${part}_${side}`] = { rotate: rotations[part] };
  }
}
