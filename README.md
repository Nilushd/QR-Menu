# MenuQR — QR code menus for restaurants

Restaurants register, upload their menu PDFs, design a branded QR code, and print it for their tables. When guests scan the code, they see a fast, attractive mobile menu page.

## Features

**For restaurant owners**
- Register and log in (email and password, hashed with bcrypt)
- **Dishes and photos:** add dishes with a photo, price, category and description
  - Labels: Chef's special, Popular, New, Vegetarian, Vegan, Spicy, Gluten‑free, Seafood
  - Mark dishes as "featured" or "unavailable today", and reorder them
  - Photos are resized in the browser so they load quickly on phones
- **PDF menus:** upload up to 10 (Food, Drinks, Wine list…), then rename and reorder them; first‑page thumbnails show in the list
- **Menu page design**, with a live phone preview that updates as you edit:
  - 5 colour styles plus an accent colour, and 7 font pairings
  - 3 header styles (full photo, compact, minimal) and 3 dish layouts (grid, list, magazine)
  - Logo, cover photo, tagline, an announcement banner, currency, and whether dishes or PDFs come first
  - Optional "Chef's picks" carousel and dish search
  - Phone, address, opening hours, Wi‑Fi, Instagram, Facebook, website and WhatsApp
- **QR code designer** (uses its own SVG drawing engine, `public/js/qr-render.js`)
  - 12 dot patterns: square, rounded, dots, fluid, classy, diamond, stars, hearts, plus, vertical lines, horizontal lines and bubbles, with an adjustable dot size
  - 6 outer and 8 inner corner‑eye shapes, each with its own colour
  - Solid, linear (any angle) or radial gradient fill, and any background colour
  - **Logo in the centre:** use the restaurant logo or **upload a separate QR logo**; choose the size, shape (original, rounded or circle) and an optional background plate
  - 10 presets; frames: none, card, banner or a printable table tent, with your own call‑to‑action text
  - A contrast warning, and a safe error‑correction level picked automatically when there's a logo
  - Download as PNG (high resolution, with frame) or SVG (code only, logo included), or print 4 table cards per A4 page
- Insights: total menu views, the last 7 days, today, and a 14‑day chart

**For guests** (`/m/<your-link>`)
- Photo menu with a "Chef's picks" carousel, category tabs, live search, and labels for sold‑out or featured dishes
- Tap a dish to open a sheet with a large photo, price, labels and the full description
- Branded header with cover photo, logo, name and tagline, in your chosen style, fonts and colours
- One‑tap chips: opening hours, call, directions (Google Maps), copy the Wi‑Fi password, and social links
- Sticky tabs when there are several menus, with scroll‑spy
- PDF pages are drawn crisply with pdf.js, load lazily and fade in as you scroll
- Tap a page to open a full‑screen viewer with zoom and swipe between pages
- Works on any phone browser, no app needed

## Run it

Needs Node.js 22.5 or newer, which has SQLite built in.

```bash
npm install
npm start
```

Then open http://localhost:3000.

### Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `PUBLIC_URL` | the browser's origin | Public base URL encoded in QR codes, e.g. `https://menu.example.com`. **Set this in production.** |
| `DATA_DIR` | `./data` | SQLite database location |
| `UPLOAD_DIR` | `./uploads` | Uploaded PDFs and images |
| `NODE_ENV` | — | Set to `production` to mark cookies `Secure` (needs HTTPS) |

> **Scannability:** every combination of dot pattern and corner‑eye shape (576 in all), plus the largest logo in each logo shape, was checked with the ZXing decoder. Still test‑scan your own design with a couple of phones before printing.

> Printed QR codes contain `PUBLIC_URL/m/<slug>`. Pick your final domain before you print.
> Uploading a new PDF never changes the QR code. Only changing the menu link does.

## Tech

- Node.js and Express, using the built‑in `node:sqlite` database
- Multer for uploads; PDF and image files are checked by their file signature (magic bytes)
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) builds the QR data; `public/js/qr-render.js` draws the styled code
- [pdf.js](https://mozilla.github.io/pdf.js/) shows the PDFs
- Plain HTML, CSS and JS front end, with no build step

```
server.js            API, auth, uploads, static hosting
public/index.html    landing page
public/login.html    login
public/register.html registration
public/dashboard.html + js/dashboard.js   owner dashboard: dishes, PDFs, page design, QR designer
public/js/qr-render.js styled QR code engine (SVG and PNG)
public/menu.html     guest menu page
```

## Deploying

Any host that runs Node 22 with a persistent disk works, for example a VPS, Render, Railway or Fly.io with a volume. Keep `data/` and `uploads/` on persistent storage, put the app behind HTTPS, and set `PUBLIC_URL` and `NODE_ENV=production`.
