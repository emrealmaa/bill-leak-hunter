# Sızıntı Avcısı — Proje Dokümanı

> Kredi kartı / banka ekstreni yükle, her ay farkında olmadan nereye para kaçırdığını gör.
> Ekstren cihazından hiç çıkmaz.

Bu doküman projenin tamamını baştan sona anlatır: ne olduğu, neden yapıldığı, kimin için olduğu, nasıl çalışacağı ve hangi sırayla inşa edileceği. Projede çalışan herkes (insan ya da Claude Code) işe buradan başlamalıdır.

---

## 1. Özet

**Sızıntı Avcısı**, kullanıcının yüklediği kredi kartı veya banka ekstresi PDF'ini **tamamen tarayıcıda** analiz eden, açık kaynaklı bir web uygulamasıdır. Şunları bulur:

- Tekrarlayan ödemeler ve abonelikler (unutulmuş olanlar dahil)
- Ekstrede kimin olduğu anlaşılmayan satıcı adları (ödeme aracısı kodları gibi)
- Bankanın kestiği ücretler ve vergiler (kart aidatı, hesap işletim ücreti, faiz, KKDF, BSMV vb.)

Sonucu sade bir ekranda gösterir: **"Ayda toplam X TL tekrarlayan ödeme yapıyorsun"**, ardından her kalemin listesi, açıklaması ve nasıl iptal edileceği.

Benzetmeyle: su faturan yüksek ama bütün musluklar kapalı. Tesisatçı gelir, "şu borudan damla damla kaçıyor" der. Sızıntı Avcısı, paran için o tesisatçıdır.

---

## 2. Sorun

İnsanların parası küçük küçük ve fark edilmeden gidiyor:

1. **Unutulan abonelikler.** Bir kere denemek için açılıp kapatılmayan dijital platform, müzik, video, oyun ve uygulama üyelikleri.
2. **Anlaşılmayan satıcı adları.** Ekstrede `IYZICO*ABC123`, `PAYTR*XYZ` gibi satırlar görünüyor. Ödeme aracısının arkasındaki asıl şirket belli değil, kullanıcı da sorgulamıyor.
3. **Banka ücretleri.** Kart aidatı, hesap işletim ücreti, gecikme faizi, nakit avans ücreti ve bunların vergileri. Kullanıcı çoğu zaman bunları ödediğini bilmiyor.
4. **Operatör ve katma değerli servisler.** Habersiz açılan SMS/içerik servisleri, fatura üzerinden alınan dijital hizmetler.

Tek tek bakınca rakamlar küçük, ama toplamı ayda yüzlerce lirayı bulabiliyor. Ekstreler uzun ve okunması zor, bu yüzden kimse satır satır incelemiyor.

### Neden genel yapay zeka asistanları yetmiyor?
- Türkiye'deki ödeme aracısı adlarını ve satıcı kodlarını tutarlı biçimde çözemiyorlar.
- Türk bankalarının ücret kalemlerini ve ekstre formatlarını sistematik olarak tanımıyorlar.
- Kullanıcıların çoğu banka ekstresini bir yapay zeka servisine yüklemek istemiyor (gizlilik kaygısı).

---

## 3. Çözüm

### Kullanıcı akışı
1. Kullanıcı siteye girer.
2. Ekstre PDF'ini sürükleyip bırakır (veya seçer).
3. Site, ekstrenin hangi bankaya ait olduğunu otomatik tanır.
4. Birkaç saniye içinde analiz ekranı açılır:
   - **Büyük özet kartı:** "Ayda tahmini X TL tekrarlayan ödeme" ve "Bu ekstrede Y TL banka ücreti/vergisi"
   - **Abonelikler listesi:** ad, kategori, aylık tutar, ilk görüldüğü tarih, "nasıl iptal edilir" bağlantısı
   - **Anlaşılmayan satırlar:** katalogda bulunanlar açıklamasıyla gösterilir, bulunamayanlar "bilinmiyor" diye işaretlenir
   - **Banka ücretleri bölümü:** kalem kalem ücretler ve vergiler
