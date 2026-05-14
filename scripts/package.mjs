#!/usr/bin/env node
// Builds a distributable .eagleplugin zip from manifest.json, logo.png,
// README.md and the built dist/ output.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const outName = `${manifest.id}-${manifest.version}.eagleplugin`;

if (!existsSync(join(root, 'dist'))) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const entries = ['manifest.json', 'logo.png', 'README.md', 'dist'].filter((p) =>
  existsSync(join(root, p)),
);

const result = spawnSync('zip', ['-r', '-X', outName, ...entries], {
  cwd: root,
  stdio: 'inherit',
});

if (result.status !== 0) {
  console.error('zip failed. Ensure the `zip` CLI is installed.');
  process.exit(result.status ?? 1);
}

console.log(`Wrote ${join(root, outName)}`);
