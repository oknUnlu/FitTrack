import { Platform, NativeModules } from 'react-native';

function extractCountry(locale: string): string | null {
  if (!locale) return null;
  const parts = locale.replace('-', '_').split('_');
  const region = parts[1] || parts[0];
  if (region && region.length === 2) return region.toUpperCase();
  return null;
}

/**
 * Get the device's country/region code (e.g. "TR", "US", "DE").
 */
export function getDeviceCountry(): string {
  try {
    // Intl API is available in Hermes on all modern RN/Expo versions; most reliable source.
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    const fromIntl = extractCountry(intlLocale);
    if (fromIntl) return fromIntl;

    if (Platform.OS === 'ios') {
      const settings =
        NativeModules.SettingsManager?.settings ||
        NativeModules.Settings?.settings;
      const locale: string =
        settings?.AppleLocale ||
        settings?.AppleLanguages?.[0] ||
        '';
      const fromNative = extractCountry(locale);
      if (fromNative) return fromNative;
    }

    if (Platform.OS === 'android') {
      const locale: string =
        NativeModules.I18nManager?.localeIdentifier || '';
      const fromNative = extractCountry(locale);
      if (fromNative) return fromNative;
    }

    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      const fromNav = extractCountry(navigator.language || '');
      if (fromNav) return fromNav;
    }
  } catch {
    // Fallback
  }
  return 'US';
}

interface CurrencyInfo {
  code: string;   // "TRY", "USD", "EUR"
  symbol: string; // "₺", "$", "€"
  locale: string; // for number formatting: "tr-TR", "en-US"
}

const COUNTRY_CURRENCY: Record<string, CurrencyInfo> = {
  TR: { code: 'TRY', symbol: '₺', locale: 'tr-TR' },
  US: { code: 'USD', symbol: '$', locale: 'en-US' },
  GB: { code: 'GBP', symbol: '£', locale: 'en-GB' },
  DE: { code: 'EUR', symbol: '€', locale: 'de-DE' },
  FR: { code: 'EUR', symbol: '€', locale: 'fr-FR' },
  ES: { code: 'EUR', symbol: '€', locale: 'es-ES' },
  IT: { code: 'EUR', symbol: '€', locale: 'it-IT' },
  PT: { code: 'EUR', symbol: '€', locale: 'pt-PT' },
  NL: { code: 'EUR', symbol: '€', locale: 'nl-NL' },
  AT: { code: 'EUR', symbol: '€', locale: 'de-AT' },
  BE: { code: 'EUR', symbol: '€', locale: 'fr-BE' },
  IE: { code: 'EUR', symbol: '€', locale: 'en-IE' },
  GR: { code: 'EUR', symbol: '€', locale: 'el-GR' },
  FI: { code: 'EUR', symbol: '€', locale: 'fi-FI' },
  JP: { code: 'JPY', symbol: '¥', locale: 'ja-JP' },
  KR: { code: 'KRW', symbol: '₩', locale: 'ko-KR' },
  IN: { code: 'INR', symbol: '₹', locale: 'hi-IN' },
  ID: { code: 'IDR', symbol: 'Rp', locale: 'id-ID' },
  BR: { code: 'BRL', symbol: 'R$', locale: 'pt-BR' },
  SA: { code: 'SAR', symbol: 'ر.س', locale: 'ar-SA' },
  AE: { code: 'AED', symbol: 'د.إ', locale: 'ar-AE' },
  CN: { code: 'CNY', symbol: '¥', locale: 'zh-CN' },
  CA: { code: 'CAD', symbol: 'CA$', locale: 'en-CA' },
  AU: { code: 'AUD', symbol: 'A$', locale: 'en-AU' },
  MX: { code: 'MXN', symbol: 'MX$', locale: 'es-MX' },
};

const DEFAULT_CURRENCY: CurrencyInfo = { code: 'USD', symbol: '$', locale: 'en-US' };

/**
 * Get currency info based on device country.
 */
