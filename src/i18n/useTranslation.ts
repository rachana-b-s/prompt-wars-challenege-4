/**
 * React hook for i18n — reads language from the fan store
 * and provides a bound `t()` function.
 *
 * Usage:
 *   const { t, language } = useTranslation();
 *   <span>{t('nav.route')}</span>
 *
 * Requirements: 8.1, 8.2
 */

'use client';

import { useCallback } from 'react';
import { useFanStore } from '@/stores/fan-store';
import { t as translate, hasTranslation as checkTranslation } from './index';
import type { TranslationKey } from './translations';
import type { LanguageCode } from '@/types/fan';

export interface UseTranslationReturn {
  /** Translate a key using the fan's current language */
  t: (key: TranslationKey) => string;
  /** Check if a translation exists for the current language */
  hasTranslation: (key: TranslationKey) => boolean;
  /** The current language code */
  language: LanguageCode;
}

/**
 * Hook that provides translation utilities bound to the fan's selected language.
 */
export function useTranslation(): UseTranslationReturn {
  const language = useFanStore((s) => s.profile.language);

  const t = useCallback(
    (key: TranslationKey) => translate(key, language),
    [language]
  );

  const hasTranslationFn = useCallback(
    (key: TranslationKey) => checkTranslation(key, language),
    [language]
  );

  return {
    t,
    hasTranslation: hasTranslationFn,
    language,
  };
}
