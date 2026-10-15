// Pure basket optimization. No browser APIs, so it runs under `node --test`.

const round = (n) => Math.round(n * 100) / 100;

// Works out a store's shipping rule from what KuantoKusta showed on its offers.
// `observations`: [{ price, shipping, free }] for that store, across products.
// KuantoKusta shows 0 shipping on offers above the store's free-shipping
// threshold, so a 0 on a pricier item and a fee on a cheaper one lets us
// estimate the threshold.
// `defaults` are bundled values from the store's own site (src/data/stores.json);
// `override` are the user's. Priority: override > defaults > estimate.
export function shippingModel(observations, override = {}, defaults = {}) {
  const paid = observations.filter((o) => !o.free && o.shipping > 0);
  const free = observations.filter((o) => o.free || o.shipping === 0);

  let base = paid.length ? Math.max(...paid.map((o) => o.shipping)) : 0;
  let freeAbove = null;
  let estimated = false;
  let paidUpTo = paid.length ? Math.max(...paid.map((o) => o.price)) : 0;

  if (paid.length && free.length) {
    // Ignore "free" offers cheaper than a paid one (promos), they don't reveal a threshold.
    const candidates = free.map((o) => o.price).filter((p) => p > paidUpTo);
    if (candidates.length) {
      freeAbove = Math.min(...candidates);
      estimated = true;
    }
  }

  let source = 'kuantokusta';
  // KuantoKusta's per-offer shipping is current, so the bundled cost is only a fallback
  // for when every offer we saw was above the threshold (shows 0 €).
  if (defaults.shipping != null && !paid.length) {
    base = defaults.shipping;
    source = 'bundled';
  }
  if (defaults.freeAbove != null) {
    freeAbove = defaults.freeAbove;
    estimated = false;
    source = 'bundled';
  }
  if (override.shipping != null) {
    base = override.shipping;
    freeAbove = null;
    estimated = false;
    paidUpTo = 0;
    source = 'manual';
  }
  if (override.freeAbove != null) {
    freeAbove = override.freeAbove;
    estimated = false;
    source = 'manual';
  }
  return { base, freeAbove, estimated, paidUpTo, source };
}

// kind: 'free' | 'threshold' (free because subtotal >= freeAbove) |
//       'maybe' (paid, but might be free: between the last paid and first free price seen) | 'paid'
export function shippingFor(model, subtotal) {
  if (model.base === 0) return { cost: 0, kind: 'free' };
  if (model.freeAbove != null && subtotal >= model.freeAbove) return { cost: 0, kind: 'threshold' };
  if (model.estimated && subtotal > model.paidUpTo) return { cost: model.base, kind: 'maybe' };
  return { cost: model.base, kind: 'paid' };
}

// Accepts items with alternatives ({ options: [{ productId, units, offers }] }) or plain
// items ({ offers }), which are treated as a single option of 1 unit.
function normalize(items) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    qty: item.qty ?? 1,
    options: (item.options ?? [{ productId: item.id, name: item.name, offers: item.offers }]).map((o) => ({
      productId: o.productId,
      name: o.name ?? item.name,
      units: o.units ?? 1,
      offers: o.offers ?? [],
    })),
  }));
}

function collectStores(needs, shipObs) {
  const stores = new Map();
  const options = needs.flatMap((need) => need.options);
  for (const option of options) {
    for (const offer of option.offers) {
      let store = stores.get(offer.sellerId);
      if (!store) {
        store = {
          sellerId: offer.sellerId,
          storeName: offer.storeName,
          storeSlug: offer.storeSlug,
          logo: offer.logo,
          offers: new Map(),
          observations: new Map(Object.entries(shipObs[offer.sellerId] ?? {})),
        };
        stores.set(offer.sellerId, store);
      }
      const current = store.offers.get(option.productId);
      if (!current || offer.price < current.price) store.offers.set(option.productId, offer);
      // Live data beats the stored history for this product.
      store.observations.set(String(option.productId), {
        price: offer.price,
        shipping: offer.shipping,
        free: offer.freeShipping,
      });
    }
  }
  return stores;
}

// The cheapest way to buy `need` at `store`, across its alternatives (null if none sold there).
function bestOption(store, need) {
  let best = null;
  need.options.forEach((option, optionIndex) => {
    const offer = store.offers.get(option.productId);
    if (!offer) return;
    const qty = option.units * need.qty;
    const lineTotal = round(offer.price * qty);
    if (!best || lineTotal < best.lineTotal) {
      best = { optionIndex, productId: option.productId, name: option.name, price: offer.price, qty, lineTotal };
    }
  });
  return best;
}

