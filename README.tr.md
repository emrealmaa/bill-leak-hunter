# Sızıntı Avcısı

[English](README.md) · **Türkçe**

Kredi kartı ekstreni yükle, her ay farkında olmadan nereye para kaçırdığını gör:
abonelikler, düzenli tekrarlayan ödemeler, banka ücretleri, vergiler, faizler ve kalan taksitler.

**Ekstren cihazından hiç çıkmaz.** PDF tamamen tarayıcıda okunur; sunucu, hesap, veritabanı,
çerez ya da izleme scripti yoktur. İnternetini kapatıp da kullanabilirsin.

> Proje erken geliştirme aşamasında. Ayrıntılı tasarım: [PROJE.md](PROJE.md) · plan: [docs/YOL_HARITASI.md](docs/YOL_HARITASI.md) · durum: [docs/ILERLEME.md](docs/ILERLEME.md)

<!-- EKRAN GÖRÜNTÜSÜ: sentetik veriyle alınacak (gerçek ekstre değil). -->
_Ekran görüntüsü yakında (sentetik veriyle)._

## Ne yapar?

- **Abonelikler:** katalogdaki bilinen servisler (Netflix, Spotify, Exxen, Turkcell…) ve her ay benzer tutarla tekrar eden ödemeler; resmi iptal sayfası biliniyorsa bağlantısı.
- **Kontrol et:** benzer tutarlı ama düzensiz aralıklı ödemeler.
- **Ücretler, vergiler, faizler:** kart aidatı, KKDF, BSMV, akdi faiz… sade açıklamalarıyla.
- **Kalan taksitler** ve **tanınmayan satırlar** (tahmin yürütülmez).
- Sonuçları **CSV** olarak indirme (Excel uyumlu).

Sonuçlar bilgilendirme amaçlıdır; finansal ya da hukuki tavsiye değildir.

## Neden güvenli?

- Bütün işlem tarayıcıda yapılır. Uygulama çalışırken hiçbir ağ isteği atmaz (font ve scriptler dahil her şey uygulamayla gelir).
- Ekstre verisi `localStorage`'a ya da başka bir yere yazılmaz; sayfa kapanınca kaybolur.
- Kod açık kaynak; ne yaptığını kendin inceleyebilirsin.

## Desteklenen bankalar

| Banka | Durum |
|---|---|
| Akbank (Axess) | Ayrıştırıcı hazır; ekstrenin kopyalanamayan yazı tipi için karakter tablosu hazırlanıyor |

Bankan yok mu? [Bankamı ekle](https://github.com/emrealmaa/bill-leak-hunter/issues/new?template=banka-ekle.yml) (ekstre içeriği paylaşma) ya da [CONTRIBUTING.md](CONTRIBUTING.md)'ye bak.

## Gereksinimler

- Node.js 22.13+ veya 24+
- npm

## Kurulum ve çalıştırma

```bash
npm install
npm run dev
```

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | Geliştirme sunucusunu başlatır (geliştirici sayfası: adrese `#debug` ekle) |
| `npm run build` | Katalog doğrulaması + tip kontrolü + `dist/` içine statik derleme |
| `npm run preview` | Derlenmiş sürümü yerelde sunar |
| `npm test` | Testleri bir kez çalıştırır |
| `npm run test:watch` | Testleri izleme modunda çalıştırır |
| `npm run validate-catalog` | `catalog/` dosyalarını şemaya göre doğrular |
| `npm run akbank-check -- [--table <glyphs.json>] <a.pdf> [<b.pdf> …]` | Gerçek Akbank ekstrelerinde tanıma + ayrıştırmayı dener (yalnızca sayı ve evet/hayır yazdırır) |
| `node scripts/font-check.ts [--all-pages] <a.pdf> <b.pdf>` | İki ekstrenin font/glif yapısını karşılaştırır (yalnızca sayı yazdırır) |
| `npm run privacy-check [-- --history [--ref <branch>]]` | Push öncesi gizlilik kontrolü: PDF, `private/blocklist.txt` ifadeleri, uzun rakamlar, mutlak yollar |

## Gizlilik (geliştiriciler için)

- Gerçek ekstreler `private/` klasöründe tutulur; bu klasör ve tüm `*.pdf` dosyaları git dışındadır.
- Test verileri yalnızca sentetik (uydurma) metinlerdir.
- Her push'tan önce `npm run privacy-check` çalıştırılır. Yasaklı ifadeler git dışındaki `private/blocklist.txt` dosyasında tutulur; script eşleşen içeriği asla yazdırmaz.

## Katkı

[CONTRIBUTING.md](CONTRIBUTING.md): yeni banka, Type3 glif etiketleme, kataloğa satıcı ekleme, gizlilik kuralları.

## Lisans

Henüz belirlenmedi.