5. Kullanıcı isterse sonucu indirebilir (CSV) veya ekran görüntüsü alıp paylaşabilir.

### Temel ilke: veri cihazdan çıkmaz
- PDF **kullanıcının tarayıcısında** okunur ve işlenir.
- **Sunucu yoktur. Veritabanı yoktur. Analitik/izleme scripti yoktur.**
- Uygulama, sayfa yüklendikten sonra hiçbir ağ isteği yapmadan çalışabilmelidir.
- Bu sayede güven sorunu çözülür, KVKK yükünün büyük kısmı ortadan kalkar ve işletme maliyeti sıfıra yakın olur.
- Arayüzde bu açıkça yazılır: *"Ekstren cihazından çıkmaz. İnternetini kapatıp da kullanabilirsin."*

---

## 4. Hedef kitle

- **Ana kitle:** Türkiye'de kredi kartı kullanan, birden fazla dijital aboneliği olan 20–40 yaş arası kullanıcılar.
- **Öğrenciler ve yeni çalışanlar:** Bütçesi kısıtlı olduğu için her kalemi önemseyenler.
- **Aile bütçesini yönetenler:** Ailesinin ekstresine bakıp "bu ne?" diye soranlar.
- **Katkıcılar:** Kataloğa yeni satıcı ve banka ekleyen geliştiriciler ve meraklılar.
- **Başka ülkelerden katkıcılar:** Kendi bankasının ayrıştırıcısını (`BankParser`) ve kendi ülkesinin satıcılarını (katalog) ekleyenler. Çekirdek Türkiye odaklıdır, ama ülkeye özel hiçbir şey çekirdek koda gömülmez.

---

## 5. Kapsam

### MVP (ilk sürüm) içinde
- Tek banka desteği (ilk banka proje sahibi tarafından belirlenecek, bkz. §11)
- PDF ekstre yükleme ve tarayıcıda okuma
- İşlem satırlarını ayıklama (tarih, açıklama, tutar, para birimi)
- Satıcı adı normalleştirme ve katalog eşleştirme
- Tekrarlayan ödeme tespiti
- Banka ücreti ve vergi tespiti
- Sonuç ekranı ve CSV dışa aktarma
- 50–100 kayıtlık başlangıç satıcı kataloğu
- Türkçe arayüz (metinler basit bir sözlükle İngilizce eklenebilir halde yazılır)
- README İngilizce + Türkçe

### MVP dışında (ilgi olursa sonra)
- Diğer bankalar
- Birden fazla ekstreyi birleştirip aylar arası analiz
- Excel/CSV ekstre desteği
- Mobil uygulama
- Kullanıcı hesabı, bulut senkronizasyonu (ilkeye aykırı, muhtemelen hiç yapılmayacak)
- Yapay zeka destekli açıklama (yapılırsa isteğe bağlı ve açık onaylı olmalı)

---

## 6. Teknik mimari

### Teknoloji yığını
| Katman | Seçim | Neden |
|---|---|---|
| Dil | TypeScript | Tip güvenliği, veri modelinin net olması |
| Arayüz | React + Vite | Hızlı, statik derlenebilir |
| Stil | Tailwind CSS | Hızlı ve tutarlı tasarım |
| PDF okuma | pdf.js (`pdfjs-dist`) | Tarayıcıda çalışır, sunucu gerektirmez |
| Test | Vitest | Vite ile doğal uyum |
| Yayın | Vercel veya GitHub Pages | Ücretsiz statik hosting |

### Ana parçalar

```
PDF dosyası
   │
   ▼
[1] PDF Okuyucu ──────────── pdf.js ile sayfaları metin + konum olarak çıkarır
   │
   ▼
[2] Banka Tanıyıcı ───────── Metindeki ipuçlarından bankayı belirler
   │
   ▼
[3] Banka Ayrıştırıcısı ──── O bankanın formatına göre satırları Transaction[]'a çevirir
   │
   ▼
[4] Normalleştirici ──────── Açıklamaları temizler (büyük/küçük harf, Türkçe karakter, kodlar)
   │
   ▼
[5] Katalog Eşleştirici ──── Normalleştirilmiş açıklamayı satıcı kataloğuyla eşleştirir
   │
   ▼
[6] Analiz Motoru ────────── Tekrarlayanları, abonelikleri, ücretleri bulur
   │
   ▼
[7] Sonuç Ekranı
```

