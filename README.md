# MenuQR — QR code menus for restaurants

Restaurants register, upload their menu PDFs, design a branded QR code, and print it for their tables. When guests scan the code, they see a fast, attractive mobile menu page.

## Features

**For restaurant owners**
- Register and log in (email and password, hashed with bcrypt)
- Upload up to 10 PDF menus (Food, Drinks, Desserts…), then rename and reorder them; first-page thumbnails show in the list
- Restaurant page: logo, cover photo, tagline, phone, address, opening hours, guest Wi‑Fi, a custom menu link, 5 page styles (Elegant, Modern, Rustic, Midnight, Fresh) and an accent colour
- **QR code designer**
  - 8 presets, plus dot styles, corner styles, solid or gradient colours and background colour
  - Your logo in the centre, with an adjustable size
  - Frames: none, card, banner or a printable table tent, with your own call‑to‑action text and the restaurant name
  - Error‑correction level and a contrast warning so the code stays scannable
  - Download as PNG (high resolution, with frame) or SVG (code only), or print 4 table cards per A4 page
- Insights: total menu views, the last 7 days, today, and a 14‑day chart

**For guests** (`/m/<your-link>`)
- Branded hero with cover photo, logo, name and tagline
- One‑tap chips: opening hours, call, directions (Google Maps), copy the Wi‑Fi password
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

> Printed QR codes contain `PUBLIC_URL/m/<slug>`. Pick your final domain before you print.
> Uploading a new PDF never changes the QR code. Only changing the menu link does.

## Tech

- Node.js and Express, using the built‑in `node:sqlite` database
- Multer for uploads; PDF and image files are checked by their file signature (magic bytes)
- [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) for QR codes, [pdf.js](https://mozilla.github.io/pdf.js/) to show the PDFs
- Plain HTML, CSS and JS front end, with no build step

```
server.js            API, auth, uploads, static hosting
public/index.html    landing page
public/login.html    login
public/register.html registration
public/dashboard.html + js/dashboard.js   owner dashboard and QR designer
public/menu.html     guest menu page
```

## Deploying

Any host that runs Node 22 with a persistent disk works, for example a VPS, Render, Railway or Fly.io with a volume. Keep `data/` and `uploads/` on persistent storage, put the app behind HTTPS, and set `PUBLIC_URL` and `NODE_ENV=production`.
