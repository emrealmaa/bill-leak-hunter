# Sızıntı Avcısı — Yol Haritası ve Çalışma Planı

> Bu dosya Claude Code için adım adım çalışma planıdır. **PROJE.md ile birlikte okunur.** İkisi çelişirse önce sor.
> Repo: https://github.com/emrealmaa/bill-leak-hunter (public)
> Son güncelleme: 26.11.2026

---

## 0. Nasıl kullanılır

- Aşamalar **sırayla** yapılır. Bir aşama bitmeden sonrakine geçilmez.
- Her aşamanın başında **kısa bir plan yaz, onay al, sonra kodla** (PROJE.md §14).
- 👤 işaretli adımları **Emre yapar**. Claude Code o adımda bekler, kendisi yapmaz.
- Her aşama **"Aşama sonu kontrol listesi"** (§3) ile biter: test → build → gizlilik kontrolü → commit → push → PR.
- Bir aşama birden fazla anlamlı parçadan oluşuyorsa her parça ayrı commit olabilir. Push en geç aşama sonunda yapılır.
- Bir aşamada beklenmedik bir şey çıkarsa (format farklı, veri tutmuyor vb.) **dur ve sor.** Tahminle ilerleme.

---

## 1. Alınan kararlar (26.11.2026)

1. **Konumlandırma:** Çekirdek Türkiye odaklı kalır. "Global abonelik bulucu" pazarı kalabalık (Drop Subs, ClearCharge, SaveCatcher, fin, FinDu…). Bizim farkımız Türk bankaları, Türk ödeme aracıları (`IYZICO*`, `PAYTR*` …) ve Türk ücret/vergi kalemleri (KKDF, BSMV, kart aidatı …).
2. **Dünyaya açık mimari:** Başka ülkelerden katkıcılar kendi bankasını (BankParser) ve satıcısını (katalog) ekleyebilmeli. Ülkeye özel hiçbir şey çekirdek koda gömülmez.
3. **Dil:** README İngilizce + Türkçe. Arayüz Türkçe başlar, basit bir sözlükle İngilizce eklenebilir halde yazılır.
4. **Akbank (Axess) ekstresi:** PDF'teki fontlar Type3 ve Unicode eşlemesi yok. Metin, **glif şekil hash'i → karakter** tablosuyla çözülür. Tablo satır satır etiketleme aracıyla doldurulur. Tabloda yalnızca `hash → karakter` vardır, kişisel veri yoktur.
5. **İleride:** "Type3 fontlu, kopyalanamayan PDF'lerden metin çıkarma" kısmı ayrı küçük bir kütüphane olarak yayınlanabilir (MVP sonrası).
6. **Git akışı değişti:** Önceki plan "her şey lokalde, en sonda tek squash commit" idi. Yeni plan: **Aşama 0'da mevcut geçmiş tek commit'e indirilip doğrudan `main`'e push edilir.** Aşama 1'den itibaren her aşama kendi branch'inde yapılır, push edilir ve PR ile birleştirilir (§3.3). Repo public olduğu için branch push'ları da herkese açıktır; bu yüzden **her push öncesi** gizlilik kontrolü zorunludur (§3.2).

---

## 2. Değişmez kurallar (hatırlatma)

- PROJE.md §10 pazarlık konusu değildir.
- Gerçek ekstre içeriği **hiçbir zaman** koda, teste, fixture'a, commit mesajına, issue'ya ya da konsol çıktısına girmez. Teşhis gerekiyorsa **yalnızca sayı** yazdır.
- Bozuk (çözülmemiş) PDF metni de kişisel veri sayılır. Tutarlı bir şifre gibidir ve çözülebilir.
- Dosyalar yalnızca Edit/Write araçlarıyla düzenlenir. PowerShell ile dosya içeriği değiştirilmez (CLAUDE.md).
- Commit mesajları `git commit -F <dosya>` ile verilir. Geçici mesaj dosyası repo dışında tutulur.
- Mutlak dosya yolu (örneğin `<sürücü>:\Users\...`) koda, dokümana ya da commit'e girmez. Her zaman göreli yol kullanılır.
- `force push` yasaktır, istisnası yoktur (Aşama 0 dahil).
- Katalogda emin olunmayan kayıt `verified: false` olur. Uydurma yok.

---

## 3. Aşama sonu kontrol listesi (her aşamada aynen uygulanır)

### 3.1 Test ve build
```powershell
npm test
npm run build
```
İkisi de geçmeden commit atılmaz.

