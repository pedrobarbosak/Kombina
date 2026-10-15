import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProductUrl, parseProductHtml, productUrl, mapLimit } from '../src/lib/kk.js';

// Trimmed copy of the real __NEXT_DATA__ shape from a KuantoKusta product page (2026-10).
const nextData = {
  props: {
    pageProps: {
      basePage: {
        product: {
          id: 3291388,
          name: 'Bioderma Atoderm Creme Ultra Hidratante 2x500ml',
          imageThumbnail: 'https://s1.kuantokusta.pt/img.jpg',
          url: '/p/3291388/bioderma-atoderm-creme-ultra-hidratante-2x500ml',
          totalOffers: 3,
          offers: [
            {
              sellerId: 7740,
              storeName: 'Aveiro Farma',
              storeSlug: 'aveiro-farma',
              logo: 'https://s1.kuantokusta.pt/7740.png',
              price: 26.99,
              shipping: { expectedDeliveryDate: null, minimumPrice: 4.5 },
              filters: { isFreeShipping: false },
              lastCheckedAt: '2026-10-14T23:26:24.000Z',
            },
            {
              sellerId: 13294,
              storeName: 'Total Care',
              storeSlug: 'total-care',
              price: 30.41,
              shipping: { minimumPrice: 0 },
              filters: { isFreeShipping: true },
            },
            { sellerId: 1, storeName: 'Broken', price: null, shipping: {} },
          ],
        },
      },
    },
  },
};
const html = `<html><head></head><body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></body></html>`;

test('parseProductUrl handles URLs, paths and ids', () => {
  assert.deepEqual(
    parseProductUrl('https://www.kuantokusta.pt/p/3422263/itf-farma-natalben-lactacao-60-capsulas?queryId=abc'),
    { id: 3422263, slug: 'itf-farma-natalben-lactacao-60-capsulas' },
  );
  assert.deepEqual(parseProductUrl('/p/123'), { id: 123, slug: '' });
  assert.deepEqual(parseProductUrl(' 456 '), { id: 456, slug: '' });
  assert.equal(parseProductUrl('https://www.kuantokusta.pt/search?q=brufen'), null);
  assert.equal(parseProductUrl(''), null);
});

test('productUrl works without a slug (site redirects to the canonical one)', () => {
  assert.equal(productUrl({ id: 1, slug: '' }), 'https://www.kuantokusta.pt/p/1/p');
});

test('parseProductHtml extracts product and normalized offers', () => {
  const p = parseProductHtml(html);
  assert.equal(p.id, 3291388);
  assert.equal(p.slug, 'bioderma-atoderm-creme-ultra-hidratante-2x500ml');
  assert.equal(p.url, 'https://www.kuantokusta.pt/p/3291388/bioderma-atoderm-creme-ultra-hidratante-2x500ml');
  assert.equal(p.offers.length, 2, 'offers without a price are dropped');
  assert.deepEqual(p.offers[0], {
    sellerId: '7740',
    storeName: 'Aveiro Farma',
    storeSlug: 'aveiro-farma',
    logo: 'https://s1.kuantokusta.pt/7740.png',
    price: 26.99,
    shipping: 4.5,
    freeShipping: false,
    lastCheckedAt: '2026-10-14T23:26:24.000Z',
  });
  assert.equal(p.offers[1].freeShipping, true);
});

test('parseProductHtml throws a clear error on unexpected pages', () => {
  assert.throws(() => parseProductHtml('<html>blocked</html>'), /__NEXT_DATA__ missing/);
});

test('mapLimit keeps order and respects the limit', async () => {
  let inFlight = 0;
  let peak = 0;
  const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
    peak = Math.max(peak, ++inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return n * 10;
  });
  assert.deepEqual(out, [10, 20, 30, 40, 50]);
  assert.equal(peak, 2);
});
