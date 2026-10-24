import { mkdir, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve('rubberband-wasm/package.json'));
await rm('vendor/soundtouch', { recursive: true, force: true });
await mkdir('vendor/rubberband', { recursive: true });
await mkdir('vendor/metadata', { recursive: true });
await copyFile(path.join(root, 'dist/index.esm.js'), 'vendor/rubberband/index.js');
await copyFile(path.join(root, 'dist/rubberband.wasm'), 'vendor/rubberband/rubberband.wasm');
await copyFile(path.join(root, 'LICENSE'), 'vendor/rubberband/LICENSE');
// Include the original wrapper source and reproducible WASM build instructions.
await copyFile(path.join(root, 'src/index.ts'), 'vendor/rubberband/source.ts');
await copyFile(path.join(root, 'src/rubberband.c'), 'vendor/rubberband/rubberband.c');
await copyFile(path.join(root, 'build.sh'), 'vendor/rubberband/build.sh');
const metadataRoot=path.resolve(path.dirname(require.resolve('music-metadata')),'..');
await copyFile(path.join(metadataRoot,'LICENSE.txt'),'vendor/metadata/LICENSE');
await build({
  stdin: { contents: "export { parseBuffer } from 'music-metadata';", resolveDir: process.cwd() },
  platform: 'browser', format: 'esm', bundle: true, minify: true,
  outfile: 'vendor/metadata/index.js', legalComments: 'eof',
});
