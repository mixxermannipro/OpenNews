import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'));
const visited = new Set();
const files = new Set();
function collect(entry) {
  if (visited.has(entry)) return;
  visited.add(entry);
  const chunk = manifest[entry];
  if (chunk.file.endsWith('.js')) files.add(chunk.file);
  for (const dependency of chunk.imports ?? []) collect(dependency);
}
for (const [entry, chunk] of Object.entries(manifest)) {
  if (chunk.isEntry) collect(entry);
}
if (!files.size) throw new Error('No initial JavaScript found in build manifest');
let compressedBytes = 0;
for (const file of files) {
  compressedBytes += gzipSync(await readFile(`dist/${file}`)).byteLength;
}
const budget = 170 * 1024;
console.log(`Initial JavaScript: ${(compressedBytes / 1024).toFixed(1)} KiB gzip / ${budget / 1024} KiB`);
if (compressedBytes > budget) process.exitCode = 1;
