#!/usr/bin/env node
// Builds a distributable zip for the Eagle plugin.
//
// Bundles only the files Eagle needs to load the plugin:
//   - manifest.json
//   - logo.png
//   - dist/ (the built UI)
//
// Excludes node_modules/, .git/, source files, dev configs, and other build
// scaffolding so the resulting archive is a drop-in plugin folder.
//
// Output: eagle-runware-<version>.zip at the plugin root (gitignored).
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const outName = `eagle-runware-${manifest.version}.zip`;
const outPath = join(root, outName);

if (!existsSync(join(root, 'dist'))) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const required = ['manifest.json', 'logo.png', 'dist'];
for (const entry of required) {
  const p = join(root, entry);
  if (!existsSync(p)) {
    console.error(`Missing required entry: ${entry}`);
    process.exit(1);
  }
}

// Sanity-check: ensure dist actually contains the built index.html.
const indexHtml = join(root, 'dist', 'index.html');
if (!existsSync(indexHtml) || !statSync(indexHtml).isFile()) {
  console.error('dist/index.html missing — run `npm run build` first.');
  process.exit(1);
}

// Remove any stale archive so the new build is unambiguous.
if (existsSync(outPath)) rmSync(outPath, { force: true });

// `zip -r` walks the listed entries only; this is implicitly an allow-list,
// so node_modules/, .git/, src/, etc. are excluded by construction.
const result = spawnSync(
  'zip',
  [
    '-r',
    '-X', // strip extra file attributes for reproducibility
    outName,
    ...required,
    // Defensive deny-list in case dist/ ever picks up these files:
    '-x',
    '*/.DS_Store',
    '*/node_modules/*',
    '*.map',
  ],
  { cwd: root, stdio: 'inherit' },
);

if (result.status !== 0) {
  console.error('zip failed. Ensure the `zip` CLI is installed.');
  process.exit(result.status ?? 1);
}

const sizeKB = (statSync(outPath).size / 1024).toFixed(1);
console.log(`\nWrote ${outPath} (${sizeKB} KB)`);
