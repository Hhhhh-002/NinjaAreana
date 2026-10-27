import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { restoreAtlasPixels } from './spine-atlas.mjs';

// Manual import only. The distributed client never needs the original art directory.
const client = fileURLToPath(new URL('../', import.meta.url));
if (!process.env.NINJA_ANIMATION_ROOT) throw new Error('Set NINJA_ANIMATION_ROOT to the unified asset pack or its 特效_Spine_V1.0 directory.');
const root = path.resolve(process.env.NINJA_ANIMATION_ROOT);
const input = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8').catch(() => '{}'));
const fxRoot = input.projects ? root : path.join(root, '特效_Spine_V1.0');
const bundle = path.dirname(fxRoot);
const fx = JSON.parse(await readFile(path.join(fxRoot, 'manifest.json'), 'utf8'));
const old = JSON.parse(await readFile(path.join(bundle, '骨骼动画_V1.0/manifest.json'), 'utf8'));
const catalog = { tickRate: fx.tick_rate, heroes: [], skills: old.skills.filter(s => s.kind === 'ACTIVE').map(s => ({
  id: s.skill_id, animations: s.animations, upper: s.startup_upper_animation,
})) };
const library = { key: 'shadow_duel_fx_library', effects: fx.effects };
const duration = value => {
  if (!value || typeof value !== 'object') return 0;
  return Math.max(Number(value.time) || 0, ...Object.values(value).filter(v => v && typeof v === 'object').map(duration));
};
for (const project of fx.projects) {
  const key = project.character ? old.heroes.find(h => h.id === project.character).key : library.key;
  const source = path.join(fxRoot, project.export, project.key);
  const skeleton = JSON.parse(await readFile(`${source}.json`, 'utf8'));
  const authored = JSON.parse(await readFile(path.join(fxRoot, project.source), 'utf8'));
  if (skeleton.skeleton.spine !== '3.8.75') throw new Error(`${key}: expected Spine 3.8.75 export`);
  if (Object.keys(skeleton.animations).length !== project.animations.length) throw new Error(`${key}: incomplete export`);
  // The editor import reset region sizes to PNG dimensions. Restore the author's display dimensions,
  // retaining the formally exported timelines/bones and the atlas's original image bounds.
  for (const skin of skeleton.skins) for (const [slot, attachments] of Object.entries(skin.attachments)) {
    const reference = authored.skins.find(s => s.name === skin.name)?.attachments[slot];
    for (const [name, attachment] of Object.entries(attachments)) {
      const original = reference?.[name];
      if (!original || original.width <= 0 || original.height <= 0) throw new Error(`${slot}/${name}: missing authored dimensions`);
      attachment.width = original.width;attachment.height = original.height;
    }
  }
  const destination = path.join(client, 'public/assets/spine', key);
  await mkdir(destination, { recursive: true });
  for (const ext of ['json', 'atlas', 'png']) {
    // Atlas page name must match the copied PNG. Attachment regions retain their exported UVs.
    if (ext === 'atlas') await writeFile(path.join(destination, `${key}.atlas`),
      (await readFile(`${source}.atlas`, 'utf8')).replace(`${project.key}.png`, `${key}.png`));
    else if (ext === 'png') await writeFile(path.join(destination, `${key}.png`),
      await restoreAtlasPixels(await readFile(`${source}.atlas`, 'utf8'),
        path.join(fxRoot, 'projects', project.key, 'images')));
    else await writeFile(path.join(destination, `${key}.${ext}`), JSON.stringify(skeleton));
  }
  if (project.character) {
    const original = old.heroes.find(h => h.id === project.character);
    const animations = Object.fromEntries(Object.entries(skeleton.animations).map(([name, data]) => [name,
      original.animations[name] ?? { ticks: Math.round(duration(data) * fx.tick_rate),
        loop: fx.effects[name]?.loop_preview ?? false, timing: 'native_fx_export', upper_only: false }]));
    catalog.heroes.push({ id: project.character, key, hash: skeleton.skeleton.hash, animations });
  } else {
    library.hash = skeleton.skeleton.hash;
    for (const [name, definition] of Object.entries(library.effects)) {
      const anchor = skeleton.bones.find(b => b.name === definition.anchor_bone);
      definition.origin = { x: anchor.x ?? 0, y: anchor.y ?? 0 };
      if (!skeleton.animations[name]) throw new Error(`Missing FX animation ${name}`);
    }
  }
}
catalog.skills.push({ id: 1101, animations: ['attack_light_1'], upper: null },
  { id: 2101, animations: ['attack_light_1'], upper: null });
await writeFile(path.join(client, 'src/generated/animations.json'), JSON.stringify(catalog, null, 2));
await writeFile(path.join(client, 'src/generated/spine-fx.json'), JSON.stringify(library, null, 2));
console.log(`Imported ${catalog.heroes.length} combined character skeletons and ${Object.keys(library.effects).length} native Spine effects.`);
