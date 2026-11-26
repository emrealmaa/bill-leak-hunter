// Türkçe arayüz metinleri. Yeni dil eklemek için bu nesnenin biçimini
// (Messages tipi) uygulayan bir dosya yazıp src/i18n/index.ts'e eklemek yeterli.
// {ad} biçimindeki yer tutucular çalışma anında doldurulur.

export const tr = {
  locale: "tr-TR",
  appName: "Sızıntı Avcısı",
  language: { label: "Dil", tr: "Türkçe", en: "English" },
  welcome: {
    tagline: "Kredi kartı ekstreni yükle, her ay farkında olmadan nereye para kaçırdığını gör.",
    bullets: [
      "Abonelikler ve düzenli tekrarlayan ödemeler",
      "Banka ücretleri, vergiler ve faizler",
      "Kalan taksitler ve tanınmayan satırlar",
    ],
    privacyTitle: "Ekstren cihazından çıkmaz.",
    privacyBody:
      "PDF tamamen tarayıcında okunur. Sunucu, hesap, çerez ya da izleme yok. İnternetini kapatıp da kullanabilirsin.",
    dropTitle: "Ekstre PDF'ini buraya sürükle",
    dropHint: "ya da tıklayıp seç",
    supportedBanks: "Desteklenen bankalar",
    notAdvice: "Sonuçlar bilgilendirme amaçlıdır; finansal ya da hukuki tavsiye değildir.",
  },
  processing: { title: "Ekstre okunuyor…", body: "Bu birkaç saniye sürebilir. Veri cihazından çıkmıyor." },
  errors: {
    title: "Ekstre işlenemedi",
    retry: "Başka bir dosya dene",
    "not-pdf": "Lütfen bir PDF dosyası seç.",
    encrypted: "PDF okunamadı (şifreli olabilir).",
    invalid: "Bu dosya geçerli bir PDF gibi görünmüyor.",
    unknown: "PDF okunurken beklenmeyen bir hata oluştu.",
    "unsupported-bank": "Bu bankayı henüz desteklemiyoruz.",
    "missing-glyph-table":
      "Bu ekstrenin karakter tablosu eksik. Bankanın PDF'i kopyalanamayan bir yazı tipi kullanıyor ve bu yazı tipi henüz tanıtılmadı.",
    "no-transactions": "Ekstrede işlem bulunamadı.",
  },
  results: {
    title: "Sonuçlar",
    period: "Dönem: {start} – {end}",
    transactionCount: "{count} işlem",
    newStatement: "Yeni ekstre yükle",
    downloadCsv: "CSV indir",
    warnings: "{count} satır okunamadı; sonuçlar eksik olabilir.",
    unknownGlyphs: "{count} karakter çözülemedi; bazı açıklamalar eksik olabilir.",
    cards: {
      monthlyRecurring: "Aylık tekrarlayan",
      fees: "Ücret, vergi ve faiz",
      unknown: "Tanınmayan satır",
    },
    subscriptions: {
      title: "Abonelikler ve tekrarlayan ödemeler",
      empty: "Bu ekstrede abonelik ya da düzenli tekrarlayan ödeme bulunmadı.",
      name: "Ad",
      category: "Kategori",
      monthly: "Aylık (tahmini)",
      confidence: "Güven",
      cancel: "İptal / yönetim",
      cancelLink: "Hesap sayfası",
      count: "{count} işlem",
    },
    review: {
      title: "Kontrol et",
      intro: "Benzer tutarlarla tekrar eden ama düzenli aralıkla gelmeyen ödemeler. Abonelik olabilirler.",
    },
    fees: {
      title: "Banka ücretleri, vergiler ve faizler",
      empty: "Bu ekstrede ücret, vergi ya da faiz satırı bulunmadı.",
      other: { fee: "Diğer banka ücreti", tax: "Diğer vergi", interest: "Diğer faiz" },
    },
    installments: {
      title: "Kalan taksitler",
      empty: "Taksitli işlem yok.",
      progress: "{current}/{total}. taksit",
      remaining: "Kalan {count} taksit · yaklaşık {amount}",
    },
    unknown: {
      title: "Tanınmayan satırlar",
      intro: "Katalogda olmayan ve tekrar etmeyen harcamalar. Tahmin yürütmüyoruz.",
      contribute: "Bir satıcıyı tanıyorsan kataloğa ekleyebilirsin",
      empty: "Tanınmayan satır yok.",
    },
    known: {
      title: "Diğer tanınan harcamalar",
    },
  },
  confidence: { high: "Yüksek", medium: "Orta", low: "Düşük" },
  reason: {
    "catalog-subscription": "Katalogda abonelik",
    monthly: "Her ay benzer tutar",
    yearly: "Her yıl benzer tutar",
    irregular: "Benzer tutar, düzensiz aralık",
  },
  category: {
    video: "Video",
    music: "Müzik ve sesli kitap",
    gaming: "Oyun",
    software: "Yazılım ve yapay zeka",
    cloud: "Bulut",
    telecom: "Operatör",
    fitness: "Spor",
    news: "Haber ve içerik",
    "food-delivery": "Yemek siparişi",
    transport: "Ulaşım",
    other: "Diğer",
    unknown: "Bilinmiyor",
  },
  csv: {
    fileName: "sizinti-avcisi-sonuclar.csv",
    headers: ["Bölüm", "Tarih", "Açıklama", "Ad", "Kategori", "Tutar (TL)", "Aylık tahmini (TL)", "Güven", "Not"],
    sections: {
      subscription: "Abonelik",
      review: "Kontrol et",
      fee: "Ücret/vergi/faiz",
      installment: "Taksit",
      unknown: "Tanınmayan",
      known: "Tanınan",
    },
  },
  footer: {
    source: "Açık kaynak",
    noTracking: "İzleme yok · çerez yok · sunucu yok",
  },
};

export type Messages = typeof tr;
