# Sızıntı Avcısı

Kredi kartı / banka ekstreni yükle, her ay farkında olmadan nereye para kaçırdığını gör:
abonelikler, anlaşılmayan satıcı adları, banka ücretleri ve vergiler.

**Ekstren cihazından hiç çıkmaz.** PDF tamamen tarayıcıda okunur; sunucu, veritabanı
veya izleme scripti yoktur.

> Proje erken geliştirme aşamasında. Ayrıntılı tasarım için [PROJE.md](PROJE.md).

## Gereksinimler

- Node.js 22.13+ veya 24+
- npm

## Kurulum

```bash
npm install
```

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusunu başlatır (geliştirici sayfası: adrese `#debug` ekle) |
| `npm run build` | Tip kontrolü yapar ve `dist/` içine statik derleme alır |
| `npm run preview` | Derlenmiş sürümü yerelde sunar |
| `npm test` | Testleri bir kez çalıştırır |
| `npm run test:watch` | Testleri izleme modunda çalıştırır |
| `node scripts/font-check.ts [--all-pages] <a.pdf> <b.pdf>` | İki ekstrenin font/glif yapısını karşılaştırır (yalnızca sayı yazdırır) |
| `npm run validate-catalog` | `catalog/` dosyalarını şemaya göre doğrular (build'in ilk adımı) |
| `npm run akbank-check -- [--table <glyphs.json>] <a.pdf> [<b.pdf> …]` | Gerçek Akbank ekstrelerinde tanıma + ayrıştırmayı dener (yalnızca sayı ve evet/hayır yazdırır) |
| `npm run privacy-check [-- --history]` | Push öncesi gizlilik kontrolü: PDF, `private/blocklist.txt` ifadeleri, uzun rakamlar, mutlak yollar. `--history` tüm git geçmişini de tarar |

## Gizlilik

- Gerçek ekstreler `private/` klasöründe tutulur; bu klasör ve tüm `*.pdf` dosyaları git dışındadır.
- Test verileri yalnızca anonimleştirilmiş / sahte metinlerdir.
- Her push'tan önce `npm run privacy-check` çalıştırılır. Yasaklı ifadeler git dışındaki `private/blocklist.txt` dosyasında tutulur; script eşleşen içeriği asla yazdırmaz.
