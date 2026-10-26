import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import protobuf from 'protobufjs';
import { parse } from 'csv-parse/sync';

const client = fileURLToPath(new URL('../', import.meta.url));
if (!process.env.NINJA_SERVER_ROOT) {
  throw new Error('Manual sync only: set NINJA_SERVER_ROOT to the server source directory. Client dev/build/test do not require it.');
}
const root = path.resolve(process.env.NINJA_SERVER_ROOT);
const generated = path.join(client, 'src/generated');
await mkdir(generated, { recursive: true });
const protoRoot = new protobuf.Root();
await protoRoot.load(['game.proto', 'leave.proto'].map(p => path.join(root, 'game-protocol/src/main/proto', p)));
protoRoot.resolveAll();
await writeFile(path.join(generated, 'protocol.json'), JSON.stringify(protoRoot.toJSON()));
const tables = {};
for (const [name, file] of Object.entries({ heroes: 'hero', skills: 'skill', effects: 'skill_effect' })) {
  tables[name] = parse(await readFile(path.join(root, 'config/src/main/resources', `${file}.csv`)), {
    bom: true, from_line: 2, columns: true, skip_empty_lines: true,
  }).map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'notes')));
}
await writeFile(path.join(generated, 'catalog.json'), JSON.stringify(tables, null, 2));
// Derive CMD values from the Java enum instead of maintaining a second numeric list.
const commandsSource = await readFile(path.join(root, 'game-common/src/main/java/com/h/gamecommon/command/GameCommands.java'), 'utf8');
const commands = Object.fromEntries([...commandsSource.matchAll(/^\s*([A-Z][A-Z_]+)\((\d+)\)/gm)].map(m => [m[1], Number(m[2])]));
await writeFile(path.join(generated, 'commands.ts'), `// Generated from GameCommands.java. To update, set NINJA_SERVER_ROOT and run npm run sync:data.\nexport const CMD = ${JSON.stringify(commands, null, 2)} as const;\n`);
console.log(`Synced Protobuf, ${tables.heroes.length} heroes, ${tables.skills.length} skills, ${tables.effects.length} effects and CMDs.`);
