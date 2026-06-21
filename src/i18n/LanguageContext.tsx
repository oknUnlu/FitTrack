import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Language, Translations } from './types';
import tr from './locales/tr';
import en from './locales/en';
import es from './locales/es';
import pt from './locales/pt';
import hi from './locales/hi';
import id from './locales/id';
import ja from './locales/ja';
import ko from './locales/ko';
import ro from './locales/ro';

/**
 * Deep-merge an `overrides` object into a `base` object so that any keys
 * missing on `overrides` fall through to the value defined on `base`.
 *
 * Used to layer a partially-translated locale on top of the English base
 * locale: if a string hasn't been translated yet, the user sees the English
 * fallback rather than a hard-coded Turkish placeholder string baked into
 * call sites with `(t as any).foo || 'Türkçe varsayılan'`.
 *
 * Only plain objects are merged recursively; arrays and primitive overrides
 * replace the base value as-is. The function is pure — it never mutates the
 * input arguments.
 */
function deepMerge<T extends Record<string, any>>(base: T, overrides: any): T {
  if (!overrides || typeof overrides !== 'object') return base;
  const result: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const key of Object.keys(overrides)) {
    const baseVal = (base as any)[key];
    const overrideVal = overrides[key];
    const baseIsPlainObject =
      typeof baseVal === 'object' && baseVal !== null && !Array.isArray(baseVal);
    const overrideIsPlainObject =
      typeof overrideVal === 'object' && overrideVal !== null && !Array.isArray(overrideVal);
    if (baseIsPlainObject && overrideIsPlainObject) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else if (overrideVal !== undefined && overrideVal !== null) {
      result[key] = overrideVal;
    }
  }
  return result as T;
}

// English is the universal fallback base for every non-Turkish locale. If a
// translator hasn't filled in a key on, say, the Spanish file yet, the user
// sees the English text instead of a missing/Turkish string.
//
// Turkish is the original locale and is kept as-is — its key set already
// matches English's exactly, so no merge is needed for it.
const translations: Record<Language, Translations> = {
  tr,
  en,
  es: deepMerge(en, es),
  pt: deepMerge(en, pt),
  hi: deepMerge(en, hi),
  id: deepMerge(en, id),
  ja: deepMerge(en, ja),
  ko: deepMerge(en, ko),
  ro: deepMerge(en, ro),
};

interface LanguageContextType {
  t: Translations;
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType>({
  t: tr,
  language: 'tr',
  setLanguage: async () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Language>('tr');

  useEffect(() => {
    AsyncStorage.getItem('fittrack_language').then((saved) => {
      if (saved && saved in translations) setLang(saved as Language);
    });
  }, []);

  const setLanguage = async (lang: Language) => {
    setLang(lang);
    await AsyncStorage.setItem('fittrack_language', lang);
  };

  return (
    <LanguageContext.Provider value={{ t: translations[language], language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
