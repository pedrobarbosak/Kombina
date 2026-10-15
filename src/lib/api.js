import { KK_ORIGIN } from './kk.js';

// Firefox exposes `browser`, Chrome exposes `chrome`. Both return promises in MV3.
export const api = globalThis.browser ?? globalThis.chrome;

export const KK_PERMISSION = { origins: [`${KK_ORIGIN}/*`] };

// Firefox treats MV3 host_permissions as opt-in, so the user may need to grant them.
export async function hasSiteAccess() {
  try {
    return await api.permissions.contains(KK_PERMISSION);
  } catch {
    return true;
  }
}

// Must be called from a user gesture (click handler).
export function requestSiteAccess() {
  return api.permissions.request(KK_PERMISSION);
}
