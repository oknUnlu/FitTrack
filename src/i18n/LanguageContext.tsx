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

const translations: Record<Language, Translations> = { tr, en, es, pt, hi, id, ja, ko };

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
