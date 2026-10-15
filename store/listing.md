# Store listing

Copy-paste material for the Chrome Web Store and Firefox Add-ons (AMO). Packages come from
`npm run build` (`dist/kombina-chrome-<version>.zip`, `dist/kombina-firefox-<version>.zip`).
Images are in `store/images/`.

## Shared

| Field | Value |
| --- | --- |
| Name | Kombina |
| Category | Shopping (Chrome: *Shopping*; AMO: *Shopping*) |
| Languages | Portuguese (Portugal) default; English |
| Homepage | https://github.com/pedrobarbosak/Kombina |
| Support | https://github.com/pedrobarbosak/Kombina/issues |
| Privacy policy | https://github.com/pedrobarbosak/Kombina/blob/main/PRIVACY.md |
| License | MIT |

## Summary (Chrome ≤ 132 characters, AMO ≤ 250)

**PT:** Descobre em que loja do KuantoKusta a tua lista inteira fica mais barata, com portes incluídos.

**EN:** Find the KuantoKusta store where your whole shopping list is cheapest, shipping included.

## Description

### PT

Vais comprar vários produtos de uma vez no KuantoKusta? O Kombina diz-te em que loja a lista
inteira fica mais barata, com os portes incluídos, para fazeres uma só encomenda.

**Como funciona**
• Abre um produto no kuantokusta.pt e carrega em "Adicionar ao Kombina". Também podes colar o link.
• Abre o Kombina no ícone da barra de ferramentas: vês a loja mais barata para a lista toda,
  o preço de cada produto e os portes.
• Se nenhuma loja tiver tudo, ou se for mais barato dividir, o Kombina mostra a melhor divisão
  por duas lojas e quanto poupas.
• "Comprar na …" abre todos os produtos nessa loja, um separador por produto.

**Alternativas**
Um artigo pode ter alternativas: a recarga ou o frasco, um pack de 2 ou duas unidades. Em cada
loja conta a alternativa mais barata.

**Portes grátis**
O Kombina sabe a partir de que valor muitas farmácias oferecem os portes e diz-te quanto falta
juntar. Podes corrigir os portes de qualquer loja e esconder as lojas onde não queres comprar.

**Privacidade**
Não recolhe nem envia dados pessoais. A tua lista fica guardada só no teu navegador.

O Kombina é um projeto independente, sem ligação ao KuantoKusta nem às lojas.

### EN

Buying several products at once on KuantoKusta? Kombina tells you which store sells the whole
list for the least money, shipping included, so you can place a single order.

**How it works**
• Open a product on kuantokusta.pt and click "Add to Kombina", or paste its link.
• Open Kombina from the toolbar icon: you get the cheapest store for the whole list, each
  product's price and the shipping.
• If no store has everything, or splitting is cheaper, Kombina shows the best split between two
  stores and how much it saves.
• "Buy at …" opens every product at that store, one tab each.

**Alternatives**
An item can have alternatives: a refill or the full bottle, a 2-pack or two singles. Each store
is priced with whichever alternative is cheapest there.

**Free shipping**
Kombina knows the order value from which many pharmacies ship for free, and tells you how much
more you'd need to add. You can correct any store's shipping and hide stores you don't buy from.

**Privacy**
It doesn't collect or send personal data. Your list stays in your browser.

Kombina is an independent project, not affiliated with KuantoKusta or the stores.

## Chrome Web Store: privacy practices tab

**Single purpose**
Compare the total cost, shipping included, of a list of kuantokusta.pt products across the
stores that sell them, and show the cheapest store.

**Permission justifications**

| Permission | Justification |
| --- | --- |
| `storage` | Saves the user's shopping list, shipping corrections, hidden stores and settings locally, and caches product pages for 15 minutes. |
| Host `https://www.kuantokusta.pt/*` | Reads the prices and shipping of the products on the list from their kuantokusta.pt pages, and shows the "Add to Kombina" button on those pages. |
| Host `https://raw.githubusercontent.com/*` | Downloads, at most once a day, the public JSON file with each store's shipping rules from the project's GitHub repository. |

**Remote code:** No. All code is in the package; the GitHub file is JSON data only.

**Data usage:** tick none of the data types. Certify all three statements (not sold to third
parties, not used for unrelated purposes, not used for creditworthiness or lending).

**Privacy policy URL:** https://github.com/pedrobarbosak/Kombina/blob/main/PRIVACY.md

## Firefox Add-ons (AMO)

- **Source code:** not needed. The package contains the original, unminified source.
- **Add-on ID:** `kombina@pedrobarbosak.github.io` (in the manifest).
- **Tags:** shopping, price comparison, portugal, kuantokusta, pharmacy.
- **Notes for reviewers:**

  > Kombina reads product pages on www.kuantokusta.pt (fetched from the extension page with
  > `credentials: 'omit'`) to compare prices and shipping across stores. Once a day it may fetch
  > https://raw.githubusercontent.com/pedrobarbosak/Kombina/main/data/stores.json, a JSON file
  > with shipping rules; it is parsed as data, never executed. All markup is built through
  > `setHTML()` in `src/shared/dom.js`, and every dynamic value is escaped with `esc()` first.
  > No minification or build step; the code in the package is the source.
  > To test: open https://www.kuantokusta.pt/p/3422263/itf-farma-natalben-lactacao-60-capsulas,
  > click "Adicionar ao Kombina", then click the toolbar icon.

## Images

| File | Size | Use |
| --- | --- | --- |
| `icons/icon-128.png` | 128×128 | Store icon (both stores) |
| `store/images/pt-1-compare.png` | 1280×800 | Screenshot 1, PT |
| `store/images/pt-2-button.png` | 1280×800 | Screenshot 2, PT |
| `store/images/pt-3-stores.png` | 1280×800 | Screenshot 3, PT |
| `store/images/pt-4-dark.png` | 1280×800 | Screenshot 4, PT |
| `store/images/en-1-compare.png` … `en-4-dark.png` | 1280×800 | Same set, EN |
| `store/images/promo-small-440x280.png` | 440×280 | Chrome small promo tile (required) |
| `store/images/promo-marquee-1400x560.png` | 1400×560 | Chrome marquee tile (optional) |
