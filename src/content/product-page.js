// Content script for kuantokusta.pt. Adds an "Add to KCompare" button on product pages,
// with a menu to add the product as an alternative to an item already in the list.
// Classic script (content scripts can't use ES module imports): it reads the list from
// storage directly and sends changes to the background script. Strings come from strings.js.
(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const ROOT_ID = 'easy-compare-root';
  const STRINGS = globalThis.EASY_COMPARE_STRINGS;

  let active = false;
  let lang = 'pt';
  const t = (key, params = {}) =>
    (STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');

  function productRef() {
    const m = location.pathname.match(/^\/p\/(\d+)(?:\/([^/?#]+))?/);
    return m ? { id: Number(m[1]), slug: m[2] ?? '' } : null;
  }

  function currentProduct() {
    const ref = productRef();
    const h1 = document.querySelector('h1')?.textContent?.trim();
    const title = document.title.replace(/\s*\|\s*KuantoKusta\s*$/i, '').trim();
    const image = document.querySelector('meta[property="og:image"]')?.content ?? '';
    return { ...ref, name: h1 || title, image };
  }

  async function getState() {
    const res = await api.storage.local.get(['list', 'lang']);
    lang = res.lang ?? 'pt';
    return res.list ?? [];
  }

  const itemLabel = (g) => g.label || g.options[0]?.name || 'Item';
  const send = (message) => api.runtime.sendMessage(message);

  function el(tag, attrs = {}, text = '') {
    const node = document.createElement(tag);
    Object.assign(node, attrs);
    if (text) node.textContent = text;
    return node;
  }

  function flash(root, text) {
    const hint = root.querySelector('.ec-hint');
    hint.textContent = text;
    root.classList.add('ec-flash');
    clearTimeout(flash.timer);
    flash.timer = setTimeout(() => root.classList.remove('ec-flash'), 1800);
  }

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = el('div', { id: ROOT_ID });
    root.append(
      el('div', { className: 'ec-hint' }),
      el('div', { className: 'ec-menu', hidden: true }),
      (() => {
        const bar = el('div', { className: 'ec-bar' });
        bar.append(el('button', { type: 'button', className: 'ec-main' }), el('button', { type: 'button', className: 'ec-toggle' }, '▾'));
        return bar;
      })(),
    );
    root.querySelector('.ec-main').addEventListener('click', onMain);
    root.querySelector('.ec-toggle').addEventListener('click', () => {
      const menu = root.querySelector('.ec-menu');
      menu.hidden = !menu.hidden;
    });
    root.querySelector('.ec-menu').addEventListener('click', onMenu);
    document.addEventListener('click', (event) => {
      if (!root.contains(event.target)) root.querySelector('.ec-menu').hidden = true;
    });
    document.body.appendChild(root);
    return root;
  }

  async function onMain() {
    const root = ensureRoot();
    const product = currentProduct();
    const inList = (await getState()).find((g) => g.options.some((o) => o.id === product.id));
    if (inList) {
      await send({ type: 'open-page' });
    } else {
      await send({ type: 'add-item', product });
      flash(root, t('hint_added'));
    }
  }

  async function onMenu(event) {
    const button = event.target.closest('button[data-act]');
    if (!button) return;
    const root = ensureRoot();
    root.querySelector('.ec-menu').hidden = true;
    const product = currentProduct();
    const act = button.dataset.act;
    if (act === 'new') {
      await send({ type: 'add-item', product });
      flash(root, t('hint_added_list'));
    } else if (act === 'alt') {
      await send({ type: 'add-alternative', gid: button.dataset.gid, product });
      flash(root, t('hint_added_alt', { label: button.dataset.label }));
    } else if (act === 'open') {
      await send({ type: 'open-page' });
    }
  }

  async function render() {
    const ref = productRef();
    if (!ref) {
      document.getElementById(ROOT_ID)?.remove();
      active = false;
      return;
    }
    active = true;
    const root = ensureRoot();
    const list = await getState();
    const inList = list.find((g) => g.options.some((o) => o.id === ref.id));

    const main = root.querySelector('.ec-main');
    main.textContent = inList
      ? inList.options.length > 1
        ? t('in_list_alts', { n: inList.options.length })
        : t('in_list')
      : t('add');
    root.querySelector('.ec-toggle').title = t('more');
    root.classList.toggle('ec-in-list', Boolean(inList));

    const menu = root.querySelector('.ec-menu');
    menu.replaceChildren();
    menu.append(el('button', { type: 'button' }, inList ? t('add_one_more') : t('add_new')));
    menu.lastChild.dataset.act = 'new';
    const targets = list.filter((g) => g !== inList);
    if (targets.length) {
      menu.append(el('div', { className: 'ec-menu-title' }, t('add_alt_to')));
      for (const g of targets) {
        const b = el('button', { type: 'button', className: 'ec-alt', title: itemLabel(g) }, itemLabel(g));
        Object.assign(b.dataset, { act: 'alt', gid: g.gid, label: itemLabel(g) });
        menu.append(b);
      }
    }
    menu.append(el('hr'));
    menu.append(el('button', { type: 'button' }, t('open')));
    menu.lastChild.dataset.act = 'open';
  }

  // KuantoKusta navigates client-side, so watch the URL instead of relying on page loads.
  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      render();
    }
  }, 600);

  api.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.list || changes.lang) && active) render();
  });

  render();
})();
