# ICSS Plaza brand assets

ICSS Plaza is operated by **iCreate Solutions & Services**. The parent logo inspired the lightbulb, circuit terminals, navy, blue and gold. A storefront awning makes the Plaza mark specific to renting an online shop. Use the exact operator name in legal text.

## Files and usage

All artwork lives in `public/assets/brand/`. Root `/favicon.ico`, `/favicon.svg`, `/site.webmanifest` and the legacy `/assets/plaza.svg` are also included.

| Asset | Use |
| --- | --- |
| `mark-master.png` | Transparent 1024px master |
| `mark.png` | Transparent 512px mark |
| `logo-horizontal.svg/.png` | Platform navigation, footer and sign-in |
| `logo-horizontal-light.svg/.png` | Dark backgrounds |
| `logo-stacked.svg/.png` | Square or centered layouts |
| `favicon.svg`, `favicon-16/32/48.png` | Simplified bulb/store symbol for browser tabs |
| `mask-icon.svg` | Monochrome Safari pinned tab |
| `app-icon-192/512.png` | Manifest/app shortcuts |
| `app-icon-maskable-192/512.png` | Opaque background, inset artwork for adaptive icons |
| `apple-touch-icon.png` | 180px Apple home screen icon |
| `social-preview.svg/.png` | 1200 × 630 link preview |
| `social-square.svg/.png` | 1080 × 1080 social post |
| `brand-banner.svg/.png` | 1440 × 420 brand banner |
| `email-header.svg/.png` | 800 × 200 email artwork; use PNG in email clients |
| `receipt-header.svg/.png` | 1000 × 220 platform receipt artwork |
| `powered-by.svg/.png` | Platform credit on tenant stores |
| `circuit-pattern.svg` | Decorative background |
| `welcome.svg` | Dashboard welcome illustration |
| `empty-products/orders/media/cart.svg` | Contextual empty states |
| `not-found.svg`, `payment-success.svg` | Error and confirmed-payment illustrations |
| `tokens.json` | Palette and usage reference |

Logo SVG lockups embed a raster mark and editable SVG text. They are self-contained, but are not a fully traced vector master. Use PNG exports for consistent typography across devices; native SVG illustrations and the small favicon remain scalable. Dark artwork uses the light wordmark. Never stretch the logo or place the dark wordmark directly on a dark background.

## Colours and type

| Role | Hex |
| --- | --- |
| Navy | `#123B5A` |
| Blue | `#267FB0` |
| Cyan | `#39A8BF` |
| Gold | `#F6BC27` |
| Lime detail | `#8EB83D` |
| Paper | `#FAFBF8` |

Platform UI uses Arial/Helvetica/system sans-serif. Exported wordmarks use DejaVu Sans. Keep at least one quarter of the mark width clear around standalone artwork. Use the simplified favicon below 24px. Keep horizontal logos at least 180px wide when the operator descriptor must be readable.

Tenant names, uploaded logos, photos and storefront theme colours remain controlled by their owners. The Plaza badge identifies the hosting platform. These assets do not imply payment-provider endorsement.

## Rebuilding

The main mark was generated from the supplied iCreate logo concept: a navy lightbulb, blue rays, gold/cyan/green circuit branches and a storefront awning. Supporting artwork and lockups were composed in SVG; PNG exports are derived from those sources.

The generated exports are committed and require no build dependency at runtime. To regenerate sizes, make `sharp` available in the development environment (for example `npm install --no-save --package-lock=false sharp`), then run `npm run brand:build` from the repository root. The script reads the committed master, or a replacement supplied through `PLAZA_BRAND_MASTER`. The image helper can also resolve sharp from the Codex runtime when available. Rebuilding also refreshes the legacy favicon alias.

The manifest supplies app artwork; it does not implement offline mode or a service worker. Open Graph image URLs use the configured public origin when available and stay relative before one is configured. Public-origin configuration remains optional for startup.
