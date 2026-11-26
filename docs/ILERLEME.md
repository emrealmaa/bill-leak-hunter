# İlerleme

> Aşama planı: [YOL_HARITASI.md](YOL_HARITASI.md). Bu dosya her aşama sonunda güncellenir.
> Kesinti olursa iş buradan devam eder. Kişisel veri içermez.

## Durum

| Aşama | Durum | Not |
|---|---|---|
| 0 — Repo hazırlığı ve ilk push | ✅ bitti | Tek commit, gizlilik kontrolü temiz, `yedek-lokal-gecmis` sadece lokalde |
| 1 — Etiketleme aracı doğrulama | ⏳ Emre bekleniyor | Tarayıcıda gerçek ekstreyle kontrol (`npm run dev`, adres `#debug`) |
| 2 — Glif tablosu | ⏳ Emre bekleniyor | Etiketleme; `src/banks/akbank/glyphs.json` doldurulacak |
| 3 — Ayrıştırıcı altyapısı | ✅ bitti | `StatementLine[]` girdisi, detect, tarih/tutar/para birimi yardımcıları |
| 4 — Akbank detect + sentetik fixture | ✅ bitti · ⏳ fixture gözden geçirmesi Emre'de | `tests/fixtures/akbank/ornek-ekstre.txt`; boş glif tablosuyla "karakter tablosu eksik" hatası |
| 5 — Akbank parse | ✅ sentetikle bitti · ⏳ gerçek doğrulama glif tablosunu bekliyor | `npm run akbank-check` iki gerçek ekstrede şu an `missing-glyph-table` diyor (beklenen). DebugPage'de "Ayrıştırılmış işlemler" sekmesi |
| 6 — Normalleştirici | ✅ bitti | `src/normalize/`; ödeme aracıları `catalog/intermediaries.json` |
| 7 — Katalog | ✅ bitti | 81 satıcı, hepsi `verified: false`; `cancelUrl` yalnızca 6 kayıtta (emin olunanlar); `npm run validate-catalog` build'e bağlı |
| 8 — Ücret ve vergi kuralları | ✅ bitti | 15 kural (`catalog/fees/`): ücretler, KKDF/BSMV/damga vergisi, faiz türleri; açıklamalar bilgilendirici |
| 9 — Analiz motoru | ✅ sentetikle bitti · ⏳ gerçek ekstre kontrolü Emre'de | `src/analysis/`, uçtan uca hat `src/pipeline.ts`. Gerçek kontrol glif tablosunu bekliyor |
| 10 — Arayüz | ✅ bitti · ⏳ "teknik olmayan biri anlıyor mu" denemesi Emre'de | Karşılama, işleniyor, hata, sonuç ekranları; TR/EN; DebugPage yalnızca `npm run dev` + `#debug` |
| 11 — CSV dışa aktarma | ✅ bitti | UTF-8 BOM, TR'de `;` + virgüllü ondalık, formül enjeksiyonuna karşı koruma |
| 12 — Dokümantasyon | ✅ bitti · ⏳ lisans kararı Emre'de | README (EN) + README.tr.md, CONTRIBUTING.md, 3 issue şablonu. LICENSE eklenmedi. Ekran görüntüsü yerine yer tutucu |
| 13 — Yayın öncesi denetim | ✅ otomatik kısım bitti · ⏳ Network sekmesi kontrolü Emre'de | `npm run scan-urls` (0 açıklanmamış adres), CSP (yalnızca build), pdf.js dinamik import |
| 14 — Yayın | ✅ hazırlık bitti · ⏳ Pages'i açmak Emre'de | `.github/workflows/deploy.yml`, Vite `base` `/bill-leak-hunter/` (build + preview). README'lerde canlı adres |

## Emre'nin yapacakları (sırayla)

1. Repo ayarlarında Settings > Pages > Source'u "GitHub Actions" yap, sonra Actions'ta "Deploy to GitHub Pages"i elle bir kez çalıştır.
2. Canlı sitede Network sekmesini kontrol et: sayfa yüklendikten ve sentetik/gerçek PDF bırakıldıktan sonra dışarıya istek olmamalı.
3. `tests/fixtures/akbank/ornek-ekstre.txt` yapısının gerçek ekstreye benzeyip benzemediğini içerik göstermeden söyle.
4. Aşama 1: `npm run dev` → `http://localhost:5173/#debug` → etiketleme aracını gerçek ekstreyle dene.
5. Aşama 2: glifleri etiketle, `private/glyphs.json`'a kaydet; `npm run akbank-check -- --table private/glyphs.json private/<dosya>.pdf` ile çözülmemiş glif sayısını izle.
6. Tablo tamamlanınca DebugPage "Ayrıştırılmış işlemler" sekmesinde iki ekstreyi gözle kontrol et.
7. Gerçek sonuçlarda bildiğin abonelikler bulunuyor mu, yanlış pozitif var mı bak.
8. Teknik bilgisi olmayan birine siteyi dene.
9. Lisansı seç (öneri: MIT).
10. Sentetik veriyle ekran görüntüsü al (README'lerdeki yer tutucu için).

## Açık sorular

- Sentetik fixture'ın sütun düzeni ve satır tipleri (özellikle "Kalan Borç / Taksit" sütununun içeriği ve yabancı para ekinin yazılışı) gerçek ekstreyi görmeden tahminle yazıldı. Glif tablosu bitince `akbank-check` sayıları buna göre ayrıştırıcıda düzeltme gerekip gerekmediğini gösterecek.
- Lisans (öneri: MIT). Karar verilince LICENSE eklenecek ve README'lerdeki "Henüz belirlenmedi" satırı güncellenecek.
- Issue şablonlarındaki `bank-request` ve `catalog` etiketleri repoda yok; GitHub var olmayan etiketi uygulamaz. İstenirse etiketler oluşturulabilir.
- Deploy workflow'u Pages açılana kadar `main`'e her push'ta "deploy" adımında başarısız olacak (beklenen).
