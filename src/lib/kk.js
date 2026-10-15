// Everything that knows about KuantoKusta's page structure lives in this file.

export const KK_ORIGIN = 'https://www.kuantokusta.pt';

// Accepts a full URL, a path like /p/123/slug, or a bare product id.
export function parseProductUrl(input) {
  const text = String(input ?? '').trim();
  if (/^\d+$/.test(text)) return { id: Number(text), slug: '' };
  const match = text.match(/\/p\/(\d+)(?:\/([^/?#\s]+))?/);
  if (!match) return null;
  return { id: Number(match[1]), slug: match[2] ?? '' };
}

export function productUrl({ id, slug }) {
  return `${KK_ORIGIN}/p/${id}/${slug || 'p'}`;
}

export function storeUrl(storeSlug) {
  return `${KK_ORIGIN}/lojas/${storeSlug}`;
}

// KuantoKusta's own "Ver na loja" link: a short interstitial, then the store's product page.
export function followUrl(productId, sellerId) {
  return `${KK_ORIGIN}/follow/products/${productId}/offers/${sellerId}`;
}

function toNumber(value) {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  return Number.isFinite(n) ? n : null;
}

// Pulls the product and its offers out of the page's __NEXT_DATA__ JSON.
export function parseProductHtml(html) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Product data not found on page (__NEXT_DATA__ missing)');
  const data = JSON.parse(match[1]);
  const p = data?.props?.pageProps?.basePage?.product;
  if (!p?.id) throw new Error('Unexpected page structure: no product in __NEXT_DATA__');

  const offers = (p.offers ?? [])
    .map((o) => ({
      sellerId: String(o.sellerId),
      storeName: o.storeName ?? `Store ${o.sellerId}`,
      storeSlug: o.storeSlug ?? '',
      logo: o.logo ?? '',
      price: toNumber(o.price),
      shipping: toNumber(o.shipping?.minimumPrice),
      freeShipping: Boolean(o.filters?.isFreeShipping),
      lastCheckedAt: o.lastCheckedAt ?? null,
    }))
    .filter((o) => o.price != null && o.price > 0);

  const slug = (p.url ?? '').split('/').filter(Boolean).pop() ?? '';
  return {
    id: Number(p.id),
    slug,
    name: p.name ?? `Product ${p.id}`,
    image: p.imageThumbnail ?? p.images?.[0] ?? '',
    url: `${KK_ORIGIN}${p.url ?? `/p/${p.id}`}`,
    totalOffers: p.totalOffers ?? offers.length,
    offers,
  };
}

export async function fetchProductPage(ref) {
  const res = await fetch(productUrl(ref), { credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for product ${ref.id}`);
  return parseProductHtml(await res.text());
}

// Runs `worker` over `items` with at most `limit` in flight at once.
export async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
