import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDirectory = resolve('dist');

await copyFile(
  resolve(outputDirectory, 'index.html'),
  resolve(outputDirectory, '404.html'),
);

console.log('Created dist/404.html fallback.');
