import { mkdir, copyFile, cp, rm } from 'node:fs/promises';
import './prepare-audio.mjs';

await rm('dist',{recursive:true,force:true});
await mkdir('dist', { recursive: true });
await Promise.all(['index.html', 'style.css', 'app.js', 'pitch.js'].map(file => copyFile(file, `dist/${file}`)));
await cp('audio', 'dist/audio', { recursive: true });
await cp('media', 'dist/media', { recursive: true });
await cp('vendor', 'dist/vendor', { recursive: true });
console.log('mono production assets are ready in dist/');
