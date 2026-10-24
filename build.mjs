import { mkdir, copyFile, cp } from 'node:fs/promises';
import './prepare-audio.mjs';

await mkdir('dist', { recursive: true });
await Promise.all(['index.html', 'style.css', 'app.js', 'pitch.js'].map(file => copyFile(file, `dist/${file}`)));
await cp('media', 'dist/media', { recursive: true });
await cp('vendor', 'dist/vendor', { recursive: true });
console.log('mono production assets are ready in dist/');
