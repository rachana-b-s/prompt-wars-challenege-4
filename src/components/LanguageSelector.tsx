'use client';

/**
 * LanguageSelector — Standalone language picker widget for the navigation header.
 * Supports 8 languages (en, es, fr, ar, pt, de, ja, zh).
 * Reads/writes language to the fan store.
 *
 * Can be placed in header/nav bar independently of the ProfileSetup panel.
 *
 * Requirements: 8.1, 8.2
 */

import { useFanStore } from '@/stores/fan-store';
import { LANGUAGE_NAMES } from '@/i18n';
import type { LanguageCode } from '@/types/fan';

const LANGUAGE_CODES: LanguageCode[] = ['en', 'es', 'fr', 'ar', 'pt', 'de', 'ja', 'zh'];

export function LanguageSelector() {
  const language = useFanStore((s) => s.profile.language);
  const setLanguage = useFanStore((s) => s.setLanguage);

  return (
    <div className="flex items-center gap-2">
      <label
        htmlFor="language-selector"
        className="text-xs text-gray-500 dark:text-gray-400 sr-only"
      >
        Language
      </label>
      <select
        id="language-selector"
        value={language}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
        className="px-2 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        aria-label="Select language"
      >
        {LANGUAGE_CODES.map((code) => (
          <option key={code} value={code}>
            {LANGUAGE_NAMES[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