### Önerilen klasör yapısı

```
sizinti-avcisi/
├── PROJE.md                  # bu doküman
├── README.md                 # kullanıcıya yönelik tanıtım
├── CONTRIBUTING.md           # kataloğa / bankaya nasıl katkı yapılır
├── catalog/
│   ├── merchants/            # satıcı kayıtları (kategori bazlı JSON dosyaları)
│   ├── fees/                 # banka ücret/vergi kalıpları
│   └── schema.json           # katalog JSON şeması
├── src/
│   ├── pdf/                  # [1] PDF okuma
│   ├── banks/
│   │   ├── detect.ts         # [2] banka tanıma
│   │   ├── types.ts          # BankParser arayüzü
│   │   └── <banka-adi>/      # [3] her banka için ayrıştırıcı
│   ├── normalize/            # [4]
│   ├── catalog/              # [5] katalog yükleme ve eşleştirme
│   ├── analysis/             # [6] tekrar, abonelik, ücret tespiti
│   ├── ui/                   # [7] React bileşenleri
│   └── types.ts              # ortak veri modelleri
├── tests/
│   └── fixtures/             # ANONİMLEŞTİRİLMİŞ örnek ekstre metinleri
└── scripts/
    └── validate-catalog.ts   # katalog dosyalarını şemaya göre doğrular
```

---

## 7. Veri modeli

```ts
// Ekstreden çıkarılan tek bir işlem satırı
interface Transaction {
  date: string;            // ISO tarih: "2026-10-14"
  rawDescription: string;  // ekstrede yazan haliyle
  normalized: string;      // normalleştirilmiş hali
  amount: number;          // TL cinsinden; harcama pozitif, iade/ödeme negatif
  currency: string;        // "TRY", "USD" ...
  originalAmount?: number; // yabancı para işlemlerinde orijinal tutar
  installment?: { current: number; total: number }; // taksit bilgisi varsa
  kind: "purchase" | "refund" | "payment" | "fee" | "tax" | "interest" | "other";
}

// Katalogdaki bir satıcı kaydı
interface Merchant {
  id: string;               // "netflix"
  name: string;             // "Netflix"
  category: "video" | "music" | "gaming" | "software" | "cloud" | "telecom"
          | "fitness" | "news" | "food-delivery" | "transport" | "other";
  patterns: string[];       // normalleştirilmiş açıklamada aranacak kalıplar (regex)
  isSubscription: boolean;  // tipik olarak abonelik mi
  cancelUrl?: string;       // resmi iptal / hesap yönetimi sayfası
  cancelNote?: string;      // kısa iptal açıklaması
  verified: boolean;        // kalıp gerçek bir ekstrede doğrulandı mı
  sources?: string[];       // doğrulama kaynağı (açıklama, issue linki vb.)
}

// Banka ücreti / vergi kalıbı
interface FeeRule {
  id: string;               // "kart-aidati"
  label: string;            // "Kart aidatı"
  kind: "fee" | "tax" | "interest";
  patterns: string[];
  explanation: string;      // kullanıcıya gösterilecek sade açıklama
}

// Analiz sonucu
interface RecurringCharge {
  merchant?: Merchant;      // katalogda bulunduysa
  label: string;            // gösterilecek ad
  occurrences: Transaction[];
  monthlyEstimate: number;  // tahmini aylık tutar
  confidence: "high" | "medium" | "low";
  reason: string;           // neden tekrarlayan sayıldığı ("katalogda abonelik", "3 ay üst üste" ...)
}
```

### Ayrıştırıcı arayüzü

Her banka tek bir arayüzü uygular. Yeni banka eklemek = yeni bir klasör + bu arayüz + test fixture'ı.

