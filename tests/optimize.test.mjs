import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimize, shippingModel, shippingFor } from '../src/lib/optimize.js';

const offer = (sellerId, price, shipping = 3, freeShipping = false) => ({
  sellerId,
  storeName: `Store ${sellerId}`,
  storeSlug: `store-${sellerId}`,
  logo: '',
  price,
  shipping,
  freeShipping,
});
const item = (id, offers, qty = 1) => ({ id, name: `Product ${id}`, qty, offers });

test('picks the single store with the lowest total including shipping', () => {
  const items = [
    item(1, [offer('A', 10, 5), offer('B', 11, 2)]),
    item(2, [offer('A', 5, 5), offer('B', 5.5, 2)]),
  ];
  const r = optimize(items);
  // A: 15 + 5 = 20, B: 16.5 + 2 = 18.5
  assert.equal(r.best.sellerId, 'B');
  assert.equal(r.best.total, 18.5);
  assert.equal(r.stores[1].total, 20);
});

test('multiplies by quantity', () => {
  const items = [item(1, [offer('A', 10, 3), offer('B', 9, 6)], 3)];
  const r = optimize(items);
  // A: 30 + 3 = 33, B: 27 + 6 = 33 -> tie broken by name
  assert.equal(r.best.total, 33);
  assert.equal(r.best.sellerId, 'A');
  assert.equal(r.best.lines[1].lineTotal, 30);
});

test('stores missing products rank after complete ones, by coverage', () => {
  const items = [
    item(1, [offer('A', 10), offer('B', 1), offer('C', 1)]),
    item(2, [offer('A', 10), offer('B', 1)]),
    item(3, [offer('A', 10)]),
  ];
  const r = optimize(items);
  assert.deepEqual(r.stores.map((s) => s.sellerId), ['A', 'B', 'C']);
  assert.deepEqual(r.stores[1].missing, [3]);
  assert.equal(r.stores[2].covered, 1);
});

test('no complete store -> best is null and a 2-store split is offered', () => {
  const items = [
    item(1, [offer('A', 10, 3), offer('C', 12, 1)]),
    item(2, [offer('B', 20, 4), offer('C', 18, 1)]),
    item(3, [offer('B', 5, 4)]),
  ];
  const r = optimize(items);
  assert.equal(r.best, null);
  // Possible splits: A(1)+B(2,3) = 13 + 29 = 42; B(2,3)+C(1) = 29 + 13 = 42;
  // C(1,2)+B(3) = 31 + 9 = 40 is the cheapest.
  assert.equal(r.bestSplit.total, 40);
  const bySeller = Object.fromEntries(r.bestSplit.parts.map((p) => [p.sellerId, p.itemIds]));
  assert.deepEqual(bySeller, { B: [3], C: [1, 2] });
});

test('split is reported with savings when cheaper than the best single store', () => {
  const items = [
    item(1, [offer('A', 10, 1), offer('B', 30, 1)]),
    item(2, [offer('A', 30, 1), offer('B', 10, 1)]),
  ];
  const r = optimize(items);
  assert.equal(r.best.total, 41);
  assert.equal(r.bestSplit.total, 22);
  assert.equal(r.splitSaves, 19);
});

test('duplicate offers from the same store use the cheapest one', () => {
  const r = optimize([item(1, [offer('A', 10), offer('A', 8)])]);
  assert.equal(r.best.lines[1].price, 8);
});

test('floor is the cheapest price per product ignoring shipping', () => {
  const items = [item(1, [offer('A', 10), offer('B', 7)], 2), item(2, [offer('A', 3)])];
  assert.equal(optimize(items).floor, 17);
});

test('products with no offers are listed as unavailable', () => {
  const r = optimize([item(1, [offer('A', 10)]), item(2, [])]);
  assert.deepEqual(r.unavailable, [2]);
  assert.equal(r.best, null);
});

test('free-shipping threshold is estimated from 0-shipping offers on pricier items', () => {
  const model = shippingModel([
    { price: 17.71, shipping: 3, free: false },
    { price: 18.14, shipping: 3, free: false },
    { price: 30.34, shipping: 0, free: false },
  ]);
  assert.equal(model.base, 3);
  assert.equal(model.freeAbove, 30.34);
  assert.equal(model.estimated, true);
  assert.deepEqual(shippingFor(model, 15), { cost: 3, kind: 'paid' });
  assert.deepEqual(shippingFor(model, 25), { cost: 3, kind: 'maybe' });
  assert.deepEqual(shippingFor(model, 31), { cost: 0, kind: 'threshold' });
});

test('a free offer cheaper than a paid one is treated as a promo, not a threshold', () => {
  const model = shippingModel([
    { price: 5, shipping: 0, free: false },
    { price: 20, shipping: 3.5, free: false },
  ]);
  assert.equal(model.freeAbove, null);
  assert.deepEqual(shippingFor(model, 100), { cost: 3.5, kind: 'paid' });
});

test('store with only free offers ships free', () => {
  const model = shippingModel([{ price: 19.75, shipping: 0, free: false }]);
  assert.deepEqual(shippingFor(model, 5), { cost: 0, kind: 'free' });
});

test('basket subtotal reaching the estimated threshold makes shipping free', () => {
  // Store A charged 3 on a 10 € item but 0 on a 25 € item it sold for another product.
  const items = [item(1, [offer('A', 10, 3)], 3)];
  const shipObs = { A: { 99: { price: 25, shipping: 0, free: false } } };
  const r = optimize(items, { shipObs });
  assert.equal(r.best.subtotal, 30);
  assert.equal(r.best.shipping.cost, 0);
  assert.equal(r.best.shipping.kind, 'threshold');
});

