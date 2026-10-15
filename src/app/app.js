import { api, hasSiteAccess, requestSiteAccess } from '../lib/api.js';
import { parseProductUrl, productUrl, storeUrl, followUrl } from '../lib/kk.js';
import { optimize, shippingModel } from '../lib/optimize.js';
import { loadProducts, productRefs } from '../lib/products.js';
import {
  getList,
  addItem,
  addAlternative,
  updateItem,
  removeItem,
  updateOption,
  removeOption,
  findProduct,
  clearList,
  syncProductDetails,
  getOverrides,
  setOverride,
  getShipObs,
  getHidden,
  hideStore,
  unhideStore,
} from '../lib/storage.js';
import { loadStoreRules } from '../lib/stores-data.js';
import { storesFileUrl, issueUrl, STORES_PATH } from '../lib/config.js';
import { esc, money, $ } from '../shared/dom.js';
import { t, tn, setLang, getLang, applyStatic, DEFAULT_LANG } from '../shared/i18n.js';

const STORES_SHOWN = 6;
const RULES_SHOWN = 10;

const state = {
  list: [],
  products: new Map(), // productId -> { product?, error?, fetchedAt? }
  overrides: {},
  hidden: {}, // stores excluded from the comparison
  defaults: null, // data/stores.json (+ GitHub copy): shipping rules from the stores' own sites
  remoteAt: null,
  shipObs: {},
  items: [], // optimizer input, one per list item (id = gid)
  result: null,
  loading: false,
  showAllStores: false,
  showAllRules: false,
  rulesQuery: '',
};

// Words all alternatives start with, e.g. "Bioderma Atoderm Creme Ultra" for
// "… Creme Ultra Hidratante 2x500ml" and "… Creme Ultra 500ml". Empty if fewer than 2 words.
function sharedPrefix(names) {
  if (names.length < 2) return '';
  const words = names.map((n) => n.split(/\s+/));
  const prefix = [];
  for (let i = 0; i < Math.min(...words.map((w) => w.length)); i++) {
    const w = words[0][i];
    if (!words.every((ws) => ws[i].localeCompare(w, undefined, { sensitivity: 'base' }) === 0)) break;
    prefix.push(w);
  }
  if (prefix.length < 2 || prefix.length === Math.min(...words.map((w) => w.length))) return '';
  return prefix.join(' ');
}

const itemLabel = (g) =>
  g.label || (g.options.length > 1 && sharedPrefix(g.options.map((o) => o.name))) || g.options[0]?.name || 'Item';

const groupOf = (gid) => state.list.find((g) => g.gid === gid);
const productOf = (id) => state.products.get(id)?.product ?? null;
const loadedProducts = () =>
  new Map([...state.products].filter(([, e]) => e.product).map(([id, e]) => [id, e.product]));
const storeNotes = (d) => (getLang() === 'en' ? d?.notes_en || d?.notes : d?.notes) ?? '';

// ---------- language ----------

async function initLang() {
  const { lang } = await api.storage.local.get('lang');
  setLang(lang ?? DEFAULT_LANG);
  applyLang();
}

function applyLang() {
  applyStatic();
  $('#empty').innerHTML = t('empty_html', { add: t('btn_add') });
  for (const button of document.querySelectorAll('.lang button')) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === getLang()));
  }
}

// ---------- theme ----------

function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  for (const button of document.querySelectorAll('.theme button')) {
    button.setAttribute('aria-pressed', String(button.dataset.theme === (theme ?? 'auto')));
  }
}

api.storage.local.get('theme').then(({ theme }) => applyTheme(theme ?? 'auto'));

document.querySelector('.theme').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-theme]');
  if (!button) return;
  applyTheme(button.dataset.theme);
  await api.storage.local.set({ theme: button.dataset.theme });
});

// ---------- tabs ----------

const TABS = { compare: '#comparar', rules: '#portes' };