```ts
interface BankParser {
  id: string;                          // "ornek-banka"
  displayName: string;
  detect(pages: PdfPage[]): boolean;   // bu ekstre bu bankaya mı ait
  parse(pages: PdfPage[]): {
    transactions: Transaction[];
    period?: { start: string; end: string };
    warnings: string[];                // okunamayan satırlar vb.
  };
}
```

---

## 8. Analiz kuralları

### Normalleştirme
- Türkçe-duyarlı büyük harfe çevirme (`toLocaleUpperCase("tr-TR")`); `i/İ` ve `ı/I` hatalarına dikkat edilmeli
- Fazla boşlukları, şehir/ülke eklerini, işlem referans numaralarını temizleme
- Ödeme aracısı önekini (`IYZICO*`, `PAYTR*` vb.) ayrı bir alan olarak koruma; aracı bilgisi kendi başına anlamlıdır

### Tekrarlayan ödeme tespiti
Bir satıcı şu durumlarda "tekrarlayan" sayılır:
1. **Katalogda `isSubscription: true` ise:** tek bir işlem bile yeterlidir → `confidence: high`
2. **Aynı normalleştirilmiş satıcıdan farklı aylarda 2 veya daha fazla işlem varsa,** tutarlar birbirine ±%15 yakınsa ve aralık yaklaşık 28–35 gün (aylık) ya da yaklaşık 1 yıl (yıllık) ise → `confidence: medium`
3. **Benzer tutarlı ama düzensiz aralıklı işlemler** → `confidence: low`; ayrı bir "kontrol et" bölümünde gösterilir

Taksitli alışverişler abonelik **değildir**, ayrı gösterilir ("kalan taksitler").
İadeler ve kart borcu ödemeleri analizden çıkarılır.

### Ücret ve vergi tespiti
`catalog/fees/` içindeki kurallarla eşleşen satırlar ücret bölümünde toplanır. Açıklamalar bilgilendirici olmalıdır. **Hukuki iddia veya tavsiye içermemelidir** ("bu ücreti geri alabilirsin" gibi ifadeler kullanılmaz).

### Emin olunmayan durumlar
Katalogda bulunamayan satırlar için **tahmin yürütülmez**. "Bilinmiyor" olarak gösterilir ve kullanıcıya kataloğa katkı yapması için bir yol sunulur.

---

## 9. Arayüz

Tek sayfalık, sade, mobil uyumlu bir arayüz.

1. **Karşılama:** Kısa açıklama, gizlilik vurgusu, büyük bir sürükle-bırak alanı. Desteklenen bankaların listesi.
2. **İşleniyor:** Kısa bir yükleme göstergesi.
3. **Sonuç:**
   - Üstte 2–3 büyük özet kartı (aylık tekrarlayan toplam, ücret/vergi toplamı, bilinmeyen satır sayısı)
   - Abonelikler tablosu (ad, kategori, aylık tutar, güven seviyesi, iptal bağlantısı)
   - "Kontrol et" bölümü (düşük güvenli olanlar)
   - Banka ücretleri bölümü
   - Kalan taksitler bölümü
   - Bilinmeyen satırlar bölümü
   - CSV indir butonu, "Yeni ekstre yükle" butonu
4. **Bilgi sayfası:** Nasıl çalışır, gizlilik, katkı yapma.

Hata durumları açık ve Türkçe olmalıdır: "Bu bankayı henüz desteklemiyoruz", "PDF okunamadı (şifreli olabilir)" gibi.

---

## 10. Gizlilik ve güvenlik kuralları (zorunlu)

- **Gerçek ekstreler hiçbir zaman repoya commit edilmez.** `.gitignore` içinde `*.pdf` ve `private/` klasörü baştan engellenir.
- Test fixture'ları **anonimleştirilmiş metinlerdir:** ad, kart numarası, adres, TC kimlik numarası, müşteri numarası silinir veya sahte değerlerle değiştirilir.
- Uygulama çalışırken hiçbir harici ağ isteği yapılmaz (font ve script dahil her şey uygulamayla birlikte gelir).
- Analitik, çerez veya izleme scripti eklenmez.
- `localStorage`'a işlem verisi yazılmaz. Sayfa kapanınca veri kaybolur.
- Şifreli PDF'ler için şifre istenirse, şifre yalnızca bellekte tutulur.

