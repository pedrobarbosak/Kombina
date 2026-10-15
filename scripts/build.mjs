// Builds the store packages: dist/kombina-firefox-<version>.zip and dist/kombina-chrome-<version>.zip.
// Each gets its own manifest: Firefox keeps background.scripts and the gecko settings,
// Chrome keeps background.service_worker and drops the Firefox-only keys.
// Usage: node scripts/build.mjs [firefox|chrome]   (both by default)
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
const SHIP = ['_locales', 'icons', 'src', 'data/stores.json', 'LICENSE'];

const variants = {
  firefox(m) {
    delete m.background.service_worker;
    return m;
  },
  chrome(m) {
    delete m.background.scripts;
    delete m.browser_specific_settings;
    return m;
  },
};

const targets = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(variants);
mkdirSync(dist, { recursive: true });

for (const target of targets) {
  if (!variants[target]) throw new Error(`unknown target: ${target}`);
  const stage = join(dist, target);
  rmSync(stage, { recursive: true, force: true });
  for (const path of SHIP) cpSync(join(root, path), join(stage, path), { recursive: true });
  const m = variants[target](structuredClone(manifest));
  writeFileSync(join(stage, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
  const filename = `kombina-${target}-${manifest.version}.zip`;
  execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['web-ext', 'build', '--no-config-discovery', '-s', stage, '-a', dist, '--filename', filename, '--overwrite-dest'],
    { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' },
  );
  console.log(`built dist/${filename}`);
}