function showTab() {
  const tab = Object.keys(TABS).find((key) => TABS[key] === location.hash) ?? 'compare';
  for (const [key] of Object.entries(TABS)) $(`#tab-${key}`).hidden = key !== tab;
  for (const link of document.querySelectorAll('.tabs a')) {
    if (link.dataset.tab === tab) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

window.addEventListener('hashchange', showTab);
showTab();

document.querySelector('.lang').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-lang]');
  if (!button) return;
  setLang(button.dataset.lang);
  await api.storage.local.set({ lang: getLang() });
  applyLang();
  if (state.result) render();
});

// ---------- loading ----------

async function load({ force = false } = {}) {
  $('#access').hidden = await hasSiteAccess();
  if (force || !state.defaults) {
    const { rules, remoteAt } = await loadStoreRules({ force });
    state.defaults = rules;
    state.remoteAt = remoteAt;
  }
  state.list = await getList();
  const refs = productRefs(state.list).filter((ref) => force || !state.products.get(ref.id)?.product);
  if (refs.length) {
    state.loading = true;
    $('#refresh').disabled = true;
    setStatus(t('status_checking', { n: tn('products', refs.length) }));
    const loaded = await loadProducts(refs, {
      force,
      onProgress: (done, total) => setStatus(t('status_progress', { done, total })),
    });
    for (const [id, entry] of loaded) state.products.set(id, entry);
    state.loading = false;
    $('#refresh').disabled = false;
    state.list = await syncProductDetails(loadedProducts());
  }
  [state.overrides, state.shipObs, state.hidden] = await Promise.all([getOverrides(), getShipObs(), getHidden()]);
  compute();
  // Products added while we were loading.
  if (productRefs(state.list).some((ref) => !state.products.has(ref.id))) load();
}

function compute() {
  state.items = state.list.map((g) => ({
    id: g.gid,
    name: itemLabel(g),
    qty: g.qty,
    options: g.options
      .filter((o) => productOf(o.id))
      .map((o) => ({
        productId: o.id,
        name: productOf(o.id).name,
        units: o.units,
        offers: productOf(o.id).offers.filter((offer) => !state.hidden[offer.sellerId]),
      })),
  }));
  state.result = optimize(state.items, { overrides: state.overrides, defaults: state.defaults, shipObs: state.shipObs });
  render();
}

// ---------- rendering ----------

// The status line only shows while prices are being fetched.
function setStatus(text) {
  $('#status').textContent = text;
  $('#status').hidden = !text;
}

function timeAgo(ts) {
  const min = Math.round((Date.now() - ts) / 60000);
  return min < 1 ? t('ago_now') : tn('ago_minutes', min);
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(getLang() === 'pt' ? 'pt-PT' : 'en-GB');
}

const logoUrl = (store) => store.logo || `https://s1.kuantokusta.pt/img_upload/logins/${store.sellerId}_1.png`;
const logo = (store) => `<img class="store-logo" src="${esc(logoUrl(store))}" alt="" />`;

const ICON_HIDE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.4 10.4 0 0 1 12 5c5 0 9 4 10 7a11.7 11.7 0 0 1-2.2 3.3"/><path d="M6.6 6.6C4.2 8 2.7 10.2 2 12c1 3 5 7 10 7a10 10 0 0 0 4.4-1"/></svg>';
const ICON_SHOW = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';

function storeName(store) {
  return store.storeSlug
    ? `<a href="${esc(storeUrl(store.storeSlug))}" target="_blank" rel="noopener">${esc(store.storeName)}</a>`
    : esc(store.storeName);
}

function shippingText(store) {
  const { shipping, shippingModel: m } = store;
  const manual = m.source === 'manual' ? ` <span class="tag">${t('ship_yours')}</span>` : '';
  switch (shipping.kind) {
    case 'free':
      return `<span class="tag free">${t('ship_free')}</span>${manual}`;
    case 'threshold':
      return `<span class="tag free" title="${esc(t('ship_free_over_title', { amount: money(m.freeAbove) }) + (m.estimated ? t('ship_estimated_title') : ''))}">${t('ship_free_over', { amount: money(m.freeAbove) })}</span>${manual}`;
    case 'maybe':
      return `${money(shipping.cost)} <span class="tag maybe" title="${esc(t('ship_maybe_title', { high: money(m.freeAbove), low: money(m.paidUpTo) }))}">${t('ship_maybe')}</span>${manual}`;
    default:
      return `${money(shipping.cost)}${manual}`;
  }
}