### 3.2 Gizlilik kontrolü (her push öncesi zorunlu)

`private/blocklist.txt` dosyasını **Emre** doldurur (👤). İçinde her satırda bir yasaklı ifade olur: ad, soyad, il/ilçe/mahalle/sokak, kart son 4 hanesi, müşteri numarası, Windows kullanıcı adı, telefon, e-posta. `#` ile başlayan satırlar ve boş satırlar açıklama sayılır. Dosya `private/` altında olduğu için git'e girmez. **Claude Code bu dosyanın içeriğini ekrana yazdırmaz.**

```powershell
npm run privacy-check                # her push öncesi
npm run privacy-check -- --history   # tüm git geçmişi + commit mesajları (Aşama 0'da zorunlu)
npm run privacy-check -- --history --ref main   # geçmişi sadece bir branch için tara
```

Script şu dört kontrolü yapar. Takip edilen dosyalara ek olarak git'e eklenmeye aday dosyalara da bakar (takip edilmeyen ama ignore edilmeyen dosyalar).

| # | Kontrol | Sonuç |
|---|---|---|
| 1 | `.pdf` ya da `private/` altında dosya | sorun |
| 2 | Blocklist ifadeleri (sabit metin, büyük/küçük harf ve `İ/i/I/ı` farkı yok sayılır; sadece rakamdan oluşan ifadeler rakam sınırıyla eşleşir). Dosya yolları da taranır | sorun |
| 3 | 10+ haneli rakam dizisi (`package-lock.json` ve `src/banks/akbank/glyphs.json` hariç) | uyarı |
| 4 | Mutlak Windows kullanıcı yolu (`<sürücü>:\Users\`) | sorun |

- Blocklist yoksa, boşsa ya da 3 karakterden kısa satır varsa script hata verir. Push yapılmaz.
- 1, 2 ya da 4'te sorun varsa exit code 1 olur. **Push yapılmaz**, Emre'ye haber verilir.
- 3'teki her satır için "neden kişisel veri değil" kısaca açıklanır (örneğin test verisi, hash). Emin değilsen sor.
- Script eşleşen içeriği ve blocklist ifadelerini **asla** yazdırmaz. Sadece dosya yolu, kısa commit hash'i, satır numarası ve sayı yazar. Yolun kendisi yasaklı ifade içeriyorsa `<gizli yol N>` olarak gösterilir. git'in hata çıktısı basılmaz.
- Emre'ye özet verilirken de eşleşen içerik yazılmaz.

### 3.3 Branch, commit, push ve PR

Aşama 0 hariç her aşama ayrı bir branch'te yapılır. **`main`'e doğrudan commit ya da push yapılmaz.**

```powershell
git checkout main
git pull
git checkout -b asama-N-kisa-ad           # örnek: asama-1-etiketleme-dogrulama

git add <değişen dosyalar>                 # "git add -A" yerine dosyaları tek tek ekle
git commit -F <repo-dışı-mesaj-dosyası>

npm run privacy-check                      # her push öncesi, temiz değilse push yok
git push -u origin asama-N-kisa-ad

gh pr create --base main --title "<tür: kısa açıklama>" --body-file <repo-dışı-açıklama-dosyası>
```
- Commit mesajı formatı: `tür: kısa açıklama` (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`).
- PR açıklaması: **ne değişti**, **neden**, **nasıl test edildi** (test sayısı, gizlilik kontrolü sonucu).
- `gh` CLI kullanılamıyorsa PR, push çıktısındaki linkten ya da `https://github.com/emrealmaa/bill-leak-hunter/compare/main...asama-N-kisa-ad` adresinden açılır. Claude Code linki Emre'ye verir.
- 👤 **PR'ı Emre GitHub'da squash merge ile birleştirir.** Claude Code merge etmez.
- Merge sonrası: `git checkout main` ve `git pull`.
- Push başarısız olursa (reddedildi, çakışma vb.) **zorlama, dur ve sor.**

### 3.4 Rapor
Aşama sonunda Emre'ye kısa rapor: ne yapıldı, test sayısı, gizlilik kontrolü sonucu ("temiz" ya da sorun), commit hash'leri, push durumu, PR linki, varsa bilinmesi gerekenler.

---

## 4. Aşamalar

### Aşama 0 — Repo hazırlığı ve ilk push

**Amaç:** Mevcut lokal geçmişi temizleyip tek commit olarak public repoya göndermek. Bundan sonra branch + PR akışına geçmek.

