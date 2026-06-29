import { access, copyFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const outputDirectory = resolve('docs');
const indexPath = resolve(outputDirectory, 'index.html');
const fallbackPath = resolve(outputDirectory, '404.html');
const novaBuildPath = resolve(outputDirectory, 'nova.html');
const novaIndexPath = resolve(outputDirectory, 'nova', 'index.html');

try {
  await access(indexPath);
} catch {
  throw new Error(`Cannot create SPA fallback: ${indexPath} does not exist.`);
}

try {
  await access(novaBuildPath);
} catch {
  throw new Error(`Cannot create NOVA route: ${novaBuildPath} does not exist.`);
}

await mkdir(dirname(novaIndexPath), { recursive: true });
await rename(novaBuildPath, novaIndexPath);
await copyFile(indexPath, fallbackPath);

const avatarFiles = [
  'assets/avatar/final_hd_ultra_smooth/INTRO_009_TEST.mp4',
  'assets/avatar/final_hd_ultra_smooth/WAITING_HD.mp4',
  'assets/avatar/AIPEOPLE/040.mp4',
  'assets/avatar/AIPEOPLE/041.mp4',
  'assets/avatar/AIPEOPLE/042.mp4',
  'assets/avatar/AIPEOPLE/043.mp4',
];

for (const relativePath of avatarFiles) {
  const sourcePath = resolve(relativePath);
  const destinationPath = resolve(outputDirectory, relativePath);
  await access(sourcePath);
  await mkdir(dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
}

console.log('Created docs routes, SPA fallback, and NOVA avatar assets.');