// What you'd buy at `store` for the given items, with totals.
// Columns: [thumbnail] name (+ "for item", qty × price) | line total | Open
function lines(store, gids, { withOpen = true, withTotals = true, withImages = false } = {}) {
  const cols = 2 + (withImages ? 1 : 0) + (withOpen ? 1 : 0);
  const pad = (n) => '<td></td>'.repeat(n);
  const rows = gids.filter((gid) => store.lines[gid]).map((gid) => {
    const line = store.lines[gid];
    const group = groupOf(gid);
    const product = productOf(line.productId);
    const qty = line.qty > 1 ? `<span class="qty-note">${line.qty} × ${money(line.price)}</span>` : '';
    const thumb = withImages ? `<td class="thumb"><img src="${esc(product.image)}" alt="" /></td>` : '';
    const open = withOpen
      ? `<td class="act"><a class="open" href="${esc(followUrl(line.productId, store.sellerId))}" target="_blank" rel="noopener">${t('open')}</a></td>`
      : '';
    return `<tr>${thumb}<td><a href="${esc(product.url)}" target="_blank" rel="noopener">${esc(product.name)}</a>${qty}</td>
      <td class="num">${money(line.lineTotal)}</td>${open}</tr>`;
  });
  for (const gid of store.missing ?? []) {
    if (!gids.includes(gid)) continue;
    rows.push(`<tr class="missing">${withImages ? '<td></td>' : ''}<td>${esc(itemLabel(groupOf(gid)))}</td><td class="num">${t('not_sold')}</td>${withOpen ? '<td></td>' : ''}</tr>`);
  }
  const lead = withImages ? '<td></td>' : '';
  const tail = withOpen ? '<td></td>' : '';
  const totals = withTotals
    ? `<tr class="subtotal">${lead}<td>${t('row_products')}</td><td class="num">${money(store.subtotal)}</td>${tail}</tr>
       <tr class="shipping">${lead}<td>${t('row_shipping')} <button type="button" class="edit" data-seller="${esc(store.sellerId)}" title="${esc(t('edit_shipping'))}">✎</button></td><td class="num">${shippingText(store)}</td>${tail}</tr>
       <tr class="grand">${lead}<td>${t('row_total')}</td><td class="num" colspan="${cols - 1 - (withImages ? 1 : 0)}">${money(store.total)}</td></tr>`
    : '';
  return `<table class="lines">${rows.join('')}${totals}</table>`;
}

// A line under the price when the shipping could be free, or when we don't know the threshold.
function nudge(store) {
  const m = store.shippingModel;
  if (store.shipping.cost === 0) return '';
  if (m.freeAbove != null && store.subtotal < m.freeAbove) {
    return `<p class="nudge free">${t('nudge_add', { amount: money(m.freeAbove - store.subtotal), maybe: m.estimated ? t('nudge_maybe') : '' })}</p>`;
  }
  if (m.freeAbove == null && m.source !== 'manual') {
    return `<p class="nudge ask">${t('nudge_ask', { store: esc(store.storeName) })} <button type="button" class="edit" data-seller="${esc(store.sellerId)}">${t('nudge_set')}</button> ${t('nudge_tail')} <a href="#portes">${t('tab_rules')} →</a></p>`;
  }
  return '';
}

function openAllButton(store, gids) {
  const n = gids.filter((gid) => store.lines[gid]).length;
  if (!n) return '';
  return `<button type="button" class="primary" data-open-all="${esc(store.sellerId)}" data-gids="${esc(gids.join(','))}" title="${esc(t('open_all_hint'))}">
    ${t('open_all', { store: esc(store.storeName) })}</button>`;
}

// The line under the big total: products + shipping when shipping is paid, else just the shipping tag.
function priceDetail(store) {
  return store.shipping.cost > 0
    ? t('detail_paid', { subtotal: money(store.subtotal), shipping: shippingText(store) })
    : t('detail_free', { shipping: shippingText(store) });
}

