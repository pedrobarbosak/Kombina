// Translations for the KCompare page. European Portuguese is the default.
// Strings with "|" hold singular|plural forms, picked by tn(); {name} placeholders are filled by t().
// The content script has its own small copy (src/content/strings.js) because it can't import modules.

export const LANGS = ['pt', 'en'];
export const DEFAULT_LANG = 'pt';

const pt = {
  // header
  loading: 'A carregar…',
  refresh: 'Atualizar preços',
  status_empty: 'Adiciona produtos para encontrar a loja mais barata.',
  status_prices: 'Preços de {stores}{checked}.',
  status_checked: ', consultados {ago}',
  status_checking: 'A consultar preços de {n}…',
  status_progress: 'A consultar preços… {done} de {total}',
  ago_now: 'agora mesmo',
  ago_minutes: 'há {n} minuto|há {n} minutos',
  access_text: 'O KCompare precisa de permissão para ler os preços no kuantokusta.pt.',
  access_allow: 'Permitir',
  lang_label: 'Idioma',
  tab_compare: 'Comparar',
  tab_rules: 'Portes das lojas',
  btn_add: 'Adicionar ao KCompare',

  // plurals
  items: '{n} artigo|{n} artigos',
  stores: '{n} loja|{n} lojas',
  products: '{n} produto|{n} produtos',
  alternatives: '{n} alternativa|{n} alternativas',
  or: 'ou',

  // answer
  best_lead: 'A loja mais barata',
  detail_paid: '{subtotal} em produtos + portes {shipping}',
  detail_free: 'portes {shipping}',
  none_lead: 'Nenhuma loja tem os {n} artigos',
  none_title: '{store} tem mais: {covered} de {n}',
  none_detail: 'por esses {covered} artigos',
  no_offers: 'Nenhum dos teus artigos tem ofertas de momento.',
  split_lead_saves: 'Ou dividir por duas lojas e poupar',
  split_lead_best: 'Melhor opção: dividir por duas lojas',
  split_detail: 'com {shipping} de portes',
  split_detail_free: 'sem portes',
  shipping_word: 'portes {shipping}',
  open_all: 'Abrir {what}na {store}',
  open_all_one: '',
  open_all_n: 'todos ',
  open_all_hint: 'Abre um separador por produto no site da loja.',
  open: 'Abrir',
  for_item: 'para {item}',
  not_sold: 'não vende',
  row_products: 'Produtos',
  row_shipping: 'Portes',
  row_total: 'Total',
  edit_shipping: 'Corrigir os portes desta loja',
  load_failed: 'Não foi possível carregar {names}. {error}',
  retry: 'Tentar de novo',
  nudge_add: 'Junta mais <b>{amount}</b> e os portes são grátis{maybe}.',
  nudge_maybe: ' (provavelmente: estimado pelas ofertas)',
  nudge_ask: 'A {store} oferece portes acima de um certo valor?',
  nudge_set: 'Define-o',
  nudge_tail: 'e o total atualiza.',

  // shipping tags
  ship_free: 'grátis',
  ship_free_over: 'grátis a partir de {amount}',
  ship_free_over_title: 'Grátis a partir de {amount}',
  ship_estimated_title: ', estimado pelos preços mostrados no KuantoKusta',
  ship_maybe: 'talvez grátis',
  ship_maybe_title: 'Esta loja enviou um produto de {high} sem portes, por isso encomendas entre {low} e {high} também podem ser grátis.',
  ship_yours: 'o teu valor',

  // list
  list_title: 'A tua lista',
  clear: 'Limpar lista',
  clear_confirm: 'Remover tudo da tua lista?',
  add_placeholder: 'Cola o link de um produto do kuantokusta.pt',
  add: 'Adicionar',
  empty_html: 'Ainda não há nada. Abre um produto no kuantokusta.pt e carrega em <b>{add}</b>, ou cola um link acima.',
  err_not_link: 'Isso não parece um link de produto. Deve conter /p/ seguido de um número.',
  err_duplicate: 'Já está na tua lista, em “{item}”.',
  quantity: 'Quantidade',
  fewer: 'Menos',
  more: 'Mais',
  remove_item: 'Remover da lista',
  info_failed: 'não foi possível carregar',
  info_checking: 'a consultar preços…',
  info_none: 'sem ofertas de momento',
  info_stores: '{stores}, desde {min}',
  units_title: 'Quantas unidades compravas desta alternativa',
  per_item: 'por artigo',
  cost_title: 'Mais barato em qualquer loja, para a quantidade que queres',
  remove_alt: 'Remover esta alternativa',
  add_alt: '+ Adicionar alternativa',
  alt_placeholder: 'Link de um produto que possa substituir este (recarga, pack de 2, outro tamanho…)',

  // every store
  stores_title: 'Todas as lojas',
  stores_intro: 'Ordenadas pelo total da tua lista. Abre uma loja para veres o que comprarias lá ou para corrigires os portes.',
  coverage_all: 'os {n} artigos',
  coverage_partial: '{covered} de {n} artigos, falta {missing}|{covered} de {n} artigos, faltam {missing}',
  incl_shipping: 'com {amount} de portes',
  free_shipping: 'portes grátis',
  for_items: 'por {items}, {ship}',
  store_page: 'Página da loja',
  show_all_stores: 'Ver todas as {n} lojas',
  show_fewer: 'Ver menos',

  // rules
  rules_title: 'Portes das lojas',
  rules_intro: 'O que cada loja cobra para Portugal continental e a partir de que valor oferece os portes. O KuantoKusta só mostra o custo por produto, por isso os limites vêm dos sites das lojas, do que as ofertas revelam, ou de ti. Corrige o que estiver errado e os totais atualizam.',
  col_store: 'Loja',
  col_shipping: 'Portes',
  col_free_from: 'Grátis a partir de',
  col_source: 'Fonte',
  src_you: 'definido por ti',
  src_site: 'site da loja',
  src_bundled: 'dados do KCompare',
  src_checked: ', verificado em {date}',
  src_guessed: 'estimado pelas ofertas',
  src_kk: 'KuantoKusta',
  unknown: 'desconhecido',
  rules_data: 'Os dados vêm do ficheiro {file} no GitHub{updated}. Encontraste um erro? {report}.',
  rules_updated: ', atualizados em {date}',
  rules_report: 'Sugere uma correção',
  dlg_report: 'Sugerir uma correção no GitHub',
  issue_title: 'Portes: {store}',
  issue_body: 'Loja: {store} (sellerId {id})\nValores atuais: portes {shipping}, grátis a partir de {freeAbove}\n\nO que está errado e qual é o valor certo? Se possível, indica a página da loja onde está escrito.\n',
  always: 'sempre',

  // dialog
  dlg_title: 'Portes na {store}',
  dlg_cost: 'Custo dos portes (€)',
  dlg_cost_placeholder: 'como no KuantoKusta',
  dlg_free: 'Portes grátis a partir de (€)',
  dlg_free_placeholder: 'nunca',
  dlg_reset: 'Repor',
  dlg_cancel: 'Cancelar',
  dlg_save: 'Guardar',
  dlg_kk_cost: 'O KuantoKusta mostra {amount} de portes.',
  dlg_kk_free: 'O KuantoKusta mostra portes grátis.',
  dlg_kk_seen: 'Um produto de {amount} teve portes grátis, por isso o limite deve ser igual ou inferior.',
  dlg_site: 'O site da loja indica {what}{checked}.',
  dlg_site_cost: '{amount} de portes',
  dlg_site_free: 'grátis a partir de {amount}',
  dlg_site_always: 'sempre grátis',
  dlg_site_checked: ' (verificado em {date})',
  dlg_manual: 'Os teus valores estão em uso.',
  dlg_hint: 'Deixa um campo vazio para manter o valor acima.',
};

