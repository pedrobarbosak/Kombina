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
} from '../lib/storage.js';
import { loadStoreRules } from '../lib/stores-data.js';
import { storesFileUrl, issueUrl, STORES_PATH } from '../lib/config.js';
import { esc, money, $ } from '../shared/dom.js';
import { t, tn, setLang, getLang, applyStatic, DEFAULT_LANG } from '../shared/i18n.js';

const STORES_SHOWN = 8;
const RULES_SHOWN = 10;

const state = {
  list: [],
  products: new Map(), // productId -> { product?, error?, fetchedAt? }
  overrides: {},
  defaults: null, // data/stores.json (+ GitHub copy): shipping rules from the stores' own sites
  remoteAt: null,
  shipObs: {},
  items: [], // optimizer input, one per list item (id = gid)
  result: null,
  loading: false,
  showAllStores: false,
  showAllRules: false,
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
  [state.overrides, state.shipObs] = await Promise.all([getOverrides(), getShipObs()]);
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
      .map((o) => ({ productId: o.id, name: productOf(o.id).name, units: o.units, offers: productOf(o.id).offers })),
  }));
  state.result = optimize(state.items, { overrides: state.overrides, defaults: state.defaults, shipObs: state.shipObs });
  render();
}

// ---------- rendering ----------

function setStatus(text) {
  $('#status').textContent = text;
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

const logo = (store) => (store.logo ? `<img src="${esc(store.logo)}" alt="" />` : '');

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
    return `<p class="nudge">${t('nudge_add', { amount: money(m.freeAbove - store.subtotal), store: esc(store.storeName), maybe: m.estimated ? t('nudge_maybe') : '' })}</p>`;
  }
  if (m.freeAbove == null && m.source !== 'manual') {
    return `<p class="nudge ask">${t('nudge_ask', { store: esc(store.storeName) })} <button type="button" class="edit" data-seller="${esc(store.sellerId)}">${t('nudge_set')}</button> ${t('nudge_tail')} <a href="#portes">${t('tab_rules')} →</a></p>`;
  }
  return '';
}

function openAllButton(store, gids) {
  const n = gids.filter((gid) => store.lines[gid]).length;
  if (!n) return '';
  const what = n === 1 ? t('open_all_one') : t('open_all_n', { n });
  return `<button type="button" class="primary" data-open-all="${esc(store.sellerId)}" data-gids="${esc(gids.join(','))}" title="${esc(t('open_all_hint'))}">
    ${t('open_all', { what, store: esc(store.storeName) })}</button>`;
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

      // A single product: one row with its quantity.
      const head = multi
        ? ''
        : `<div class="item-row">
        <img src="${esc(first.image)}" alt="" />
        <div><a class="name" href="${esc(productUrl(first))}" target="_blank" rel="noopener">${esc(first.name)}</a><div class="sub">${info(first)}</div></div>
        <div class="controls">
          <span title="${esc(t('quantity'))}">${stepper('qty', g.qty)}</span>
          <button type="button" class="link" data-act="remove-item" title="${esc(t('remove_item'))}">✕</button>
        </div>
      </div>`;

      // Alternatives: one row each, separated by "or"; each says how many of it you'd buy.
      // Removing the last alternative removes the item.
      const alts = multi
        ? `<ul class="alts">${g.options
            .map((o) => {
              const min = productOf(o.id)?.offers.length ? Math.min(...productOf(o.id).offers.map((x) => x.price)) : null;
              return `<li class="${o.id === cheapestPid ? 'cheapest' : ''}" data-pid="${o.id}">
                <img src="${esc(o.image)}" alt="" />
                <div class="alt-main">
                  <a href="${esc(productUrl(o))}" target="_blank" rel="noopener">${esc(o.name)}</a>
                  <span class="sub muted small">${info(o)}</span>
                </div>
                <span class="units" title="${esc(t('units_title'))}">${stepper('units', o.units)}</span>
                <span class="cost" title="${esc(t('cost_title'))}">${min != null ? money(min * o.units * g.qty) : ''}</span>
                <button type="button" class="link" data-act="remove-option" title="${esc(t('remove_alt'))}">✕</button>
              </li>`;
            })
            .join(`<li class="or" aria-hidden="true"><span>${t('or')}</span></li>`)}</ul>`
        : '';

      const foot = `<div class="item-foot">
        <button type="button" class="link" data-act="show-alt">${t('add_alt')}</button>
      </div>
      <form class="alt-form" data-act="add-alt" hidden>
        <input type="url" placeholder="${esc(t('alt_placeholder'))}" autocomplete="off" />
        <button type="submit">${t('add')}</button>
      </form>`;

      return `<div class="item ${multi ? 'grouped' : ''}" data-gid="${esc(g.gid)}">${head}${alts}${foot}</div>`;
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
      const cls = ['store', store.complete ? '' : 'partial', store === r.best ? 'best' : ''].join(' ');
      const coverage = store.complete
        ? t('coverage_all', { n })
        : tn('coverage_partial', store.missing.length, { covered: store.covered, n, missing: store.missing.map((gid) => esc(itemLabel(groupOf(gid)))).join(', ') });
      const ship = store.shipping.cost > 0 ? t('incl_shipping', { amount: money(store.shipping.cost) }) : t('free_shipping');
      const note = store.complete ? ship : t('for_items', { items: tn('items', store.covered), ship });
      return `<details class="${cls}" data-seller="${esc(store.sellerId)}">
        <summary>
          ${logo(store)}
          <div><div class="name">${esc(store.storeName)}</div><div class="coverage">${coverage}</div></div>
          <div class="total ${store.complete ? '' : 'muted'}">${money(store.total)}<span class="ship-note">${note}</span></div>
        </summary>
        <div class="store-body">
          ${lines(store, allIds)}
          <div class="actions">${openAllButton(store, allIds)}<a href="${esc(storeUrl(store.storeSlug))}" target="_blank" rel="noopener">${t('store_page')}</a></div>
        </div>
      </details>`;
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
  for (const id of Object.keys(state.overrides)) add(id, `Store ${id}`);
  return [...known.values()].sort((a, b) => a.rank - b.rank || a.storeName.localeCompare(b.storeName));
}

