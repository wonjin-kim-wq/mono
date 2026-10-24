import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const entry = fileURLToPath(import.meta.resolve('@soundtouchjs/audio-worklet'));
const distribution = path.dirname(entry);
const output = 'vendor/soundtouch';
await mkdir(output, { recursive: true });
for (const file of ['SoundTouchNode.js', 'constants.js', 'soundtouch-processor.js']) {
  await copyFile(path.join(distribution, file), path.join(output, file));
}
await copyFile(path.join(distribution, '../LICENSE'), path.join(output, 'LICENSE'));
