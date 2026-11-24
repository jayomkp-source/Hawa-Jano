import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { hi } from './hi';
import type { SupportedLanguage } from '../types';

export const LANGUAGE_STORAGE_KEY = 'airwise_language_v1';

function getInitialLanguage(): SupportedLanguage {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'hi' || saved === 'en') {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return 'en';
}

const initialLng = getInitialLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: initialLng,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLng;
}

i18n.on('languageChanged', (lng) => {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    // ignore
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
});

export default i18n;
