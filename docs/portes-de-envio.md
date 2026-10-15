# Portes de envio: delivery methods (planned)

Notes from the 2026-10-15 discussion, so the next step on shipping is not forgotten.

## The problem

Today the extension knows one shipping rule per store: the standard home-delivery cost to
mainland Portugal and the order value from which it becomes free (`data/stores.json`,
`shipping` / `freeAbove`). Real stores are more varied:

- **Mainland vs islands.** Mainland has one price; Açores and Madeira usually have another,
  often with a different free-shipping threshold (e.g. Aveiro Farma: 4,50 € / free over 55 €
  on the mainland, 6,90 € / free over 75 € to the islands).
- **Pickup points.** Many stores are cheaper when the parcel goes to a pickup point (DPD
  Pickup, InPost, Ponto CTT): e.g. SweetCare 3,25 € instead of 3,42 €, Wells 2,50 € instead of
  2,99 €, Atida free from 39 € instead of 49 €.
- **In-store pickup.** Often free (Farmácia da Liga, Farmacentral, Atida…), sometimes only
  near the store.
- **Exceptions.** Thresholds frequently exclude heavy or bulky items (nappies, milks, baby
  food, over 5 kg). We don't model this and probably shouldn't try.

Because the user may prefer one of these, the comparison should be done with the method
they actually use, otherwise the "cheapest store" can be wrong by a few euros, which is the
whole point of the tool.

## What to build

1. **A picker** on the Comparar tab, next to the list (or in the header): *Entrega* with the
   options **Casa (continente)**, **Casa (ilhas)**, **Ponto de recolha**, **Levantar na loja**.
   Default: *Casa (continente)*. Saved per browser (`storage.local.delivery`).
2. **Per-method rules in `data/stores.json`.** Keep `shipping` / `freeAbove` as the mainland
   home-delivery defaults (so existing data and the GitHub refresh keep working) and add an
   optional `methods` object:

   ```json
   "9342": {
     "name": "SweetCare",
     "shipping": 3.42,
     "freeAbove": 65,
     "methods": {
       "islands": { "shipping": 6.90, "freeAbove": 75 },
       "pickup":  { "shipping": 3.25, "freeAbove": 45 },
       "store":   { "shipping": 0 }
     },
     "notes": "…"
   }
   ```

   Missing method → fall back to the mainland rule (and show it as "estimado"). A method a
   store doesn't offer at all → `null`, and the store is treated as **not available** for
   that method (it drops out of the comparison, like a hidden store).
3. **Optimizer.** `shippingModel()` already takes `defaults`; pass the rule for the chosen
   method instead of the mainland one. The KuantoKusta per-offer cost (`shipping.minimumPrice`)
   is the mainland home-delivery cost, so for other methods the bundled value must win over the
   scraped one (today it's only a fallback).
4. **UI.** The Lojas table gets one column per method, or a method switch above it; the ✎
   dialog edits the rule for the current method. User overrides become per method too:
   `overrides[sellerId][method]`.
5. **Data.** The research agents already noted most pickup/island/in-store values in `notes`
   (see `data/stores.json`); a first pass can be extracted from there, then verified on the
   stores' sites.

## Open questions

- Should "Levantar na loja" only be offered when the store is near the user? We don't know
  where the user is; probably just let them pick it and show the store's town.
- Islands have carrier-specific weight limits that change the price a lot; a single number
  per store is an approximation. Fine for a first version.
- The 2-store split should respect the method too, but a pickup point per store means two
  trips; worth a note in the split card.
