'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from './LanguageContext';
import { locales, Locale } from './index';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (newLocale: Locale) => {
    setLocale(newLocale);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <motion.button
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        whileTap={{ scale: 0.95 }}
      >
        <span className="text-lg">{locales[locale].flag}</span>
        <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
          {locale.toUpperCase()}
        </span>
        <motion.span
          className="text-surface-400"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          ▼
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown */}
            <motion.div
              className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-surface-800 shadow-lg border border-surface-200 dark:border-surface-700 overflow-hidden z-50"
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              {Object.entries(locales).map(([key, config]) => (
                <motion.button
                  key={key}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    locale === key
                      ? 'bg-kiwi-50 dark:bg-kiwi-900/30 text-kiwi-600 dark:text-kiwi-400'
                      : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700'
                  }`}
                  onClick={() => handleSelect(key as Locale)}
                  whileHover={{ x: 4 }}
                >
                  <span className="text-xl">{config.flag}</span>
                  <div>
                    <p className="font-medium">{config.label}</p>
                    <p className="text-xs text-surface-400 dark:text-surface-500">
                      {key.toUpperCase()}
                    </p>
                  </div>
                  {locale === key && (
                    <motion.span
                      className="ml-auto text-kiwi-500"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      ✓
                    </motion.span>
                  )}
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Compact version for mobile
export function LanguageSwitcherCompact() {
  const { locale, setLocale } = useLanguage();

  const toggleLocale = () => {
    const newLocale: Locale = locale === 'es' ? 'en' : 'es';
    setLocale(newLocale);
  };

  return (
    <motion.button
      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
      onClick={toggleLocale}
      whileTap={{ scale: 0.95 }}
    >
      <span className="text-sm">{locales[locale].flag}</span>
      <span className="text-xs font-medium text-surface-600 dark:text-surface-400">
        {locale.toUpperCase()}
      </span>
    </motion.button>
  );
}
