import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';

/** Restore original RGBA pixels: the supplied atlas generator's RGB MaxFilter also altered opaque artwork. */
export async function restoreAtlasPixels(atlasText, imagesDirectory) {
  const lines = atlasText.trim().split(/\r?\n/);
  const size = lines.find(line => line.startsWith('size:'))?.match(/\d+/g)?.map(Number);
  if (!size || size.length !== 2) throw new Error('Missing atlas page dimensions');
  const result = new PNG({ width: size[0], height: size[1] });
  for (let i = 1; i < lines.length; i++) {
    const name = lines[i];
    if (!name || /^\s/.test(name) || name.includes(':')) continue;
    const values = {};
    while (i + 1 < lines.length && /^\s/.test(lines[i + 1])) {
      const [key, value] = lines[++i].trim().split(':'); values[key] = value.trim();
    }
    if (values.rotate !== 'false') throw new Error(`Unsupported rotated atlas region: ${name}`);
    const [x, y] = values.xy.split(',').map(Number), [width, height] = values.size.split(',').map(Number);
    const [originalWidth, originalHeight] = values.orig.split(',').map(Number);
    const [offsetX, offsetY] = values.offset.split(',').map(Number);
    const source = PNG.sync.read(await readFile(path.join(imagesDirectory, `${name}.png`)));
    if (source.width !== originalWidth || source.height !== originalHeight) throw new Error(`${name}: source/atlas dimensions differ`);
    const top = originalHeight - offsetY - height;
    for (let row = -4; row < height + 4; row++) for (let col = -4; col < width + 4; col++) {
      if (x + col < 0 || y + row < 0 || x + col >= result.width || y + row >= result.height) continue;
      const src = ((top + Math.max(0, Math.min(height - 1, row))) * source.width
        + offsetX + Math.max(0, Math.min(width - 1, col))) * 4;
      const dst = ((y + row) * result.width + x + col) * 4;
      source.data.copy(result.data, dst, src, src + 3);
      result.data[dst + 3] = row >= 0 && row < height && col >= 0 && col < width ? source.data[src + 3] : 0;
    }
  }
  return PNG.sync.write(result);
}