function priceStore(store, needs, model) {
  const lines = {};
  const missing = [];
  let subtotal = 0;
  for (const need of needs) {
    const line = bestOption(store, need);
    if (!line) {
      missing.push(need.id);
      continue;
    }
    lines[need.id] = line;
    subtotal += line.lineTotal;
  }
  subtotal = round(subtotal);
  const shipping = shippingFor(model, subtotal);
  return {
    sellerId: store.sellerId,
    storeName: store.storeName,
    storeSlug: store.storeSlug,
    logo: store.logo,
    shippingModel: model,
    lines,
    covered: needs.length - missing.length,
    missing,
    complete: missing.length === 0,
    subtotal,
    shipping,
    total: round(subtotal + shipping.cost),
  };
}

function compareStores(a, b) {
  if (a.complete !== b.complete) return a.complete ? -1 : 1;
  if (!a.complete && a.covered !== b.covered) return b.covered - a.covered;
  return a.total - b.total || a.storeName.localeCompare(b.storeName);
}

function bestSplits(needs, stores, models, limit) {
  const list = [...stores.values()];
  const splits = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const toA = [];
      const toB = [];
      let ok = true;
      for (const need of needs) {
        const la = bestOption(a, need);
        const lb = bestOption(b, need);
        if (!la && !lb) {
          ok = false;
          break;
        }
        if (la && (!lb || la.lineTotal <= lb.lineTotal)) toA.push(need);
        else toB.push(need);
      }
      if (!ok || !toA.length || !toB.length) continue;
      const pa = priceStore(a, toA, models.get(a.sellerId));
      const pb = priceStore(b, toB, models.get(b.sellerId));
      splits.push({
        parts: [
          { ...pa, itemIds: toA.map((it) => it.id) },
          { ...pb, itemIds: toB.map((it) => it.id) },
        ],
        subtotal: round(pa.subtotal + pb.subtotal),
        shipping: round(pa.shipping.cost + pb.shipping.cost),
        total: round(pa.total + pb.total),
      });
    }
  }
  splits.sort((x, y) => x.total - y.total);
  return splits.slice(0, limit);
}

// items: [{ id, name, qty, options: [{ productId, name, units, offers }] }]
//   offers: [{ sellerId, storeName, storeSlug, logo, price, shipping, freeShipping }]
//   (or { id, name, qty, offers } for an item without alternatives)
// overrides: { [sellerId]: { shipping?, freeAbove? } }
// shipObs: { [sellerId]: { [productId]: { price, shipping, free } } } (history from earlier fetches)
export function optimize(items, { overrides = {}, defaults = {}, shipObs = {}, splitLimit = 5 } = {}) {
  const needs = normalize(items);
  const stores = collectStores(needs, shipObs);
  const models = new Map();
  for (const store of stores.values()) {
    models.set(
      store.sellerId,
      shippingModel([...store.observations.values()], overrides[store.sellerId], defaults[store.sellerId]),
    );
  }

  const ranked = [...stores.values()]
    .map((store) => priceStore(store, needs, models.get(store.sellerId)))
    .sort(compareStores);
  const best = ranked[0]?.complete ? ranked[0] : null;

  const splits = needs.length > 1 ? bestSplits(needs, stores, models, splitLimit) : [];
  const bestSplit = splits[0] ?? null;

  // Cheapest cost per item anywhere (best alternative, ignoring shipping).
  // cheapest[itemId] = line total; cheapestOption[itemId] = index of that alternative.
  const cheapest = {};
  const cheapestOption = {};
  let floor = 0;
  for (const need of needs) {
    let min = null;
    need.options.forEach((option, i) => {
      if (!option.offers.length) return;
      const cost = round(Math.min(...option.offers.map((o) => o.price)) * option.units * need.qty);
      if (min == null || cost < min) {
        min = cost;
        cheapestOption[need.id] = i;
      }
    });
    cheapest[need.id] = min;
    if (min != null) floor += min;
  }

  return {
    stores: ranked,
    best,
    splits,
    bestSplit,
    splitSaves: best && bestSplit ? round(best.total - bestSplit.total) : null,
    cheapest,
    cheapestOption,
    floor: round(floor),
    unavailable: needs.filter((need) => need.options.every((o) => !o.offers.length)).map((need) => need.id),
  };
}
