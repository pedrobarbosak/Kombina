import { fetchProductPage, mapLimit } from './kk.js';
import { getCached, setCached, recordShipObs } from './storage.js';

const CACHE_MAX_AGE = 15 * 60 * 1000;
const CONCURRENCY = 3;

// Every distinct product across all items and their alternatives.
export function productRefs(list) {
  const refs = new Map();
  for (const g of list) for (const o of g.options) if (!refs.has(o.id)) refs.set(o.id, o);
  return [...refs.values()];
}

// Loads offers for each product ref, using a 15-minute cache unless `force`.
// Returns Map<productId, { product?, error?, fetchedAt? }>.
export async function loadProducts(refs, { force = false, onProgress } = {}) {
  let done = 0;
  const entries = await mapLimit(refs, CONCURRENCY, async (ref) => {
    let result;
    try {
      const cached = force ? null : await getCached(ref.id, CACHE_MAX_AGE);
      if (cached) {
        result = { product: cached.product, fetchedAt: cached.at };
      } else {
        const product = await fetchProductPage(ref);
        await setCached(ref.id, product);
        result = { product, fetchedAt: Date.now() };
      }
    } catch (error) {
      result = { error: error.message ?? String(error) };
    }
    onProgress?.(++done, refs.length);
    return [ref.id, result];
  });
  const results = new Map(entries);
  await recordShipObs([...results.values()].filter((r) => r.product).map((r) => r.product));
  return results;
}
