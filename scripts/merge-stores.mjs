// Merges researched shipping rules into data/stores.json.
// Usage: node scripts/merge-stores.mjs research-a.json research-b.json ...
// Each input is a JSON array of { sellerId, name, domain, shipping, freeAbove, notes, source, checked, confidence }.
// Entries with confidence "low" and no values are skipped; existing entries are replaced by newer ones.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../data/stores.json');
const current = JSON.parse(readFileSync(out, 'utf8'));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null);

let added = 0;
for (const file of process.argv.slice(2)) {
  for (const row of JSON.parse(readFileSync(file, 'utf8'))) {
    const shipping = num(row.shipping);
    const freeAbove = num(row.freeAbove);
    if (shipping == null && freeAbove == null) continue;
    current[String(row.sellerId)] = {
      name: row.name,
      domain: row.domain ?? '',
      shipping,
      freeAbove,
      notes: (row.notes_pt ?? row.notes ?? '').slice(0, 200),
      notes_en: (row.notes_en ?? row.notes ?? '').slice(0, 200),
      source: row.source ?? '',
      checked: row.checked ?? new Date().toISOString().slice(0, 10),
      confidence: row.confidence ?? 'medium',
    };
    added++;
  }
}
const sorted = Object.fromEntries(Object.entries(current).sort(([, a], [, b]) => a.name.localeCompare(b.name)));
writeFileSync(out, JSON.stringify(sorted, null, 2) + '\n');
console.log(`${added} stores merged, ${Object.keys(sorted).length} total in ${out}`);
