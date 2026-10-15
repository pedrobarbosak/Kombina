# KCompare

Browser extension (Firefox and Chrome) for buying several products at once on
[kuantokusta.pt](https://www.kuantokusta.pt). Add the products you want to a list and it
finds the **single store with the lowest total, shipping included**. If no store has every
product, it shows the **cheapest 2-store split** instead.

Each item on the list can have **alternatives**: products that do the same job, like a
refill vs the full bottle, or a 2-pack vs 2 singles. For each store, the extension picks
whichever alternative is cheapest there.

## Install

### Firefox (121+)
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `manifest.json` in this folder.
3. Click the KCompare toolbar icon. If the page says *"needs access to kuantokusta.pt"*,
   click **Allow access**. You can also do it in `about:addons` → KCompare → Permissions.

A temporary add-on is removed when Firefox restarts. For a permanent install, sign it as an
unlisted add-on on [addons.mozilla.org](https://addons.mozilla.org/developers/) (`npm run
build` creates the zip), or use Firefox Developer Edition with `xpinstall.signatures.required`
set to `false`.

### Chrome / Edge / Brave
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.

## Use

The interface is in European Portuguese by default; the PT/EN switch at the top of the page
changes it everywhere, including the button on kuantokusta.pt. Translations live in
`src/shared/i18n.js` (page) and `src/content/strings.js` (button); the extension name and
description are in `_locales/`.

**Add products.** On any kuantokusta.pt product page, use the floating button
(bottom-right):
- **+ Add to KCompare** adds the product as a new item.
- **▾ → Add as an alternative to…** adds it as an alternative to an item already on the
  list (e.g. while viewing the refill, pick the full bottle you added earlier).
- **▾ → Open KCompare** opens the list page. Once a product is on the list, the main
  button opens the page too.

You can also paste product URLs on the page itself.

**The KCompare page** opens when you click the toolbar icon. From top to bottom:
- **The answer.** The cheapest single store for your whole list, with what you'd buy there
  and the shipping. **Open all N at …** opens one tab per product on that store's site
  (through KuantoKusta's usual "Ver na loja" link), and each line has its own **Open**.
  If splitting between two stores is cheaper, or no store has everything, a second card
  shows the best 2-store split with the same buttons.
- **Your list.** One card per item, with its quantity. An item can have **alternatives**:
  press **+ Add an alternative** and paste the link of a product that could replace it.
  **per item** is how many of that product make one item (e.g. `2` for a 500ml single
  when the item is a 2×500ml pack). The cheapest alternative is shown in green. If you added
  two versions as separate items, **This is an alternative of…** merges them.
- **Every store.** All stores ranked by total for your list, 8 at a time. Open one to see
  what you'd buy there, what's missing, and to **Open all** or correct its shipping (✎).
- **Shipping rules** (second tab, `#portes`): every store's shipping cost and free-shipping
  threshold, with its source, editable in one place.

### Shipping and free-shipping thresholds
KuantoKusta only shows the shipping cost per offer; it never says from what order value a
store ships free. The extension combines three sources, in this order:
1. **Your values.** Click ✎ next to any store (in the answer, a store row, or the
   **Shipping rules** table at the bottom) to set its shipping cost and/or free-shipping
   threshold. Saved per store, reused for every list, tagged *you*. **Reset** removes them.
2. **The stores' own sites.** `data/stores.json` holds the shipping cost and threshold
   for the pharmacies that appear most on KuantoKusta, with a source link and the date it was
   checked. Stores change their rules, so re-check now and then
   (`node scripts/merge-stores.mjs new-research.json` merges updated data).
3. **What the offers reveal.** KuantoKusta shows 0 € shipping on products above a store's
   threshold. When a store charges on a cheap product but not on a pricier one, the extension
   guesses the threshold (*guessed from their offers*; *may be free* when your subtotal falls
   in the uncertain range). Observations are kept for 30 days across everything you compare.

When the winning store's shipping could become free, the answer says how much more you'd
need to add. When the threshold is unknown, it asks you to set it.

### Correcting the shipping data
`data/stores.json` is meant to be maintained in the open. Each entry is keyed by the
KuantoKusta `sellerId` and has `shipping` (standard cost to mainland Portugal), `freeAbove`
(order value from which shipping is free, `null` if none), `notes` / `notes_en`, `source`
(the store page that states it), `checked` (date) and `confidence`. To fix a value, edit the
file and open a pull request, or open an issue from the **Portes das lojas** tab (the ✎
dialog has a *Suggest a correction* link that prefills it). Once `GITHUB_REPO` is set in
`src/lib/config.js`, installed extensions pick up changes within a day without an update.

Prices are cached for 15 minutes. Click **↻ Refresh prices** to fetch them again.

## Development

```
npm install          # installs web-ext (only needed for lint/run/build)
npm test             # unit tests for the parser and optimizer (node --test)
npm run lint         # web-ext lint
npm run start:firefox
npm run start:chrome
npm run build        # zip in web-ext-artifacts/
```

No build step: the files load directly as written.

| Path | What it does |
| --- | --- |
| `src/lib/kk.js` | Everything tied to KuantoKusta's page structure (reads `__NEXT_DATA__` from product pages). If the site changes, fix it here. |
| `src/lib/optimize.js` | Pure functions: shipping estimate, best alternative per store, single-store ranking, 2-store splits. |
| `data/stores.json` | Shipping cost and free-shipping threshold per store, from the stores' own sites. Public and editable; `scripts/merge-stores.mjs` merges new research. Set `GITHUB_REPO` in `src/lib/config.js` and the page refreshes it from GitHub daily. |
| `src/lib/storage.js` | The list (items → alternatives), shipping overrides, shipping observations, cache. Migrates the v0.1 list automatically. |
| `src/lib/products.js` | Fetches offers (3 at a time) using the 15-min cache. |
| `src/background.js` | Opens or focuses the page from the toolbar icon. Applies list changes sent by the content script. |
| `src/content/` | Floating button and menu on product pages. Watches URL changes, because the site switches pages without reloading. |
| `src/app/` | The KCompare page (list + results). |

## Limits
- KuantoKusta uses Akamai bot protection. Requests only work from a normal browser
  session, which is why this is an extension and not a script (`curl` and headless browsers
  get `403 Access Denied`).
- Shipping is KuantoKusta's *minimum* shipping. Real costs can depend on weight, region
  (islands) or payment method, so check the store's checkout before buying.
- The 2-store split gives each item to whichever of the two stores is cheaper for it. It
  doesn't move items between stores to reach a free-shipping threshold.
