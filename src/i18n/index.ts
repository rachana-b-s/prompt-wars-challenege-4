/**
 * i18n helper — simple translation lookup function.
 *
 * Usage:
 *   t('nav.route', 'ja') → 'ルート'
 *   t('nav.route', 'en') → 'Route'
 *
 * If a key is missing for the given language, falls back to English.
 * If the key doesn't exist at all, returns the key itself with the
 * untranslatable indicator appended.
 *
 * Requirements: 8.2, 8.4
 */

import type { LanguageCode } from '@/types/fan';
import { translations, type TranslationKey } from './translations';

/**
 * Translate a key to the given language.
 *
 * @param key - The translation key (e.g. 'nav.route')
 * @param language - The target language code
 * @returns The translated string, or English fallback, or key with untranslatable indicator
 */
export function t(key: TranslationKey, language: LanguageCode): string {
  const langMap = translations[language];
  if (langMap && key in langMap) {
    return langMap[key];
  }

  // Fallback to English
  const enMap = translations['en'];
  if (enMap && key in enMap) {
    return enMap[key];
  }

  // Key not found at all — show with untranslatable indicator
  return `${key} ${translations[language]?.['untranslatable_indicator'] ?? '[untranslated]'}`;
}

/**
 * Check whether a translation exists for a given key and language.
 * Returns false if the key would fall back to English or show the untranslatable indicator.
 */
export function hasTranslation(key: TranslationKey, language: LanguageCode): boolean {
  const langMap = translations[language];
  return !!(langMap && key in langMap);
}

export { type TranslationKey } from './translations';
export { LANGUAGE_NAMES, LANGUAGE_TONE_INSTRUCTIONS } from './translations';
