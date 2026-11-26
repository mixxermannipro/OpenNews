import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const readmePath = path.join(root, 'README.md');
const changelogPath = path.join(root, 'CHANGELOG.md');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const readmeLines = fs.readFileSync(readmePath, 'utf8').split(/\r?\n/);
if (readmeLines.length >= 250) {
  console.error(`README.md must stay under 250 lines (currently ${readmeLines.length}).`);
  process.exit(1);
}

// Verify every local markdown link in README.md resolves cleanly on disk.
const readmeText = readmeLines.join('\n');
const linkRe = /\]\(([^)#\s]+(?:#[^)\s]*)?)\)/g;
const missingLinks = [];
for (const match of readmeText.matchAll(linkRe)) {
  const rawTarget = match[1];
  if (/^(https?:|mailto:)/i.test(rawTarget)) continue;
  const relPath = rawTarget.split('#')[0];
  if (!relPath) continue;
  if (!fs.existsSync(path.join(root, relPath))) {
    missingLinks.push(relPath);
  }
}
if (missingLinks.length > 0) {
  console.error(`README.md references missing local paths: ${missingLinks.join(', ')}`);
  process.exit(1);
}

// Verify CHANGELOG.md documents the current package.json version.
if (!fs.existsSync(changelogPath)) {
  console.error('CHANGELOG.md is missing.');
  process.exit(1);
}
const changelogText = fs.readFileSync(changelogPath, 'utf8');
if (!changelogText.includes(`## [${pkg.version}]`)) {
  console.error(`CHANGELOG.md does not contain a heading for [${pkg.version}].`);
  process.exit(1);
}

// Extract live repository metrics.
const catalogRaw = execFileSync(
  process.execPath,
  [
    '--import',
    'tsx',
    '-e',
    "import { DEFAULT_SOURCES, STARTER_PACKS } from './src/lib/catalog.ts'; import { RADIO_STATIONS } from './src/lib/radioCatalog.ts'; console.log(JSON.stringify({ sources: DEFAULT_SOURCES.length, packs: STARTER_PACKS.length, radio: RADIO_STATIONS.length }));",
  ],
  { cwd: root, encoding: 'utf8' },
);
const counts = JSON.parse(catalogRaw.trim());

const unitTestFiles = fs.readdirSync(path.join(root, 'src/lib')).filter(f => f.endsWith('.test.ts')).length;
const e2eFiles = fs.readdirSync(path.join(root, 'e2e')).filter(f => f.endsWith('.spec.ts')).length;
const androidTestRaw = fs.readFileSync(
  path.join(root, 'native/android/test/OpenNewsAndroidUnitTests.java'),
  'utf8',
);
const androidTests = (androidTestRaw.match(/@Test\b/g) || []).length;

console.log(
  `Docs metrics OK: README ${readmeLines.length} lines (<250), version ${pkg.version}, ` +
    `${counts.sources} catalog sources, ${counts.packs} starter packs, ${counts.radio} radio stations, ` +
    `${unitTestFiles} web unit test files, ${androidTests} Android JUnit tests, ${e2eFiles} Playwright specs.`,
);