---

## 11. Yol haritası (4 hafta)

> Ayrıntılı plan: [docs/YOL_HARITASI.md](docs/YOL_HARITASI.md)

### Hafta 1: Okuma ve ayrıştırma
- Proje iskeleti (Vite + React + TS + Tailwind + Vitest)
- pdf.js ile PDF'ten sayfa metni ve konum bilgisi çıkarma
- İlk banka için `detect` ve `parse`
- Anonimleştirilmiş fixture ile ayrıştırıcı testleri
- **Çıkış kriteri:** Proje sahibinin gerçek ekstresindeki tüm işlem satırları doğru tarih, açıklama ve tutarla çıkıyor.

### Hafta 2: Katalog ve analiz
- Katalog şeması, doğrulama scripti
- 50–100 satıcılık başlangıç kataloğu ve temel ücret kuralları
- Normalleştirici ve eşleştirici
- Tekrarlayan ödeme ve ücret tespiti, testleriyle birlikte
- **Çıkış kriteri:** Gerçek ekstrede bilinen aboneliklerin hepsi doğru bulunuyor, yanlış pozitif yok veya çok az.

### Hafta 3: Arayüz
- Karşılama, yükleme ve sonuç ekranları
- CSV dışa aktarma
- Hata durumları
- **Çıkış kriteri:** Teknik bilgisi olmayan biri ekstresini yükleyip sonucu anlayabiliyor.

### Hafta 4: Yayın
- README (ekran görüntüleriyle), CONTRIBUTING (banka/satıcı ekleme rehberi)
- "Ağ isteği yok" kontrolü (tarayıcının geliştirici araçlarıyla doğrulama)
- Vercel veya GitHub Pages'te yayın
- Paylaşım: Reddit ve X
- **Çıkış kriteri:** Site canlıda, repo herkese açık.

---

## 12. Başarı ölçütleri

- Proje sahibi kendi ekstresinde **daha önce farkında olmadığı** en az bir kalem buluyor.
- Paylaşımdan sonra "benim bankamı da ekle" talepleri geliyor.
- Dışarıdan en az bir kişi kataloğa veya bir bankaya katkı yapıyor.

---

## 13. Riskler

| Risk | Önlem |
|---|---|
| Banka ekstre formatını değiştirir | Ayrıştırıcı testleri bozulunca hemen fark edilir; ayrıştırıcılar küçük ve bağımsız |
| Katalog yanlış eşleştirir | `verified` alanı, düşük güvenli sonuçların ayrı gösterilmesi, tahmin yürütmeme kuralı |
| Hukuki/finansal tavsiye gibi algılanma | Açıklamalar bilgilendirici; "tavsiye değildir" notu |
| Gizlilik ihlali algısı | Sunucusuz mimari, açık kaynak kod, ağ isteği yapılmaması |
| Kapsam büyümesi | MVP listesi dışındaki her şey 4. haftadan sonraya |

---

## 14. Claude Code için çalışma kuralları

- Bu dokümandaki ilkeler (özellikle §10) pazarlık konusu değildir.
- Her aşamaya başlamadan önce kısa bir plan yaz, onay al, sonra kodla.
- Ayrıştırıcı ve analiz kodunu **test önce** yaz: önce fixture ve beklenen çıktı, sonra kod.
- Gerçek ekstre içeriğini koda, teste veya commit mesajına asla koyma. Örnek gerekiyorsa sahte veri üret.
- Katalog kayıtlarında emin olmadığın bir eşleştirmeyi `verified: false` olarak işaretle, uydurma.
- Küçük ve anlamlı commit'ler at.
- Bir karar bu dokümanla çelişiyorsa önce sor.
