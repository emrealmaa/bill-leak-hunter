// Ortak veri modelleri (PROJE.md §7)

// --- PDF katmanı ---

// pdf.js'ten çıkan tek bir metin parçası.
// Koordinatlar PDF birimindedir; y ekseni sayfanın ALTINDAN yukarıya artar.
export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPage {
  pageNumber: number; // 1'den başlar
  width: number;
  height: number;
  items: PdfTextItem[];
}

// --- Ekstre verisi ---

// Ekstreden çıkarılan tek bir işlem satırı
export interface Transaction {
  date: string; // ISO tarih: "2026-10-14"
  rawDescription: string; // ekstrede yazan haliyle
  normalized: string; // normalleştirilmiş hali
  amount: number; // TL cinsinden; harcama pozitif, iade/ödeme negatif
  currency: string; // "TRY", "USD" ...
  originalAmount?: number; // yabancı para işlemlerinde orijinal tutar
  installment?: { current: number; total: number }; // taksit bilgisi varsa
  kind: "purchase" | "refund" | "payment" | "fee" | "tax" | "interest" | "other";
}

// --- Katalog ---

export type MerchantCategory =
  | "video"
  | "music"
  | "gaming"
  | "software"
  | "cloud"
  | "telecom"
  | "fitness"
  | "news"
  | "food-delivery"
  | "transport"
  | "other";

// Katalogdaki bir satıcı kaydı
export interface Merchant {
  id: string; // "netflix"
  name: string; // "Netflix"
  category: MerchantCategory;
  patterns: string[]; // normalleştirilmiş açıklamada aranacak kalıplar (regex)
  isSubscription: boolean; // tipik olarak abonelik mi
  cancelUrl?: string; // resmi iptal / hesap yönetimi sayfası
  cancelNote?: string; // kısa iptal açıklaması
  verified: boolean; // kalıp gerçek bir ekstrede doğrulandı mı
  sources?: string[]; // doğrulama kaynağı (açıklama, issue linki vb.)
}

// Banka ücreti / vergi kalıbı
export interface FeeRule {
  id: string; // "kart-aidati"
  label: string; // "Kart aidatı"
  kind: "fee" | "tax" | "interest";
  patterns: string[];
  explanation: string; // kullanıcıya gösterilecek sade açıklama
}

// --- Analiz ---

export interface RecurringCharge {
  merchant?: Merchant; // katalogda bulunduysa
  label: string; // gösterilecek ad
  occurrences: Transaction[];
  monthlyEstimate: number; // tahmini aylık tutar
  confidence: "high" | "medium" | "low";
  reason: string; // neden tekrarlayan sayıldığı ("katalogda abonelik", "3 ay üst üste" ...)
}

// --- Banka ayrıştırıcısı ---

export interface ParseResult {
  transactions: Transaction[];
  period?: { start: string; end: string };
  warnings: string[]; // okunamayan satırlar vb.
}

// Her banka bu arayüzü uygular.
export interface BankParser {
  id: string; // "ornek-banka"
  displayName: string;
  detect(pages: PdfPage[]): boolean; // bu ekstre bu bankaya mı ait
  parse(pages: PdfPage[]): ParseResult;
}