function renderAnswer() {
  const r = state.result;
  const n = state.items.length;
  const allIds = state.items.map((it) => it.id);
  const parts = [];

  const failed = productRefs(state.list).filter((ref) => state.products.get(ref.id)?.error);
  if (failed.length) {
    parts.push(`<div class="notice"><span>${t('load_failed', { names: failed.map((ref) => esc(ref.name)).join(', '), error: esc(state.products.get(failed[0].id).error) })}</span>
      <button type="button" id="retry">${t('retry')}</button></div>`);
  }

  const split = r.bestSplit;
  const splitWins = split && (!r.best || r.splitSaves > 0);

  if (r.best) {
    parts.push(`<div class="answer-card best">
      <p class="lead">${t('best_lead')}</p>
      <h2>${logo(r.best)}${storeName(r.best)}</h2>
      <div class="price-line"><span class="total">${money(r.best.total)}</span><span class="muted">${priceDetail(r.best)}</span></div>
      ${nudge(r.best)}
      ${lines(r.best, allIds, { withTotals: false, withImages: true })}
      <div class="actions">${openAllButton(r.best, allIds)}</div>
    </div>`);
  } else if (r.stores.length) {
    const top = r.stores[0];
    parts.push(`<div class="answer-card">
      <p class="lead muted-lead">${t('none_lead', { n })}</p>
      <h2>${logo(top)}${t('none_title', { store: storeName(top), covered: top.covered, n })}</h2>
      <div class="price-line"><span class="total">${money(top.total)}</span><span class="muted">${t('none_detail', { covered: top.covered })}, ${priceDetail(top)}</span></div>
      ${lines(top, allIds, { withTotals: false, withImages: true })}
      <div class="actions">${openAllButton(top, allIds)}</div>
    </div>`);
  } else if (n) {
    parts.push(`<div class="answer-card"><p class="lead muted-lead">${t('no_offers')}</p></div>`);
  }

  if (splitWins) {
    const lead = r.best
      ? `${t('split_lead_saves')} <span class="saves">${money(r.splitSaves)}</span>`
      : t('split_lead_best');
    parts.push(`<div class="answer-card ${r.best ? '' : 'best'}">
      <p class="lead muted-lead">${lead}</p>
      <div class="price-line"><span class="total">${money(split.total)}</span><span class="muted">${split.shipping > 0 ? t('split_detail', { shipping: money(split.shipping) }) : t('split_detail_free')}</span></div>
      ${split.parts
        .map(
          (part) => `<div class="part">
            <h3>${logo(part)}${storeName(part)}<span class="part-total">${money(part.total)}</span></h3>
            <p class="muted small part-detail">${priceDetail(part)}</p>
            ${nudge(part)}
            ${lines(part, part.itemIds, { withTotals: false, withImages: true })}
            <div class="actions">${openAllButton(part, part.itemIds)}</div>
          </div>`,
        )
        .join('')}
    </div>`);
  }

  $('#answer').innerHTML = parts.join('');
  $('#answer').hidden = !parts.length;
}

