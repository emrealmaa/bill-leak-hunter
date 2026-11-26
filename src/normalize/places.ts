// Açıklamanın SONUNDA duran şehir/ülke eklerini tanımak için (foldKey biçiminde).
// Yalnızca sondan temizlenir; açıklamanın ortasındaki kelimelere dokunulmaz.

export const COUNTRY_SUFFIXES = new Set([
  "TR", "TUR", "TURKEY", "TURKIYE",
  "US", "USA", "GB", "GBR", "UK", "IE", "IRL", "NL", "NLD", "LU", "LUX",
  "DE", "DEU", "FR", "FRA", "SE", "SWE", "SG", "SGP", "CH", "CHE", "CY", "CYP", "AE", "ARE",
]);

// Türkiye'nin 81 ili (ASCII'ye katlanmış) ve abonelik satıcılarının sık görülen şehirleri.
export const CITY_SUFFIXES = new Set([
  "ADANA", "ADIYAMAN", "AFYON", "AFYONKARAHISAR", "AGRI", "AKSARAY", "AMASYA", "ANKARA", "ANTALYA",
  "ARDAHAN", "ARTVIN", "AYDIN", "BALIKESIR", "BARTIN", "BATMAN", "BAYBURT", "BILECIK", "BINGOL",
  "BITLIS", "BOLU", "BURDUR", "BURSA", "CANAKKALE", "CANKIRI", "CORUM", "DENIZLI", "DIYARBAKIR",
  "DUZCE", "EDIRNE", "ELAZIG", "ERZINCAN", "ERZURUM", "ESKISEHIR", "GAZIANTEP", "GIRESUN",
  "GUMUSHANE", "HAKKARI", "HATAY", "IGDIR", "ISPARTA", "ISTANBUL", "IZMIR", "KAHRAMANMARAS",
  "KARABUK", "KARAMAN", "KARS", "KASTAMONU", "KAYSERI", "KILIS", "KIRIKKALE", "KIRKLARELI",
  "KIRSEHIR", "KOCAELI", "KONYA", "KUTAHYA", "MALATYA", "MANISA", "MARDIN", "MERSIN", "MUGLA",
  "MUS", "NEVSEHIR", "NIGDE", "ORDU", "OSMANIYE", "RIZE", "SAKARYA", "SAMSUN", "SANLIURFA", "SIIRT",
  "SINOP", "SIRNAK", "SIVAS", "TEKIRDAG", "TOKAT", "TRABZON", "TUNCELI", "USAK", "VAN", "YALOVA",
  "YOZGAT", "ZONGULDAK",
  "LONDON", "DUBLIN", "AMSTERDAM", "LUXEMBOURG", "LUXEMBURG", "STOCKHOLM", "SINGAPORE", "PARIS",
  "BERLIN", "SEATTLE", "CUPERTINO", "DUBAI", "LIMASSOL", "NICOSIA",
]);

export const TWO_WORD_CITY_SUFFIXES = new Set(["SAN FRANCISCO", "LOS GATOS", "MOUNTAIN VIEW", "NEW YORK", "SAN JOSE"]);
