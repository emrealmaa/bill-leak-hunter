# Leak Hunter (Sızıntı Avcısı)

**English** · [Türkçe](README.tr.md)

Upload your credit card statement and see where money quietly slips away every month:
subscriptions, recurring payments, bank fees, taxes, interest and remaining installments.

**Your statement never leaves your device.** The PDF is read entirely in your browser. There is no
server, account, database, cookie or tracking script. It even works offline.

> Early development. Design: [PROJE.md](PROJE.md) (Turkish) · plan: [docs/YOL_HARITASI.md](docs/YOL_HARITASI.md) · status: [docs/ILERLEME.md](docs/ILERLEME.md)

<!-- SCREENSHOT: to be taken with synthetic data (never a real statement). -->
_Screenshot coming soon (synthetic data)._

## What it does

- **Subscriptions:** known services from the catalog (Netflix, Spotify, Turkish platforms, telecom operators…) and payments that repeat every month with a similar amount; a link to the official cancellation page when one is known.
- **Worth a look:** similar amounts at irregular intervals.
- **Fees, taxes, interest:** card fees, KKDF, BSMV, contractual interest… with plain explanations.
- **Remaining installments** and **unrecognized lines** (no guessing).
- **CSV** export (Excel friendly).

The core focuses on Turkey (Turkish banks, Turkish payment intermediaries such as `IYZICO*` and `PAYTR*`, Turkish fees and taxes), but nothing country-specific is hard-coded: anyone can add their own bank parser and merchant catalog.

Results are for information only; they are not financial or legal advice.

## Why it is safe

- Everything runs in the browser. The app makes no network requests while running (fonts and scripts are bundled).
- Statement data is never written to `localStorage` or anywhere else; it is gone when you close the page.
- The code is open source, so you can check what it does.

## Supported banks

| Bank | Status |
|---|---|
| Akbank (Axess), Turkey | Parser ready; the character table for the statement's non-copyable font is in progress |

Your bank is missing? [Request a bank](https://github.com/emrealmaa/bill-leak-hunter/issues/new?template=banka-ekle.yml) (never share statement content) or read [CONTRIBUTING.md](CONTRIBUTING.md).

## Requirements

- Node.js 22.13+ or 24+
- npm

## Install and run

```bash
npm install
npm run dev
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server (developer page: add `#debug` to the URL) |
| `npm run build` | Catalog validation + type check + static build into `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm test` | Runs the tests once |
| `npm run test:watch` | Runs the tests in watch mode |
| `npm run validate-catalog` | Validates `catalog/` files against the schema |
| `npm run akbank-check -- [--table <glyphs.json>] <a.pdf> [<b.pdf> …]` | Runs detection + parsing on real Akbank statements (prints numbers and yes/no only) |
| `node scripts/font-check.ts [--all-pages] <a.pdf> <b.pdf>` | Compares the font/glyph structure of two statements (numbers only) |
| `npm run privacy-check [-- --history [--ref <branch>]]` | Pre-push privacy check: PDFs, `private/blocklist.txt` terms, long digit runs, absolute paths |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md): adding a bank, labeling Type3 glyphs, adding merchants, privacy rules.

## License

Not decided yet.