function renderList() {
  const r = state.result;
  $('#empty').hidden = state.list.length > 0;
  $('#clear').hidden = state.list.length === 0;
  $('#items').innerHTML = state.list
    .map((g) => {
      const item = state.items.find((it) => it.id === g.gid);
      const multi = g.options.length > 1;
      const cheapestPid = item?.options[r.cheapestOption[g.gid]]?.productId;
      const first = g.options[0];
      const info = (o) => {
        const entry = state.products.get(o.id);
        if (entry?.error) return `<span class="error">${t('info_failed')}</span>`;
        if (!entry?.product) return t('info_checking');
        const min = entry.product.offers.length ? Math.min(...entry.product.offers.map((x) => x.price)) : null;
        return min == null ? t('info_none') : t('info_stores', { stores: tn('stores', entry.product.offers.length), min: money(min) });
      };
      const stepper = (act, value) =>
        `<span class="stepper"><button type="button" data-act="${act}-dec" aria-label="${esc(t('fewer'))}">−</button><span>${value}</span><button type="button" data-act="${act}-inc" aria-label="${esc(t('more'))}">+</button></span>`;

      // One row per product: image, name + store count, quantity, cheapest price for that
      // quantity, remove. A single product's stepper is the item quantity; an alternative's
      // stepper is how many of it you'd buy. Alternatives are separated by "or".
      const rows = g.options
        .map((o) => {
          const min = productOf(o.id)?.offers.length ? Math.min(...productOf(o.id).offers.map((x) => x.price)) : null;
          const count = multi ? o.units : g.qty;
          return `<li class="${multi && o.id === cheapestPid ? 'cheapest' : ''}" data-pid="${o.id}">
            <img src="${esc(o.image)}" alt="" />
            <div class="alt-main">
              <a href="${esc(productUrl(o))}" target="_blank" rel="noopener">${esc(o.name)}</a>
              <span class="sub muted small">${info(o)}</span>
            </div>
            <span class="units" title="${esc(multi ? t('units_title') : t('quantity'))}">${stepper(multi ? 'units' : 'qty', count)}</span>
            <span class="cost" title="${esc(t('cost_title'))}">${min != null ? money(min * count) : ''}</span>
            <button type="button" class="link" data-act="${multi ? 'remove-option' : 'remove-item'}" title="${esc(multi ? t('remove_alt') : t('remove_item'))}">✕</button>
          </li>`;
        })
        .join(`<li class="or" aria-hidden="true"><span>${t('or')}</span></li>`);
      const head = '';
      const alts = `<ul class="alts">${rows}</ul>`;

      const foot = `<div class="item-foot">
        <button type="button" class="link" data-act="show-alt">${t('add_alt')}</button>
      </div>
      <form class="alt-form" data-act="add-alt" hidden>
        <input type="url" placeholder="${esc(t('alt_placeholder'))}" autocomplete="off" />
        <button type="submit">${t('add')}</button>
      </form>`;

      return `<div class="item grouped" data-gid="${esc(g.gid)}">${head}${alts}${foot}</div>`;
    })
    .join('');
}

function renderStores() {
  const r = state.result;
  const n = state.items.length;
  const allIds = state.items.map((it) => it.id);
  const shown = state.showAllStores ? r.stores : r.stores.slice(0, STORES_SHOWN);
  $('#stores').innerHTML = shown
    .map((store) => {
      const cls = ['store-card', store.complete ? '' : 'partial', store === r.best ? 'best' : ''].join(' ');
      const ship = store.shipping.cost > 0 ? t('incl_shipping', { amount: money(store.shipping.cost) }) : t('free_shipping');
      const coverage = t('coverage_count', { covered: store.covered, n });
      return `<article class="${cls}" data-seller="${esc(store.sellerId)}">
        <header>
          ${logo(store)}
          <div class="store-head-text">
            <div class="name">${storeName(store)}</div>
            <div class="coverage">${coverage} · ${ship}</div>
          </div>
          <div class="total ${store.complete ? '' : 'muted'}">${money(store.total)}</div>
        </header>
        ${lines(store, allIds, { withTotals: false, withImages: true })}
        <footer class="actions">
          <button type="button" class="link edit" data-seller="${esc(store.sellerId)}">✎ ${t('fix_shipping')}</button>
          <button type="button" class="link icon-btn" data-hide="${esc(store.sellerId)}" data-name="${esc(store.storeName)}">${ICON_HIDE} ${t('hide_store')}</button>
          <span class="spacer"></span>
          ${openAllButton(store, allIds)}
        </footer>
      </article>`;
    })
    .join('');
  const more = r.stores.length - STORES_SHOWN;
  $('#show-all').hidden = more <= 0;
  $('#show-all').textContent = state.showAllStores ? t('show_fewer') : t('show_all_stores', { n: r.stores.length });
}