function renderRules() {
  const rows = knownStores();
  const shown = state.showAllRules ? rows : rows.slice(0, RULES_SHOWN);
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
  $('#rules').innerHTML = `<thead><tr><th>${t('col_store')}</th><th class="num">${t('col_shipping')}</th><th class="num">${t('col_free_from')}</th><th>${t('col_source')}</th><th></th></tr></thead>
    <tbody>${shown
      .map((store) => {
        const m = store.shippingModel;
        const d = state.defaults[store.sellerId];
        const title = storeNotes(d) ? ` title="${esc(storeNotes(d))}"` : '';
        return `<tr class="${store.rank < Infinity ? 'in-list' : ''}">
          <td>${esc(store.storeName)}</td>
          <td class="num">${m.base ? money(m.base) : `<span class="tag free">${t('ship_free')}</span>`}</td>
          <td class="num">${m.freeAbove == null ? `<span class="muted">${t('unknown')}</span>` : m.freeAbove === 0 ? t('always') : money(m.freeAbove)}</td>
          <td class="src"${title}>${basedOn(store)}</td>
          <td><button type="button" class="edit" data-seller="${esc(store.sellerId)}" title="${esc(t('edit_shipping'))}">✎</button></td>
        </tr>`;
      })
      .join('')}</tbody>`;
  const more = rows.length - RULES_SHOWN;
  $('#show-all-rules').hidden = more <= 0;
  $('#show-all-rules').textContent = state.showAllRules ? t('show_fewer') : t('show_all_stores', { n: rows.length });
  $('#rules-section').hidden = !rows.length;

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

function render() {
  const fetched = [...state.products.values()].filter((e) => e.fetchedAt).map((e) => e.fetchedAt);
  if (!state.loading) {
    setStatus(
      !state.list.length
        ? t('status_empty')
        : t('status_prices', {
            stores: tn('stores', state.result.stores.length),
            checked: fetched.length ? t('status_checked', { ago: timeAgo(Math.min(...fetched)) }) : '',
          }),
    );
  }
  $('#stores-section').hidden = !state.result?.stores.length;
  renderAnswer();
  renderList();
  renderStores();
  renderRules();
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
