import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { expect, it } from 'vitest';
import { restoreAtlasPixels } from '../scripts/spine-atlas.mjs';

it('preserves original artwork colors/alpha while keeping the atlas gutter transparent', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'ninja-atlas-test-'));
  try {
    const original = new PNG({ width: 3, height: 2 });
    original.data.set([8,16,24,255, 255,255,255,255, 50,90,140,128,
      0,0,0,0, 20,40,60,255, 80,100,120,255]);
    await writeFile(path.join(dir, 'body.png'), PNG.sync.write(original));
    const atlas = 'page.png\nsize: 16,16\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\nbody\n'
      + '  rotate: false\n  xy: 4, 4\n  size: 3, 2\n  orig: 3, 2\n  offset: 0, 0\n  index: -1\n';
    const packed = PNG.sync.read(await restoreAtlasPixels(atlas, dir));
    for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) {
      const offset = ((y+4)*16+x+4)*4, source = (y*3+x)*4;
      expect([...packed.data.subarray(offset, offset+4)]).toEqual([...original.data.subarray(source, source+4)]);
    }
    expect([...packed.data.subarray((3*16+4)*4, (3*16+4)*4+4)]).toEqual([8,16,24,0]);
  } finally { await rm(dir, { recursive: true }); }
});
