# Contributing

Thanks for helping! Contributions from any country are welcome: a parser for your bank, merchants
from your market, fixes and translations.

> Türkçe özet: Yeni banka için `src/banks/<banka>/` + sentetik fixture; satıcı için
> `catalog/merchants/*.json`. **Gerçek ekstre asla paylaşılmaz** — ne issue'da, ne PR'da, ne ekran görüntüsünde.

## 1. Privacy rules (read first)

- **Never share a real statement** or any part of it: not in issues, PRs, commits, test fixtures,
  screenshots or logs. Garbled text copied from a PDF counts too — it can be decoded.
- Tests use **synthetic fixtures only**: invented names (`AD SOYAD`), `0000` card numbers, fake
  addresses and amounts. Do not copy a single line from a real statement; imitate the *structure*.
- Diagnostic scripts must print **numbers only** (counts, yes/no), never text, amounts or file names.
- Keep your own statements in `private/` (git-ignored). Before pushing, create
  `private/blocklist.txt` (one personal term per line: name, district, card's last 4 digits…) and run:

  ```bash
  npm run privacy-check
  ```

## 2. Adding a bank

Each bank implements one interface (`src/types.ts` → `BankParser`). The parser receives decoded
lines (`StatementLine[]`: page, index, y and cells with x positions), never the raw PDF.

1. Create `src/banks/<bank-id>/`:
   - `detect.ts` — look only for the bank's **fixed** phrases (brand + document title). Never look at
     personal fields.
   - `parse.ts` — turn lines into `Transaction[]`; use the helpers in `src/banks/common/`
     (`parseDate`, `parseAmount` with an explicit `"tr"`/`"en"` format, `detectCurrency`, `foldKey`).
     Report unreadable lines as `warnings` (`{ page, line, reason }`), never with content.
   - `index.ts` — export the `BankParser` object.
2. Register it with one line in `src/banks/registry.ts`.
3. Write a **synthetic** fixture in `tests/fixtures/<bank-id>/` (fixed-width text; see
   `tests/helpers/fixtureLines.ts` and the Akbank example) containing every row type at least once:
   purchase, payment, refund, installment, fee, tax, interest, foreign currency, headers.
4. Add tests: detection (your fixture is recognized, random text is not) and parsing (expected
   `Transaction` for every row type).
5. `npm test && npm run build`.

## 3. Banks with non-copyable PDFs (Type3 fonts)

Some banks draw text with Type3 fonts that have no Unicode mapping, so copy-paste yields garbage.
We decode them with a table: **glyph shape hash → character**. The table contains no personal data.

1. `npm run dev`, open `http://localhost:5173/#debug`, drop your statement, choose **Etiketleme modu**
   (labeling mode).
2. Type what each line image shows. Identical lines are grouped (×N); one label solves all copies.
   Suggested order: digits and `/ . , ( ) -`, upper-case letters, fixed bank texts, lower-case and
   Turkish letters. Type exactly what you see (`İ`/`I`/`ı`).
3. Download `glyphs.json` regularly into `private/glyphs.json`.
4. Check progress (numbers only): `npm run akbank-check -- --table private/glyphs.json private/<file>.pdf`
   (or an equivalent script for your bank).
5. When the unknown-glyph count is 0, copy the table to `src/banks/<bank-id>/glyphs.json` and set it
   as `glyphTable` on your parser. The file format is exactly
   `{ "hashVersion": N, "glyphs": { "<hash>": "<one character>" } }` — nothing else.

## 4. Adding merchants to the catalog

Merchants live in `catalog/merchants/<category>.json` (schema: `catalog/schema.json`).

```json
{
  "id": "example-service",
  "name": "Example Service",
  "category": "video",
  "patterns": ["\\bEXAMPLE ?SERVICE"],
  "isSubscription": true,
  "cancelUrl": "https://example.com/account",
  "verified": false
}
```

- `patterns` are regular expressions matched against the **normalized, upper-case, ASCII-folded**
  description (`Ö` → `O`, `İ` → `I`). Use word boundaries (`\\b`) to avoid partial-word matches.
- `cancelUrl` only if it is the **official** cancellation / account page and you are sure. Otherwise
  leave it out.
- `verified: false` unless the pattern was seen on a real statement; then `true` with
  `"sources": ["seen on a contributor's statement"]` — **never** statement content.
- Payment intermediaries (`IYZICO*`, `PAYTR*` …) go to `catalog/intermediaries.json`.
- Fees and taxes go to `catalog/fees/*.json`; explanations must be informative only — no legal claims
  or advice ("you can get this back" etc. is rejected by the validator).
- Run `npm run validate-catalog` (also part of `npm run build`).

## 5. Pull requests

- One logical change per commit; messages like `feat: …`, `fix: …`, `docs: …`.
- `npm test`, `npm run build` and `npm run privacy-check` must pass.
- Describe what changed, why, and how you tested it.
