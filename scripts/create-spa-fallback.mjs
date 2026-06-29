import { access, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDirectory = resolve('docs');
const indexPath = resolve(outputDirectory, 'index.html');
const fallbackPath = resolve(outputDirectory, '404.html');

try {
  await access(indexPath);
} catch {
  throw new Error(`Cannot create SPA fallback: ${indexPath} does not exist.`);
}

await copyFile(indexPath, fallbackPath);

console.log('Created docs/404.html fallback.');
