# Figur Delivery Scheduler — Shopify App

A Shopify embedded app that controls the delivery date & time picker shown in Figur's cart drawer and cart page. Rules and settings are stored as Shopify shop metafields (`$app:delivery`); the storefront picker calls an App Proxy endpoint (`/apps/delivery/availability`) for live availability that respects per-collection/product/tag rules.

## Architecture

```
Merchant → Embedded admin (Remix + Polaris)
            → saves Settings + Rules metafields to Shopify

Storefront → App Proxy (/apps/delivery/availability)
            → fetches Settings + Rules metafields + product collection/tag data
            → returns { minDate, maxDate, disabledWeekdays, blackoutDates, slots }

Theme Extension (cart-delivery.js) renders flatpickr + slot select from proxy response
```

## First-time setup

### 1. Create a Shopify Partners app

1. Go to [partners.shopify.com](https://partners.shopify.com) → Apps → Create app
2. Set App URL: `https://figur-delivery.vercel.app`
3. Set Redirect URL: `https://figur-delivery.vercel.app/auth/callback`
4. Copy the **Client ID** and **Client secret**

### 2. Configure `shopify.app.toml`

```toml
client_id = "<your-client-id>"
```

Also verify:
```toml
[app_proxy]
url = "https://figur-delivery.vercel.app/proxy"
subpath = "delivery"
prefix = "apps"
```

### 3. Set up Upstash Redis (session storage)

1. Create a free database at [console.upstash.com](https://console.upstash.com)
2. Copy the REST URL and token

### 4. Set environment variables

Copy `.env.example` → `.env` and fill in all values.

### 5. Install dependencies

```bash
bun install
```

### 6. Local development

```bash
shopify app dev
```

This will:
- Open the embedded app in your dev store (figur-7317.myshopify.com)
- Start the Remix server on port 3000
- Tunnel it publicly via Shopify's ngrok proxy

### 7. Enable the theme extension

After `shopify app dev` or `shopify app deploy`:
1. Go to Shopify Admin → Online Store → Themes → Customize
2. Under **App embeds**, enable **Delivery Picker (global)** — this loads the JS globally
3. On the Cart page, drag the **Delivery Picker** app block into the cart layout

### 8. Deploy to Vercel

```bash
shopify app deploy
```

Set the same env vars in the Vercel project settings.

## Data model

All config is stored as shop metafields in the `$app:delivery` namespace:

| Key | Type | Description |
|-----|------|-------------|
| `settings` | JSON | Global defaults (timezone, slots, cutoffs, lead time, blackouts) |
| `rules` | JSON | Ordered array of per-collection/product/tag rule overrides |

## Cart attribute contract (unchanged from the theme picker)

| Attribute | Example |
|-----------|---------|
| `Delivery Date` | `Tuesday, June 3, 2026` |
| `Delivery Slot` | `4:00 PM – 6:00 PM` |
| `_Delivery Date` | `2026-06-03` (private, for re-hydration) |
| `_Delivery Slot` | `16:00-18:00` (private, for re-hydration) |

These surface automatically in the Admin order page, checkout, and confirmation emails.

## Existing API scopes (add to the Partners app)

```
read_products, write_products, read_metafields, write_metafields
```

## Theme changes made (Phase 4)

- `theme/snippets/cart-drawer.liquid` — replaced `{% render 'cart-delivery' %}` with `<div data-figur-delivery="drawer"></div>` (app extension JS mounts into this)
- `theme/sections/cart-drawer.liquid` — removed flatpickr + cart-delivery asset loads
- `theme/sections/main-cart.liquid` — removed flatpickr + cart-delivery asset loads
- Old files (`theme/assets/cart-delivery.js`, `cart-delivery.css`, `theme/snippets/cart-delivery.liquid`, `theme/blocks/_cart-delivery.liquid`) can be deleted after the extension is live and tested
