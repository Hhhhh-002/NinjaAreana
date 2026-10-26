import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const client = fileURLToPath(new URL('../', import.meta.url));
if (!process.env.NINJA_ANIMATION_ROOT) {
  throw new Error('Manual sync only: set NINJA_ANIMATION_ROOT to the animation source directory. Client dev/build/test do not require it.');
}
const root = path.resolve(process.env.NINJA_ANIMATION_ROOT);
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const catalog = { tickRate: manifest.tick_rate, heroes: manifest.heroes.map(h => ({
  id: h.id, key: h.key, animations: h.animations,
})), skills: manifest.skills.filter(s => s.kind === 'ACTIVE').map(s => ({
  id: s.skill_id, animations: s.animations, upper: s.startup_upper_animation,
})) };
for (const hero of catalog.heroes) {
  const project = path.join(root, 'projects', hero.key, `${hero.key}.json`);
  const skeleton = JSON.parse(await readFile(project, 'utf8'));
  if (skeleton.skeleton.spine !== '3.8.75' || skeleton.skeleton.hash !== 'shadow-duel-generated-v1') {
    throw new Error(`${hero.key}: runtime compatibility requires rechecking the Spine export`);
  }
  for (const name of Object.keys(hero.animations)) {
    if (!skeleton.animations[name]) throw new Error(`${hero.key}: missing animation ${name}`);
  }
  const destination = path.join(client, 'public/assets/spine', hero.key);
  await mkdir(destination, { recursive: true });
  await copyFile(project, path.join(destination, `${hero.key}.json`));
  for (const ext of ['atlas', 'png']) {
    await copyFile(path.join(root, 'export', hero.key, `${hero.key}.${ext}`), path.join(destination, `${hero.key}.${ext}`));
  }
}
await writeFile(path.join(client, 'src/generated/animations.json'), JSON.stringify(catalog, null, 2));
console.log(`Synced ${catalog.heroes.length} Spine 3.8 skeletons, atlases and animation mappings.`);
