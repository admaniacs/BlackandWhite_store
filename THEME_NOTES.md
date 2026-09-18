# B/W Shopify theme — implementation notes

This is an Online Store 2.0 (Liquid + JSON templates) theme implementing the
resolved screens (`2a`–`2n`) from `project/B-W Store.dc.html`. It does not
reproduce the `1a`–`1j` explorations — those were superseded by turn 2.

## Structure

- `layout/theme.liquid` — shell: fonts, announcement bar, header, footer, cart
  drawer, search overlay, `theme.css` / `theme.js`.
- `sections/*` — one section per mockup block (hero, category strip, best
  sellers, collection grid + filters, product page, watches landing,
  lookbook, about, search results, cart).
- `templates/*.json` — Online Store 2.0 JSON templates wiring sections to
  `index`, `collection`, `collection.watches`, `product`, `search`, `cart`.
- `templates/customers/*` — classic customer account templates (`account`,
  `order`, `login`, `register`, `addresses`) for screen `2j`. Not included:
  `reset_password.liquid` / `activate_account.liquid` — low-traffic
  transactional pages, Shopify's built-in unstyled fallback covers them
  until someone wants them themed too.
- `assets/theme.css` — the whole design system as reusable tokens/classes
  (`--ink`, `--paper`, `bw-btn`, `bw-product-card`, etc.) instead of the
  mockup's inline styles.
- `assets/theme.js` — cart drawer (AJAX add/update/remove), predictive
  search overlay, mobile filter sheet, product variant picker + gallery sync,
  sticky mobile add-to-cart bar, mobile nav.

Mobile screens `2k`–`2n` aren't separate templates — they're the same
sections responding to the `@media (max-width: 749px)` breakpoint in
`theme.css`, matching how the mockup itself just changes canvas width.

## Screen `2e` — checkout — important limitation

Shopify's checkout (`2e` in the mockup) **cannot be rebuilt as Liquid** on an
Online Store 2.0 theme. `checkout.liquid` templating was retired; checkout is
now a Shopify-hosted, PCI-compliant page you customize through:

- **Checkout branding editor** (Settings → Checkout → Customize) — fonts,
  colors, corner radius, logo. Can get you flat-black-and-white, hairline
  borders, and Archivo-adjacent typography, but not the exact two-column
  layout or copy in the mockup.
- **Checkout UI extensions** (Shopify Functions / checkout extensibility) —
  for structural changes (custom fields, banners, upsells), available on
  Shopify Plus.

What this theme does instead: the cart drawer and `templates/cart.json` both
submit straight to `{{ routes.cart_url }}` → Shopify checkout, styled as
close to the mockup as the branding editor allows. I didn't build a fake
`checkout.liquid` mimicking `2e` pixel-for-pixel because it would never
actually run — Shopify ignores that file on OS 2.0 stores.

## Content that needs real data

- Product metafields used, with graceful fallbacks: `custom.size_guide`
  (rich text), `custom.fabric` / `fit` / `origin` / `care` (single line
  text), `reviews.rating` / `reviews.rating_count` / `reviews.reviews`
  (standard Shopify Product Reviews app namespace).
- `settings.cart_upsell_product` (theme setting) drives the cart drawer's
  "Add a cap for $18" upsell row — point it at a real product.
- Navigation comes from the theme's `main-menu` link list — create Hoodies /
  Tees / Shirts / Shoes / Hats / Watches / Lookbook / About in
  Shopify admin → Navigation.
- `templates/index.json`'s category strip and best-sellers block reference
  collection handles (`hoodies`, `tees`, `shirts`, `shoes`, `hats`,
  `watches`, `best-sellers`) — create collections with those handles, or
  repoint the settings in the theme editor.
- Collection **filters** (`collection.filters`) come from Shopify
  Search & Discovery — enable colour/size/price filtering on each collection
  in that app for the sidebar (`2b`) and filter sheet (`2l`) to populate.

## Fonts & placeholders

Google Fonts (Archivo + Archivo Black) are loaded in `theme.liquid`, same
families as the mockup. Every image slot falls back to a labelled
placeholder (`bw-media-placeholder`) when no real Shopify image/metafield
image is set, exactly like the mockup's own placeholder convention — swap in
real product photography and nothing else needs to change.
