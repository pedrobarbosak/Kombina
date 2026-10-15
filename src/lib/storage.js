import { api } from './api.js';

// storage.local keys:
//   list       [{ gid, label, qty, options: [{ id, slug, name, image, units }] }]
//              One entry per thing you want to buy. `options` are interchangeable products
//              (e.g. a 2-pack vs 2 singles): `units` is how many of that product make one
//              of the item, `qty` how many of the item you want.
//   overrides  { [sellerId]: { shipping?: number, freeAbove?: number } }
//   shipObs    { [sellerId]: { [productId]: { price, shipping, free, at } } }
//   cache:<id> { at, product }
//   basket     (v0.1 format, migrated into `list` on first read)

async function get(key, fallback) {
  const res = await api.storage.local.get(key);
  return res[key] ?? fallback;
}

function set(key, value) {
  return api.storage.local.set({ [key]: value });
}

const newGid = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const toOption = ({ id, slug = '', name = `Product ${id}`, image = '' }, units = 1) => ({
  id: Number(id),
  slug,
  name,
  image,
  units,
});

export async function getList() {
  const res = await api.storage.local.get(['list', 'basket']);
  if (res.list) return res.list;
  if (!res.basket) return [];
  const list = res.basket.map((item) => ({ gid: newGid(), label: '', qty: item.qty, options: [toOption(item)] }));
  await api.storage.local.set({ list });
  await api.storage.local.remove('basket');
  return list;
}

export const setList = (list) => set('list', list);

// `fn` may mutate the list or return a new one; returning `false` skips the write.
async function editList(fn) {
  const list = await getList();
  const result = fn(list);
  if (result === false) return list;
  const next = result ?? list;
  const cleaned = next
    .map((g) => ({ ...g, options: g.options.filter((o) => o.units > 0) }))
    .filter((g) => g.qty > 0 && g.options.length);
  await setList(cleaned);
  return cleaned;
}

export const findProduct = (list, productId) =>
  list.find((g) => g.options.some((o) => o.id === Number(productId))) ?? null;

// Adds a product as a new item. If it's already in the list, adds 1 to that item instead.
export const addItem = (product) =>
  editList((list) => {
    const existing = findProduct(list, product.id);
    if (existing) existing.qty += 1;
    else list.push({ gid: newGid(), label: '', qty: 1, options: [toOption(product)] });
  });

export const addAlternative = (gid, product, units = 1) =>
  editList((list) => {
    const group = list.find((g) => g.gid === gid);
    if (!group || group.options.some((o) => o.id === Number(product.id))) return;
    // A grouped item has no quantity of its own; each alternative carries its count.
    group.qty = 1;
    group.options.push(toOption(product, units));
  });

// Moves every product of item `fromGid` into item `toGid` as alternatives.
export const mergeItems = (fromGid, toGid) =>
  editList((list) => {
    const from = list.find((g) => g.gid === fromGid);
    const to = list.find((g) => g.gid === toGid);
    if (!from || !to || from === to) return false;
    for (const o of from.options) if (!to.options.some((t) => t.id === o.id)) to.options.push(o);
    return list.filter((g) => g !== from);
  });

export const updateItem = (gid, patch) =>
  editList((list) => list.map((g) => (g.gid === gid ? { ...g, ...patch } : g)));

export const removeItem = (gid) => updateItem(gid, { qty: 0 });

export const updateOption = (gid, productId, patch) =>
  editList((list) =>
    list.map((g) =>
      g.gid !== gid ? g : { ...g, options: g.options.map((o) => (o.id === productId ? { ...o, ...patch } : o)) },
    ),
  );

export const removeOption = (gid, productId) => updateOption(gid, productId, { units: 0 });

// Fills in canonical names/images/slugs once product pages are fetched.
export const syncProductDetails = (products) =>
  editList((list) => {
    let changed = false;
    for (const g of list) {
      for (const o of g.options) {
        const p = products.get(o.id);
        if (p && (p.name !== o.name || p.image !== o.image || p.slug !== o.slug)) {
          Object.assign(o, { name: p.name, image: p.image, slug: p.slug });
          changed = true;
        }
      }
    }
    return changed ? list : false;
  });

export const clearList = () => setList([]);

export const getOverrides = () => get('overrides', {});

export async function setOverride(sellerId, override) {
  const overrides = await getOverrides();
  if (override) overrides[sellerId] = override;
  else delete overrides[sellerId];
  await set('overrides', overrides);
  return overrides;
}

// Stores the user never wants to buy from: { [sellerId]: { name } }. Their offers are ignored.
export const getHidden = () => get('hidden', {});

export async function hideStore(sellerId, name) {
  const hidden = await getHidden();
  hidden[sellerId] = { name };
  await set('hidden', hidden);
  return hidden;
}

export async function unhideStore(sellerId) {
  const hidden = await getHidden();
  delete hidden[sellerId];
  await set('hidden', hidden);
  return hidden;
}

const OBS_MAX_AGE = 30 * 24 * 3600 * 1000;

export const getShipObs = () => get('shipObs', {});

// Remember what shipping each store charged for each product, so free-shipping
// thresholds seen on one product help estimate shipping for other lists.
export async function recordShipObs(products) {
  const obs = await getShipObs();
  const now = Date.now();
  for (const product of products) {
    for (const offer of product.offers) {
      if (offer.shipping == null) continue;
      obs[offer.sellerId] ??= {};
      obs[offer.sellerId][product.id] = {
        price: offer.price,
        shipping: offer.shipping,
        free: offer.freeShipping,
        at: now,
      };
    }
  }
  for (const sellerId of Object.keys(obs)) {
    for (const [productId, o] of Object.entries(obs[sellerId])) {
      if (now - o.at > OBS_MAX_AGE) delete obs[sellerId][productId];
    }
    if (!Object.keys(obs[sellerId]).length) delete obs[sellerId];
  }
  await set('shipObs', obs);
  return obs;
}

export async function getCached(id, maxAge) {
  const entry = await get(`cache:${id}`, null);
  if (entry && Date.now() - entry.at < maxAge) return entry;
  return null;
}

export function setCached(id, product) {
  return set(`cache:${id}`, { at: Date.now(), product });
}