1. 👤 Emre `private/blocklist.txt` şablonunu doldurur (UTF-8, her satırda bir ifade).
2. **Tüm geçmişte** gizlilik taraması yap (sadece son haline değil):
   ```powershell
   npm run privacy-check -- --history
   ```
   Sorun çıkmamalı. Sonucu yalnızca "temiz" ya da "N eşleşme, şu commit'lerde" olarak raporla, içerik yazma.
3. Uzak repoyu kontrol et:
   ```powershell
   git ls-remote https://github.com/emrealmaa/bill-leak-hunter
   ```
   - Uzak repo **boşsa** devam et.
   - Uzak repoda commit **varsa** (GitHub'ın otomatik README/LICENSE'ı gibi) **dur ve sor.** Üzerine yazılmayacak.
4. Bu dosyayı `docs/YOL_HARITASI.md` olarak repoya ekle. PROJE.md'yi §1'deki kararlara göre güncelle:
   - §4 hedef kitleye "başka ülkelerden katkıcılar" eklenir.
   - §5'e "README İngilizce + Türkçe" eklenir.
   - §11'e "Ayrıntılı plan: docs/YOL_HARITASI.md" notu düşülür.
   Bu değişiklikleri ayrı bir commit olarak at.
5. Mevcut geçmişin yedeğini **lokalde** tut (asla push etme):
   ```powershell
   git branch yedek-lokal-gecmis
   ```
6. Geçmişi tek commit'e indir. Dosyalar `git add -A` ile değil, eski `main`'de takip edilen dosya listesiyle tek tek eklenir:
   ```powershell
   git checkout --orphan yeni-main
   # git ls-files ile eski main'deki dosya listesi alınır, dosyalar tek tek eklenir
   git status    # sadece beklenen dosyalar mı? .pdf ya da private/ YOK mu?
   git commit -F <mesaj-dosyası>    # mesaj: "chore: ilk sürüm (iskelet, PDF okuma, Type3 glif altyapısı)"
   git branch -D main
   git branch -m main
   ```
7. Gizlilik kontrolünü çalıştır: `npm run privacy-check -- --history --ref main` (lokal yedek branch taranmasın diye sadece `main`; geçmişte tek commit olmalı).
8. Remote ekle ve push et (normal push, force yok):
   ```powershell
   git remote add origin https://github.com/emrealmaa/bill-leak-hunter.git
   git push -u origin main
   ```
   Kimlik doğrulama gerekirse Emre'ye bırak (👤).
9. Push sonrası GitHub'da repoyu kontrol et: dosya listesinde `private/`, `.pdf` ya da `.env` olmamalı.

**Bitti sayılması için:** GitHub'da tek commit var, gizlilik kontrolü temiz, `yedek-lokal-gecmis` sadece lokalde duruyor.

---

### Aşama 1 — Etiketleme aracının tarayıcıda doğrulanması

**Amaç:** Dünkü düzeltmelerin (glif kutusu, kırpma, ×N kartları) gerçek ekstrede çalıştığını görmek.