// Every store we know a shipping rule for: those in the current result first, then the rest.
function knownStores() {
  const known = new Map();
  state.result.stores.forEach((s, rank) => known.set(s.sellerId, { ...s, rank }));
  const add = (id, name) => {
    if (known.has(id)) return;
    const model = shippingModel([], state.overrides[id], state.defaults[id]);
    known.set(id, { sellerId: id, storeName: name, storeSlug: '', shippingModel: model, rank: Infinity });
  };
  for (const [id, d] of Object.entries(state.defaults)) add(id, d.name);
  for (const [id, h] of Object.entries(state.hidden)) add(id, h.name);
  for (const id of Object.keys(state.overrides)) add(id, `Store ${id}`);
  return [...known.values()].sort((a, b) => a.rank - b.rank || a.storeName.localeCompare(b.storeName));
}

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function renderRules() {
  const query = fold(state.rulesQuery.trim());
  const all = knownStores();
  const rows = query ? all.filter((s) => fold(s.storeName).includes(query)) : all;
  const shown = state.showAllRules || query ? rows : rows.slice(0, RULES_SHOWN);
  const basedOn = (store) => {
    const m = store.shippingModel;
    const d = state.defaults[store.sellerId];
    if (m.source === 'manual') return t('src_you');
    if (m.source === 'bundled' && d) {
      const link = d.source ? `<a href="${esc(d.source)}" target="_blank" rel="noopener">${t('src_site')}</a>` : t('src_bundled');
      return `${link}${d.checked ? t('src_checked', { date: formatDate(d.checked) }) : ''}`;
    }
    if (m.freeAbove != null && m.estimated) return t('src_guessed');
    return t('src_kk');
  };
  $('#rules').innerHTML = `<thead><tr><th>${t('col_store')}</th><th class="num">${t('col_shipping')}</th><th class="num">${t('col_free_from')}</th><th>${t('col_source')}</th><th></th><th></th></tr></thead>
    <tbody>${shown
      .map((store) => {
        const m = store.shippingModel;
        const d = state.defaults[store.sellerId];
        const title = storeNotes(d) ? ` title="${esc(storeNotes(d))}"` : '';
        const hidden = Boolean(state.hidden[store.sellerId]);
        return `<tr class="${store.rank < Infinity ? 'in-list' : ''} ${hidden ? 'hidden-store' : ''}">
          <td class="store-cell">${logo(store)}<span>${esc(store.storeName)}${hidden ? ` <span class="tag">${t('hidden_tag')}</span>` : ''}</span></td>
          <td class="num">${m.base ? money(m.base) : `<span class="tag free">${t('ship_free')}</span>`}</td>
          <td class="num">${m.freeAbove == null ? `<span class="muted">${t('unknown')}</span>` : m.freeAbove === 0 ? t('always') : money(m.freeAbove)}</td>
          <td class="src"${title}>${basedOn(store)}</td>
          <td><button type="button" class="edit" data-seller="${esc(store.sellerId)}" title="${esc(t('edit_shipping'))}">✎</button></td>
          <td>${hidden
            ? `<button type="button" class="link small icon-btn" data-unhide="${esc(store.sellerId)}">${ICON_SHOW} ${t('unhide_store')}</button>`
            : `<button type="button" class="link small icon-btn" data-hide="${esc(store.sellerId)}" data-name="${esc(store.storeName)}">${ICON_HIDE} ${t('hide_store')}</button>`}</td>
        </tr>`;
      })
      .join('')}${shown.length ? '' : `<tr><td colspan="6" class="muted">${t('rules_no_match')}</td></tr>`}</tbody>`;
  const more = query ? 0 : rows.length - RULES_SHOWN;
  $('#show-all-rules').hidden = more <= 0;
  $('#show-all-rules').textContent = state.showAllRules ? t('show_fewer') : t('show_all_stores', { n: rows.length });
  $('#rules-section').hidden = !all.length;

  const fileUrl = storesFileUrl();
  $('#rules-data').hidden = !fileUrl;
  if (fileUrl) {
    const report = issueUrl(t('issue_title', { store: '…' }), '');
    $('#rules-data').innerHTML = t('rules_data', {
      file: `<a href="${esc(fileUrl)}" target="_blank" rel="noopener">${esc(STORES_PATH)}</a>`,
      updated: state.remoteAt ? t('rules_updated', { date: formatDate(new Date(state.remoteAt).toISOString()) }) : '',
      report: `<a href="${esc(report)}" target="_blank" rel="noopener">${t('rules_report')}</a>`,
    });
  }
}

