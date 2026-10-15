import { api } from './api.js';
import { remoteStoresUrl, STORES_PATH } from './config.js';

const REMOTE_MAX_AGE = 24 * 60 * 60 * 1000;

// Shipping rules per store: the bundled data/stores.json, overlaid with the copy on GitHub
// when a repo is configured (fetched at most once a day, cached in storage.local).
export async function loadStoreRules({ force = false } = {}) {
  let bundled = {};
  try {
    bundled = await (await fetch(api.runtime.getURL(STORES_PATH))).json();
  } catch {
    // Keep going with an empty set.
  }
  const url = remoteStoresUrl();
  if (!url) return { rules: bundled, remoteAt: null };

  let { remoteStores: remote } = await api.storage.local.get('remoteStores');
  if (force || !remote || Date.now() - remote.at > REMOTE_MAX_AGE) {
    try {
      const data = await (await fetch(url, { cache: 'no-store' })).json();
      if (data && typeof data === 'object') {
        remote = { at: Date.now(), data };
        await api.storage.local.set({ remoteStores: remote });
      }
    } catch {
      // Offline or not granted: use what we have.
    }
  }
  return { rules: { ...bundled, ...(remote?.data ?? {}) }, remoteAt: remote?.at ?? null };
}