export function getDeviceCurrency(): CurrencyInfo {
  const country = getDeviceCountry();
  return COUNTRY_CURRENCY[country] || DEFAULT_CURRENCY;
}

/**
 * Format a price number according to a specific currency.
 */
export function formatPrice(amount: number, currencyOverride?: CurrencyInfo): string {
  const { code, locale } = currencyOverride || getDeviceCurrency();
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: code === 'JPY' || code === 'KRW' ? 0 : 2,
      maximumFractionDigits: code === 'JPY' || code === 'KRW' ? 0 : 2,
    }).format(amount);
  } catch {
    const { symbol } = currencyOverride || getDeviceCurrency();
    return `${symbol}${amount.toFixed(2)}`;
  }
}

// ── Country-specific pricing (fallback when RevenueCat is not configured) ──
// When RevenueCat is active, App Store / Play Store return localized prices.
// These are only shown in dev/mock mode or before offerings load.

interface PlanPrices {
  monthly: number;
  quarterly: number;
  yearly: number;
}

// Prices in local currency amounts — researched per market
const COUNTRY_PRICES: Record<string, PlanPrices> = {
  // Türkiye
  TR: { monthly: 59.99, quarterly: 139.99, yearly: 299.99 },
  // Japonya — pazar araştırmasına dayalı (FiNC ~¥960/ay, Apple Fitness+ ~¥1500/ay)
  JP: { monthly: 780, quarterly: 1800, yearly: 4800 },
  // Güney Kore
  KR: { monthly: 6900, quarterly: 15900, yearly: 34900 },
  // Hindistan
  IN: { monthly: 399, quarterly: 899, yearly: 1999 },
  // Endonezya
  ID: { monthly: 79000, quarterly: 179000, yearly: 399000 },
  // Brezilya
  BR: { monthly: 24.90, quarterly: 56.90, yearly: 124.90 },
  // Avro bölgesi (DE, FR, ES, IT, PT, NL, AT, BE, IE, GR, FI)
  EUR: { monthly: 4.99, quarterly: 11.24, yearly: 24.99 },
  // İngiltere
  GB: { monthly: 3.99, quarterly: 8.99, yearly: 19.99 },
  // Kanada
  CA: { monthly: 6.49, quarterly: 14.99, yearly: 32.99 },
  // Avustralya
  AU: { monthly: 7.49, quarterly: 16.99, yearly: 37.99 },
  // Meksika
  MX: { monthly: 89, quarterly: 199, yearly: 449 },
  // Suudi Arabistan & BAE
  SA: { monthly: 18.99, quarterly: 42.99, yearly: 94.99 },
  AE: { monthly: 18.99, quarterly: 42.99, yearly: 94.99 },
};

// Euro bölgesi ülkelerini EUR fiyatlarına yönlendir
const EURO_COUNTRIES = ['DE', 'FR', 'ES', 'IT', 'PT', 'NL', 'AT', 'BE', 'IE', 'GR', 'FI'];

// USD varsayılan fiyatlar
const DEFAULT_PRICES: PlanPrices = { monthly: 4.99, quarterly: 11.24, yearly: 24.99 };

function getPricesForCountry(country: string): PlanPrices {
  if (COUNTRY_PRICES[country]) return COUNTRY_PRICES[country];
  if (EURO_COUNTRIES.includes(country)) return COUNTRY_PRICES.EUR;
  return DEFAULT_PRICES;
}

export interface LocalizedPrices {
  monthly: string;
  quarterly: string;
  yearly: string;
}

/**
 * Get formatted prices based on device country.
 * Returns localized price strings ready for display.
 */
export function getLocalizedPrices(): LocalizedPrices {
  const country = getDeviceCountry();
  const currency = COUNTRY_CURRENCY[country] || DEFAULT_CURRENCY;
  const prices = getPricesForCountry(country);

  return {
    monthly: formatPrice(prices.monthly, currency),
    quarterly: formatPrice(prices.quarterly, currency),
    yearly: formatPrice(prices.yearly, currency),
  };
}