function renderHidden() {
  const entries = Object.entries(state.hidden);
  $('#hidden-section').hidden = !entries.length;
  $('#hidden-list').innerHTML = entries
    .map(([id, h]) => `<span class="chip">${logo({ sellerId: id })}${esc(h.name)} <button type="button" class="link icon-btn" data-unhide="${esc(id)}" title="${esc(t('unhide_store'))}">${ICON_SHOW}</button></span>`)
    .join('');
}

document.addEventListener('click', async (event) => {
  const hide = event.target.closest('button[data-hide]');
  const unhide = event.target.closest('button[data-unhide]');
  if (!hide && !unhide) return;
  state.hidden = hide ? await hideStore(hide.dataset.hide, hide.dataset.name) : await unhideStore(unhide.dataset.unhide);
  compute();
});

function render() {
  const fetched = [...state.products.values()].filter((e) => e.fetchedAt).map((e) => e.fetchedAt);
  if (!state.loading) setStatus('');
  $('#stores-section').hidden = !state.result?.stores.length;
  renderAnswer();
  renderList();
  renderStores();
  renderRules();
  renderHidden();
}

// ---------- events ----------

async function openAll(sellerId, gids) {
  const store = state.result.stores.find((s) => s.sellerId === sellerId);
  const urls = gids.filter((gid) => store.lines[gid]).map((gid) => followUrl(store.lines[gid].productId, sellerId));
  for (const [i, url] of urls.entries()) await api.tabs.create({ url, active: i === 0 });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-open-all]');
  if (button) openAll(button.dataset.openAll, button.dataset.gids.split(','));
  if (event.target.closest('#retry')) load({ force: true });
});

async function addFromInput(input, errorEl, add) {
  const ref = parseProductUrl(input.value);
  const fail = (msg) => {
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    } else {
      input.setCustomValidity(msg);
      input.reportValidity();
      setTimeout(() => input.setCustomValidity(''), 2500);
    }
  };
  if (!ref) return fail(t('err_not_link'));
  const existing = findProduct(state.list, ref.id);
  if (existing) return fail(t('err_duplicate', { item: itemLabel(existing) }));
  if (errorEl) errorEl.hidden = true;
  input.value = '';
  await add(ref);
}

$('#add-form').addEventListener('submit', (event) => {
  event.preventDefault();
  addFromInput($('#add-input'), $('#add-error'), (ref) => addItem(ref));
});

$('#items').addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-act="add-alt"]');
  if (!form) return;
  event.preventDefault();
  const gid = form.closest('.item').dataset.gid;
  addFromInput(form.querySelector('input'), null, (ref) => addAlternative(gid, ref));
});

$('#items').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-act]');
  if (!button) return;
  const card = button.closest('.item');
  const gid = card.dataset.gid;
  const group = groupOf(gid);
  const pid = Number(button.closest('li')?.dataset.pid);
  const option = group.options.find((o) => o.id === pid);
  switch (button.dataset.act) {
    case 'qty-inc':
      return updateItem(gid, { qty: group.qty + 1 });
    case 'qty-dec':
      return group.qty > 1 ? updateItem(gid, { qty: group.qty - 1 }) : undefined;
    case 'units-inc':
      return updateOption(gid, pid, { units: option.units + 1 });
    case 'units-dec':
      return option.units > 1 ? updateOption(gid, pid, { units: option.units - 1 }) : undefined;
    case 'remove-option':
      return removeOption(gid, pid);
    case 'remove-item':
      return removeItem(gid);
    case 'show-alt': {
      const form = card.querySelector('.alt-form');
      form.hidden = !form.hidden;
      if (!form.hidden) form.querySelector('input').focus();
      return;
    }
  }
});

$('#clear').addEventListener('click', async () => {
  if (confirm(t('clear_confirm'))) await clearList();
});