test('manual overrides replace scraped shipping', () => {
  const items = [item(1, [offer('A', 40, 3)])];
  let r = optimize(items, { overrides: { A: { shipping: 6 } } });
  assert.equal(r.best.total, 46);
  assert.equal(r.best.shippingModel.source, 'manual');

  r = optimize(items, { overrides: { A: { freeAbove: 39 } } });
  assert.equal(r.best.total, 40);

  r = optimize(items, { overrides: { A: { shipping: 6, freeAbove: 50 } } });
  assert.equal(r.best.total, 46);
});

test('live offer data overrides stored history for the same product', () => {
  const items = [item(1, [offer('A', 10, 4)])];
  const shipObs = { A: { 1: { price: 10, shipping: 0, free: false } } };
  assert.equal(optimize(items, { shipObs }).best.shipping.cost, 4);
});

// ---------- alternatives ----------

const alt = (productId, units, offers) => ({ productId, name: `Product ${productId}`, units, offers });
const need = (id, options, qty = 1) => ({ id, name: `Need ${id}`, qty, options });

test('each store uses its cheapest alternative (2 singles vs a 2-pack)', () => {
  const items = [
    need('cream', [
      alt(100, 1, [offer('A', 30, 3), offer('B', 26, 3)]), // 2x500ml pack
      alt(200, 2, [offer('A', 12, 3), offer('B', 15, 3)]), // 500ml single, need 2
    ]),
  ];
  const r = optimize(items);
  const a = r.stores.find((s) => s.sellerId === 'A');
  const b = r.stores.find((s) => s.sellerId === 'B');
  // A: pack 30 vs 2 × 12 = 24 -> singles. B: pack 26 vs 2 × 15 = 30 -> pack.
  assert.deepEqual([a.lines.cream.productId, a.lines.cream.qty, a.lines.cream.lineTotal], [200, 2, 24]);
  assert.deepEqual([b.lines.cream.productId, b.lines.cream.qty, b.lines.cream.lineTotal], [100, 1, 26]);
  assert.equal(r.best.sellerId, 'A');
  assert.equal(r.cheapest.cream, 24);
  assert.equal(r.cheapestOption.cream, 1);
});

test('an alternative lets a store cover an item it would otherwise miss', () => {
  const items = [
    need('oil', [alt(1, 1, [offer('A', 15)]), alt(2, 1, [offer('B', 14)])]), // bottle vs refill
    need('pills', [alt(3, 1, [offer('B', 5)])]),
  ];
  const r = optimize(items);
  assert.equal(r.best.sellerId, 'B');
  assert.equal(r.best.lines.oil.productId, 2);
  assert.equal(r.best.total, 22);
});

test('item quantity multiplies the units of the chosen alternative', () => {
  const items = [need('x', [alt(1, 2, [offer('A', 5, 0)])], 3)];
  const r = optimize(items);
  assert.equal(r.best.lines.x.qty, 6);
  assert.equal(r.best.total, 30);
});

test('splits compare the best alternative at each store', () => {
  const items = [
    need('n1', [alt(1, 1, [offer('A', 10, 1)]), alt(2, 1, [offer('B', 4, 1)])]),
    need('n2', [alt(3, 1, [offer('A', 4, 1), offer('B', 10, 1)])]),
  ];
  const r = optimize(items);
  // Single: A = 14 + 1 = 15, B = 14 + 1 = 15. Split: B(n1 via alt 2) + A(n2) = 5 + 5 = 10.
  assert.equal(r.bestSplit.total, 10);
  const parts = Object.fromEntries(r.bestSplit.parts.map((p) => [p.sellerId, p.itemIds]));
  assert.deepEqual(parts, { A: ['n2'], B: ['n1'] });
});

test('an item is unavailable only when none of its alternatives has offers', () => {
  const items = [need('a', [alt(1, 1, []), alt(2, 1, [offer('A', 3)])]), need('b', [alt(3, 1, [])])];
  assert.deepEqual(optimize(items).unavailable, ['b']);
});

// ---------- bundled defaults ----------

test('bundled threshold applies; bundled cost is only a fallback', () => {
  const defaults = { A: { shipping: 3.9, freeAbove: 30 } };
  // KuantoKusta showed 4 € on a cheap item: keep 4 €, but use the bundled threshold.
  let r = optimize([item(1, [offer('A', 10, 4)], 2)], { defaults });
  assert.equal(r.best.shipping.cost, 4);
  assert.equal(r.best.shippingModel.source, 'bundled');
  r = optimize([item(1, [offer('A', 10, 4)], 3)], { defaults });
  assert.deepEqual(r.best.shipping, { cost: 0, kind: 'threshold' });
  // Only a free offer seen (item above threshold): fall back to the bundled cost for small baskets.
  r = optimize([item(1, [offer('A', 10, 0)])], { defaults });
  assert.equal(r.best.shipping.cost, 3.9);
});

test('user override beats bundled defaults', () => {
  const r = optimize([item(1, [offer('A', 10, 4)])], {
    defaults: { A: { shipping: 3.9, freeAbove: 30 } },
    overrides: { A: { freeAbove: 5 } },
  });
  assert.equal(r.best.shipping.cost, 0);
  assert.equal(r.best.shippingModel.source, 'manual');
});
