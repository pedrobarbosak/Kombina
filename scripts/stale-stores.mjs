// Lists stores in data/stores.json whose shipping rules were checked more than N days ago.
// Usage: node scripts/stale-stores.mjs [days=90] [--markdown]
// Exits with code 1 when there are stale entries (used by .github/workflows/stale-stores.yml).
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const days = Number(args.find((a) => /^\d+$/.test(a)) ?? 90);
const markdown = args.includes('--markdown');

const file = resolve(dirname(fileURLToPath(import.meta.url)), '../data/stores.json');
const stores = JSON.parse(readFileSync(file, 'utf8'));
const cutoff = Date.now() - days * 24 * 3600 * 1000;

const stale = Object.entries(stores)
  .filter(([, s]) => !s.checked || new Date(s.checked).getTime() < cutoff)
  .sort(([, a], [, b]) => (a.checked ?? '').localeCompare(b.checked ?? ''));

if (!stale.length) {
  console.log(`All ${Object.keys(stores).length} stores were checked in the last ${days} days.`);
  process.exit(0);
}

if (markdown) {
  console.log(`These stores' shipping rules in \`data/stores.json\` were last checked more than ${days} days ago.`);
  console.log('Re-check each store page, update `shipping`, `freeAbove`, `notes` and `checked`, then close this issue.\n');
  console.log('| Store | sellerId | Shipping | Free from | Checked | Source |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  for (const [id, s] of stale) {
    const eur = (v) => (v == null ? '—' : `${v.toFixed(2).replace('.', ',')} €`);
    console.log(`| ${s.name} | ${id} | ${eur(s.shipping)} | ${eur(s.freeAbove)} | ${s.checked ?? 'never'} | ${s.source || '—'} |`);
  }
} else {
  for (const [id, s] of stale) console.log(`${s.checked ?? 'never'}  ${id.padEnd(6)} ${s.name}`);
  console.log(`\n${stale.length} of ${Object.keys(stores).length} stores need a re-check (older than ${days} days).`);
}
process.exit(1);