$('#show-all').addEventListener('click', () => {
  state.showAllStores = !state.showAllStores;
  renderStores();
});

$('#rules-search').addEventListener('input', (event) => {
  state.rulesQuery = event.target.value;
  renderRules();
});

$('#show-all-rules').addEventListener('click', () => {
  state.showAllRules = !state.showAllRules;
  renderRules();
});

let editingSeller = null;

document.addEventListener('click', (event) => {
  const button = event.target.closest('button.edit');
  if (!button) return;
  event.preventDefault();
  editingSeller = button.dataset.seller;
  const store = knownStores().find((s) => s.sellerId === editingSeller);
  const override = state.overrides[editingSeller] ?? {};
  const d = state.defaults[editingSeller];
  const form = $('#ship-form');
  form.shipping.value = override.shipping ?? '';
  form.freeAbove.value = override.freeAbove ?? '';
  $('#ship-title').textContent = t('dlg_title', { store: store.storeName });
  const info = [];
  // Same calculation without overrides or bundled data, to show what KuantoKusta itself says.
  const scraped = optimize(state.items, { shipObs: state.shipObs }).stores.find((s) => s.sellerId === editingSeller)?.shippingModel;
  if (scraped) {
    info.push(scraped.base ? t('dlg_kk_cost', { amount: money(scraped.base) }) : t('dlg_kk_free'));
    if (scraped.freeAbove != null) info.push(t('dlg_kk_seen', { amount: money(scraped.freeAbove) }));
  }
  if (d && (d.shipping != null || d.freeAbove != null)) {
    const what = [];
    if (d.shipping != null) what.push(t('dlg_site_cost', { amount: money(d.shipping) }));
    if (d.freeAbove != null) what.push(d.freeAbove === 0 ? t('dlg_site_always') : t('dlg_site_free', { amount: money(d.freeAbove) }));
    info.push(t('dlg_site', { what: what.join(', '), checked: d.checked ? t('dlg_site_checked', { date: formatDate(d.checked) }) : '' }) + (storeNotes(d) ? ` ${storeNotes(d)}` : ''));
  }
  if (store.shippingModel.source === 'manual') info.push(t('dlg_manual'));
  info.push(t('dlg_hint'));
  $('#ship-info').textContent = info.join(' ');
  const m = store.shippingModel;
  const report = issueUrl(
    t('issue_title', { store: store.storeName }),
    t('issue_body', { store: store.storeName, id: editingSeller, shipping: money(m.base), freeAbove: m.freeAbove == null ? '—' : money(m.freeAbove) }),
  );
  $('#ship-report').hidden = !report;
  if (report) $('#ship-report').innerHTML = `<a href="${esc(report)}" target="_blank" rel="noopener">${t('dlg_report')}</a>`;
  $('#ship-dialog').showModal();
});

$('#ship-dialog').addEventListener('close', async () => {
  const action = $('#ship-dialog').returnValue;
  if (!editingSeller || action === 'cancel' || !action) return;
  const form = $('#ship-form');
  const num = (v) => (v === '' ? undefined : Math.max(0, Number(v)));
  let override = null;
  if (action === 'save') {
    const shipping = num(form.shipping.value);
    const freeAbove = num(form.freeAbove.value);
    if (shipping != null || freeAbove != null) override = { shipping, freeAbove };
  }
  state.overrides = await setOverride(editingSeller, override);
  editingSeller = null;
  compute();
});

$('#refresh').addEventListener('click', () => load({ force: true }));

$('#grant').addEventListener('click', async () => {
  if (await requestSiteAccess()) load({ force: true });
});

api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.list) return;
  state.list = changes.list.newValue ?? [];
  // New products need fetching; other edits only need a recompute.
  const missing = productRefs(state.list).some((ref) => !state.products.has(ref.id));
  if (missing) {
    if (!state.loading) load();
  } else {
    compute();
    // A re-added product may still carry a placeholder name; this only writes if something differs.
    syncProductDetails(loadedProducts());
  }
});

initLang().then(() => load());