1. 👤 Emre `npm run dev` ile sayfayı açar, ekstreyi bırakır, "Etiketleme modu"na geçer.
2. 👤 Kontrol eder:
   - Satır resimleri tam mı (harflerin üstü, `İ`'nin noktası)?
   - Kart sayısı yaklaşık 200 mü?
   - Tekrar eden satırlarda "×N" var mı?
   - Bir satırı etiketleyip kaydedince aynı kartın tüm kopyaları çözülüyor mu?
   - "glyphs.json indir" ve "yükle" çalışıyor mu?
3. Sorun varsa Emre **içerik göstermeden** tarif eder ("kırpıntı yanlış yerde", "sayı hep 1 eksik" gibi). Claude Code düzeltir.
4. Değişiklik olduysa §3'ü uygula (branch + commit + push + PR).

**Bitti sayılması için:** Emre "araç düzgün çalışıyor" der.

---

### Aşama 2 — Glif tablosunun doldurulması

**Amaç:** Akbank ekstresindeki tüm glifleri karakterlere eşlemek.

1. 👤 Emre etiketler. Öncelik sırası:
   1. Rakamlar ve `/ . , ( ) -` (tarih ve tutarlar için)
   2. İşlem açıklamalarındaki büyük harfler
   3. Sabit banka metinleri (başlıklar, etiketler)
   4. Küçük harfler ve Türkçe karakterler
   - Resimde ne görünüyorsa o yazılır: `İ`/`I`/`ı`, `$`, `TL` birebir.
   - Her 10 kartta bir "glyphs.json indir" ile `private/glyphs.json` üzerine kaydedilir.
2. Ara kontrol (Claude Code, sadece sayı yazdırır): Her iki ekstrede çözülmüş metinde kaç `�` kaldı, toplam glifin yüzde kaçı çözüldü?
3. Hedef: Her iki ekstrede `�` oranı **%0**. Olmuyorsa kalan glif sayısını raporla.
4. Tablo denetimi (Claude Code):
   - `private/glyphs.json` formatı tam olarak `{ "hashVersion": N, "glyphs": { "<hash>": "<tek karakter>" } }` mi?
   - Başka hiçbir alan yok mu?
   - Değerler tek karakter mi?
   - Aynı karakter beklenmedik kadar çok hash'e mi eşlenmiş? (Olası yanlış etiket, sadece sayı ver.)
5. 👤 Emre "Çözülmüş metin" sekmesinde iki ekstreyi gözle kontrol eder: tarihler, tutarlar ve satıcı adları doğru mu?
6. Tabloyu repoya al: `private/glyphs.json` → `src/banks/akbank/glyphs.json`.
7. §3'ü uygula. Commit: `feat(akbank): glif çözme tablosu`.

**Bitti sayılması için:** İki ekstre de `�` olmadan, doğru şekilde çözülüyor ve tablo repoda.

---

### Aşama 3 — Ayrıştırıcı altyapısı

**Amaç:** PROJE.md §7'deki `BankParser` düzenini kurmak.

1. `src/banks/types.ts`: `BankParser` arayüzü (§7). Girdi, çözülmüş satırlar olacak şekilde netleştirilir: `PdfPage[]` mi, `DecodedLine[]` mı? Planda öner.
2. `src/banks/registry.ts`: Kayıtlı ayrıştırıcıların listesi. Yeni banka eklemek tek satır olmalı.
3. `src/banks/detect.ts`: Sırayla `detect()` çağırır, eşleşen ilk ayrıştırıcıyı döner. Hiçbiri eşleşmezse "Bu bankayı henüz desteklemiyoruz" hatası.
4. Ortak yardımcılar (`src/banks/common/`):
   - Tarih ayrıştırma (`GG/AA/YYYY`, `GG.AA.YYYY` → ISO)
   - Tutar ayrıştırma (hem `1.234,56` hem `1,234.56`; `(-)` son eki, `-` öneki)
   - Para birimi tanıma
5. Testler: sahte verilerle tarih/tutar ayrıştırma ve detect sırası.
6. §3'ü uygula.

**Bitti sayılması için:** Arayüz ve yardımcılar test edilmiş, henüz hiçbir banka kayıtlı değil.

---

### Aşama 4 — Akbank detect + sentetik fixture

**Amaç:** Akbank ekstresini tanımak ve gerçek veri kullanmadan test edebilmek.

1. `src/banks/akbank/detect`: Çözülmüş metinde bankanın **sabit** ifadeleri aranır (örneğin "Axess", "Hesap Özeti", "Hesap Özeti Detayları"). Kişiye özel hiçbir şeye bakılmaz.
2. **Sentetik fixture:** `tests/fixtures/akbank/` altına gerçek ekstrenin **yapısını** taklit eden ama tamamen uydurma bir metin yaz:
   - Uydurma ad (örneğin "AD SOYAD"), `0000` kart, sahte müşteri no, sahte adres
   - Gerçek formattaki sütunlar ve satır tipleri (aşağıdaki Aşama 5 listesindeki her tip en az bir kez)
   - Tutarlar ve tarihler uydurma
   - **Gerçek ekstreden kopyalanmış tek bir satır bile olmayacak.**
3. 👤 Emre fixture'ı gözden geçirir: yapı gerçeğe benziyor mu, içinde kendisine ait bir şey var mı?
4. Detect testleri: Akbank fixture'ı tanınıyor, rastgele metin tanınmıyor.
5. §3'ü uygula.

---

### Aşama 5 — Akbank parse

**Amaç:** Çözülmüş satırları `Transaction[]`'a çevirmek.

Bilinen format (sabit yapı, kişisel değer yok):
- Sütunlar: İşlem Tarihi | Dönem İçi İşlemler | Borç Tutarı (TL) | Kalan Borç / Taksit | Dönem İçi Chip-para
- Tarih: `GG/AA/YYYY`
- Tutar: İngilizce format (`1,234.56`). Ödeme ve iadelerde `(-)` son eki.
- Yabancı para: açıklamada `(orijinal tutar X $)` gibi bir ek.
- Ödemeler bölümünden sonra kart sahibine göre "… Harcamaları" alt başlığı.
- Üst kısımda özet alanları: Dönem Borcu, Ekstre Dönemi, Hesap Kesim Tarihi vb.

Görevler:
1. Satır tipleri: işlem, ödeme, iade, taksit, ücret/vergi, döviz, başlık/özet (yok sayılır).
2. `kind` belirleme: `(-)` ve ödeme açıklamaları → `payment`/`refund`, taksit bilgisi → `installment` alanı.
3. Dönem bilgisi (`period`) "Ekstre Dönemi"nden.
4. Okunamayan satırlar `warnings`'e (içerik değil, satır numarası ve sebep).
5. Testler: sentetik fixture'daki her satır tipi için beklenen `Transaction`.
6. **Gerçek ekstrede doğrulama (sadece sayı):** `scripts/akbank-check.ts` iki gerçek ekstrede çalışır ve şunları yazdırır:
   - Kaç işlem, kaç uyarı
   - İşlem toplamı "Dönem Borcu" ile tutuyor mu? (evet/hayır ve fark miktarı yok, sadece evet/hayır)
7. 👤 Emre DebugPage'e eklenecek **"Ayrıştırılmış işlemler"** tablosunda iki ekstreyi gözle kontrol eder (PROJE.md Hafta 1 çıkış kriteri).
8. §3'ü uygula.

**Bitti sayılması için:** Gerçek iki ekstredeki tüm işlemler doğru tarih, açıklama ve tutarla çıkıyor.

---

### Aşama 6 — Normalleştirici

PROJE.md §8'e göre:
1. `toLocaleUpperCase("tr-TR")`, `i/İ` ve `ı/I` testleri
2. Fazla boşluk, şehir/ülke ekleri (`ISTANBUL TUR` gibi), referans numaraları temizlenir
3. Ödeme aracısı öneki (`IYZICO*`, `PAYTR*`, `PAY*` …) ayrı alana alınır
4. Testler sahte açıklamalarla
5. §3'ü uygula.

---

### Aşama 7 — Katalog

1. `catalog/schema.json` (§7 `Merchant` ve `FeeRule`)
2. `scripts/validate-catalog.ts` ve `npm run validate-catalog`. Build'e bağlanır.
3. Başlangıç kataloğu (50–100 kayıt), kategori bazlı JSON:
   - Global abonelikler: video, müzik, yazılım, bulut, oyun, yapay zeka araçları
   - Türkiye'ye özel servisler: dijital platformlar, yemek siparişi, operatörler
   - Ödeme aracıları ayrı dosyada
   - Her kayıtta resmi `cancelUrl` (yalnızca emin olunan) ve `verified` alanı
   - Gerçek ekstrede görülen bir satıcı `verified: true` olabilir, ama `sources` alanına **ekstre içeriği yazılmaz**, sadece "proje sahibinin ekstresinde doğrulandı" yazılır.
4. Eşleştirici (`src/catalog/`) ve testleri
5. §3'ü uygula.

---

### Aşama 8 — Ücret ve vergi kuralları

1. `catalog/fees/`: kart aidatı, hesap işletim ücreti, faiz, gecikme faizi, nakit avans ücreti, KKDF, BSMV …
2. Açıklamalar sade ve bilgilendirici. **Hukuki iddia ya da tavsiye yok** (PROJE.md §8).
3. Testler
4. §3'ü uygula.

---

### Aşama 9 — Analiz motoru

PROJE.md §8 kuralları:
1. Katalogda `isSubscription: true` → `high`
2. Farklı aylarda 2+ işlem, ±%15 tutar, 28–35 gün ya da ~1 yıl aralık → `medium`
3. Benzer tutarlı ama düzensiz → `low`, "kontrol et" bölümü
4. Taksitler ayrı ("kalan taksitler")
5. İadeler ve kart borcu ödemeleri hariç
6. Katalogda olmayan satırlar "bilinmiyor", tahmin yok
7. Testler (sentetik veriyle her kural)
8. 👤 Emre iki gerçek ekstrede sonucu kontrol eder: bildiği abonelikler bulunuyor mu, yanlış pozitif var mı? (PROJE.md Hafta 2 çıkış kriteri)
9. §3'ü uygula.

---

### Aşama 10 — Arayüz

1. Karşılama: kısa açıklama, gizlilik vurgusu ("Ekstren cihazından çıkmaz. İnternetini kapatıp da kullanabilirsin."), sürükle-bırak alanı, desteklenen bankalar listesi
2. İşleniyor ekranı
3. Sonuç ekranı (PROJE.md §9): özet kartları, abonelikler, kontrol et, ücretler, kalan taksitler, bilinmeyenler
4. Hata durumları Türkçe ve açık
5. Basit i18n: `src/i18n/tr.ts`, `src/i18n/en.ts`. Metinler koda gömülmez.
6. Mobil uyum
7. DebugPage sadece geliştirme modunda erişilebilir kalır, üretim build'ine girmez.
8. Her ekran ayrı commit. §3'ü uygula.

**Bitti sayılması için:** Teknik bilgisi olmayan biri ekstresini yükleyip sonucu anlayabiliyor (👤 Emre birine denetir).

---

### Aşama 11 — CSV dışa aktarma

1. Sonuçları CSV olarak indir (Blob, ağ isteği yok)
2. Türkçe karakterler için UTF-8 BOM (Excel uyumu)
3. Testler
4. §3'ü uygula.

---

### Aşama 12 — Dokümantasyon ve lisans

1. 👤 **Lisans kararı Emre'nin.** Öneri: MIT. Karar verilmeden LICENSE eklenmez.
2. `README.md` (İngilizce) + `README.tr.md` (Türkçe):
   - Ne yapar, neden güvenli, desteklenen bankalar, ekran görüntüleri (**sentetik veriyle** alınmış)
   - Nasıl çalıştırılır
3. `CONTRIBUTING.md`:
   - Yeni banka nasıl eklenir (BankParser + sentetik fixture)
   - Type3 fontlu bankalar için glif etiketleme rehberi
   - Kataloğa satıcı ekleme
   - Gizlilik kuralları: gerçek ekstre asla paylaşılmaz
4. GitHub issue şablonları: "Bankamı ekle", "Satıcı ekle", "Hata bildir". Her şablonda "ekstre içeriği paylaşmayın" uyarısı.
5. §3'ü uygula.

---

### Aşama 13 — Yayın öncesi denetim

1. "Ağ isteği yok" kontrolü: build sonrası derlenmiş dosyalarda `http://`/`https://` adresleri listelenir, her biri açıklanır.
2. Tarayıcı geliştirici araçlarında Network sekmesi kontrolü (👤 Emre): sayfa yüklendikten sonra hiç istek olmamalı.
3. İçerik Güvenlik Politikası (CSP) meta etiketi: `connect-src 'none'` benzeri, worker ve yerel dosyalara izin verecek şekilde
4. pdf.js paket boyutu: dinamik import ile ilk yüklemeyi küçült
5. §3'ü uygula.

---

### Aşama 14 — Yayın

1. GitHub Pages + GitHub Actions ile otomatik deploy (`.github/workflows/deploy.yml`). Vite `base` ayarı `/bill-leak-hunter/`.
2. 👤 Emre repo ayarlarından Pages'i "GitHub Actions" kaynağına alır.
3. Canlı sitede son kontrol: ekstre yükleme, ağ isteği yok, mobil görünüm.
4. README'ye canlı site linki eklenir.
5. §3'ü uygula.
6. 👤 Paylaşım (Reddit, X) Emre'nin işi.

**Bitti sayılması için:** Site canlıda, repo herkese açık, README'de link var.

---

## 5. MVP sonrası (sıra belli değil)

- Type3 glif çözücüyü ayrı npm paketi olarak yayınlamak
- İkinci banka
- Birden fazla ekstreyi birleştirip aylar arası analiz
- CSV ekstre desteği
- Başka ülkelerden katkıların kolaylaşması için örnek "boş banka şablonu"

---

## 6. Hızlı referans

| Ne | Nerede |
|---|---|
| Gerçek ekstreler | `private/` (git dışı) |
| Glif tablosu (taslak) | `private/glyphs.json` |
| Glif tablosu (repo) | `src/banks/akbank/glyphs.json` |
| Yasaklı ifadeler listesi | `private/blocklist.txt` (git dışı) |
| Gizlilik kontrolü | `npm run privacy-check` (`scripts/privacy-check.ts`) |
| Sentetik fixture'lar | `tests/fixtures/<banka>/` |
| Teşhis scriptleri | `scripts/` (sadece sayı yazdırır) |
| Kurallar | `PROJE.md` §10, §14 ve `CLAUDE.md` |
