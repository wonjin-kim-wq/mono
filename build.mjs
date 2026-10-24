import { mkdir, copyFile } from 'node:fs/promises';

await mkdir('dist', { recursive: true });
await Promise.all(['index.html', 'style.css', 'app.js'].map(file => copyFile(file, `dist/${file}`)));
console.log('mono production assets are ready in dist/');