const en = {
  loading: 'Loading…',
  refresh: 'Refresh prices',
  status_empty: 'Add products to find the cheapest store.',
  status_prices: 'Prices from {stores}{checked}.',
  status_checked: ', checked {ago}',
  status_checking: 'Checking prices for {n}…',
  status_progress: 'Checking prices… {done} of {total}',
  ago_now: 'just now',
  ago_minutes: '{n} minute ago|{n} minutes ago',
  access_text: 'KCompare needs permission to read prices from kuantokusta.pt.',
  access_allow: 'Allow',
  lang_label: 'Language',
  tab_compare: 'Compare',
  tab_rules: 'Store shipping',
  btn_add: 'Add to KCompare',

  items: '{n} item|{n} items',
  stores: '{n} store|{n} stores',
  products: '{n} product|{n} products',
  alternatives: '{n} alternative|{n} alternatives',
  or: 'or',

  best_lead: 'Cheapest store',
  detail_paid: '{subtotal} for products + shipping {shipping}',
  detail_free: 'shipping {shipping}',
  none_lead: 'No store sells all {n} items',
  none_title: '{store} has the most: {covered} of {n}',
  none_detail: 'for those {covered} items',
  no_offers: 'None of your items has offers right now.',
  split_lead_saves: 'Or split between two stores and save',
  split_lead_best: 'Best option: split between two stores',
  split_detail: 'including {shipping} shipping',
  split_detail_free: 'no shipping',
  shipping_word: 'shipping {shipping}',
  open_all: 'Open {what}at {store}',
  open_all_one: '',
  open_all_n: 'all ',
  open_all_hint: "Opens one tab per product on the store's site.",
  open: 'Open',
  for_item: 'for {item}',
  not_sold: 'not sold here',
  row_products: 'Products',
  row_shipping: 'Shipping',
  row_total: 'Total',
  edit_shipping: "Correct this store's shipping",
  load_failed: "Couldn't load {names}. {error}",
  retry: 'Try again',
  nudge_add: 'Add <b>{amount}</b> more and shipping is free{maybe}.',
  nudge_maybe: ' (probably: guessed from their offers)',
  nudge_ask: 'Does {store} ship free above some amount?',
  nudge_set: 'Set it',
  nudge_tail: 'and the total updates.',

  ship_free: 'free',
  ship_free_over: 'free over {amount}',
  ship_free_over_title: 'Free from {amount}',
  ship_estimated_title: ', estimated from the prices KuantoKusta showed',
  ship_maybe: 'may be free',
  ship_maybe_title: 'This store shipped a {high} product for free, so orders between {low} and {high} may be free too.',
  ship_yours: 'your value',

  list_title: 'Your list',
  clear: 'Clear list',
  clear_confirm: 'Remove everything from your list?',
  add_placeholder: 'Paste a kuantokusta.pt product link',
  add: 'Add',
  empty_html: 'Nothing here yet. Open a product on kuantokusta.pt and press <b>{add}</b>, or paste a product link above.',
  err_not_link: "That doesn't look like a product link. It should contain /p/ followed by a number.",
  err_duplicate: 'Already on your list, under “{item}”.',
  quantity: 'Quantity',
  fewer: 'Fewer',
  more: 'More',
  remove_item: 'Remove from list',
  info_failed: "couldn't load",
  info_checking: 'checking prices…',
  info_none: 'no offers right now',
  info_stores: '{stores}, from {min}',
  units_title: 'How many of this alternative you would buy',
  per_item: 'per item',
  cost_title: 'Cheapest anywhere, for the quantity you want',
  remove_alt: 'Remove this alternative',
  add_alt: '+ Add an alternative',
  alt_placeholder: 'Link to a product that could replace this one (refill, 2-pack, other size…)',

  stores_title: 'Every store',
  stores_intro: "Ranked by total for your whole list. Open a store to see what you'd buy there, or to correct its shipping cost.",
  coverage_all: 'all {n} items',
  coverage_partial: '{covered} of {n} items, missing {missing}|{covered} of {n} items, missing {missing}',
  incl_shipping: 'incl. {amount} shipping',
  free_shipping: 'free shipping',
  for_items: 'for {items}, {ship}',
  store_page: 'Store page',
  show_all_stores: 'Show all {n} stores',
  show_fewer: 'Show fewer',

  rules_title: 'Store shipping',
  rules_intro: "What each store charges to mainland Portugal, and from what order value it ships free. KuantoKusta only shows the cost per product, so the thresholds come from the stores' own sites, from what their offers reveal, or from you. Correct anything that's wrong and the totals update.",
  col_store: 'Store',
  col_shipping: 'Shipping',
  col_free_from: 'Free from',
  col_source: 'Based on',
  src_you: 'you',
  src_site: 'their site',
  src_bundled: 'KCompare data',
  src_checked: ', checked {date}',
  src_guessed: 'guessed from their offers',
  src_kk: 'KuantoKusta',
  unknown: 'unknown',
  rules_data: 'The data comes from the {file} file on GitHub{updated}. Spotted a mistake? {report}.',
  rules_updated: ', updated {date}',
  rules_report: 'Suggest a correction',
  dlg_report: 'Suggest a correction on GitHub',
  issue_title: 'Shipping: {store}',
  issue_body: 'Store: {store} (sellerId {id})\nCurrent values: shipping {shipping}, free from {freeAbove}\n\nWhat is wrong and what is the right value? If possible, link the store page that states it.\n',
  always: 'always',

  dlg_title: 'Shipping at {store}',
  dlg_cost: 'Shipping cost (€)',
  dlg_cost_placeholder: 'as shown on KuantoKusta',
  dlg_free: 'Free shipping from (€)',
  dlg_free_placeholder: 'never',
  dlg_reset: 'Reset',
  dlg_cancel: 'Cancel',
  dlg_save: 'Save',
  dlg_kk_cost: 'KuantoKusta shows {amount} shipping.',
  dlg_kk_free: 'KuantoKusta shows free shipping.',
  dlg_kk_seen: 'A {amount} product shipped free, so the threshold is probably at or below that.',
  dlg_site: 'Their own site says {what}{checked}.',
  dlg_site_cost: '{amount} shipping',
  dlg_site_free: 'free from {amount}',
  dlg_site_always: 'always free',
  dlg_site_checked: ' (checked {date})',
  dlg_manual: 'Your values are in use.',
  dlg_hint: 'Leave a field empty to keep the value above.',
};

const dict = { pt, en };
let current = DEFAULT_LANG;

export const getLang = () => current;

export function setLang(lang) {
  current = dict[lang] ? lang : DEFAULT_LANG;
  if (typeof document !== 'undefined') document.documentElement.lang = current === 'pt' ? 'pt-PT' : 'en';
}

const fill = (s, params) => s.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ''));

export function t(key, params = {}) {
  const s = dict[current][key] ?? dict.en[key] ?? key;
  return fill(s, params);
}

// Picks the singular or plural form of a "one|many" string by `n`.
export function tn(key, n, params = {}) {
  const forms = (dict[current][key] ?? dict.en[key] ?? key).split('|');
  return fill(forms[n === 1 ? 0 : forms.length - 1], { n, ...params });
}

// Translates static markup: data-i18n (text), data-i18n-html, data-i18n-placeholder, data-i18n-title.
export function applyStatic(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
}
