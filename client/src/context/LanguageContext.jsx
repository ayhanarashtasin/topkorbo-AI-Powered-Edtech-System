import { createContext, useState, useEffect, useCallback } from 'react';

export const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('topkorbo-lang') || 'en';
  });
  const [translations, setTranslations] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const response = await fetch(`/locales/${language}.json`);
        const data = await response.json();
        setTranslations(data);
      } catch (error) {
        console.error('Failed to load translations:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTranslations();
  }, [language]);

  useEffect(() => {
    localStorage.setItem('topkorbo-lang', language);
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  const toggleLanguage = useCallback(() => {
    setLanguage(prev => prev === 'en' ? 'bn' : 'en');
  }, []);

  const t = useCallback((key) => {
    return translations[key] || key;
  }, [translations]);

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t, loading }}>
      {children}
    </LanguageContext.Provider>
  );
}
