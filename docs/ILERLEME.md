# İlerleme

> Aşama planı: [YOL_HARITASI.md](YOL_HARITASI.md). Bu dosya her aşama sonunda güncellenir.
> Kesinti olursa iş buradan devam eder. Kişisel veri içermez.

## Durum

| Aşama | Durum | Not |
|---|---|---|
| 0 — Repo hazırlığı ve ilk push | ✅ bitti | Tek commit, gizlilik kontrolü temiz, `yedek-lokal-gecmis` sadece lokalde |
| 1 — Etiketleme aracı doğrulama | ⏳ Emre bekleniyor | Tarayıcıda gerçek ekstreyle kontrol |
| 2 — Glif tablosu | ⏳ Emre bekleniyor | Etiketleme; `src/banks/akbank/glyphs.json` doldurulacak |
| 3 — Ayrıştırıcı altyapısı | ✅ bitti | `StatementLine[]` girdisi, detect, tarih/tutar/para birimi yardımcıları |
| 4 — Akbank detect + sentetik fixture | ✅ bitti · ⏳ fixture gözden geçirmesi Emre'de | `tests/fixtures/akbank/ornek-ekstre.txt`; boş glif tablosuyla "karakter tablosu eksik" hatası |
| 5 — Akbank parse | ✅ sentetikle bitti · ⏳ gerçek doğrulama glif tablosunu bekliyor | `npm run akbank-check` iki gerçek ekstrede şu an `missing-glyph-table` diyor (beklenen). DebugPage'de "Ayrıştırılmış işlemler" sekmesi |
| 6 — Normalleştirici | ✅ bitti | `src/normalize/`; ödeme aracıları `catalog/intermediaries.json` |
| 7 — Katalog | ✅ bitti | 81 satıcı, hepsi `verified: false`; `cancelUrl` yalnızca 6 kayıtta (emin olunanlar); `npm run validate-catalog` build'e bağlı |
| 8 — Ücret ve vergi kuralları | ✅ bitti | 15 kural (`catalog/fees/`): ücretler, KKDF/BSMV/damga vergisi, faiz türleri; açıklamalar bilgilendirici |

## Açık sorular

- Sentetik fixture'ın sütun düzeni ve satır tipleri (özellikle "Kalan Borç / Taksit" sütununun içeriği ve yabancı para ekinin yazılışı) gerçek ekstreyi görmeden tahminle yazıldı. Emre yapının gerçeğe benzeyip benzemediğini söylemeli (içerik göstermeden).
