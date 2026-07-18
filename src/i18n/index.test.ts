import { describe, it, expect } from 'vitest';
import { t, hasTranslation, LANGUAGE_NAMES, LANGUAGE_TONE_INSTRUCTIONS } from './index';
import { translations, type TranslationKey } from './translations';
import type { LanguageCode } from '@/types/fan';

const ALL_LANGUAGES: LanguageCode[] = ['en', 'es', 'fr', 'ar', 'pt', 'de', 'ja', 'zh'];

describe('i18n t() function', () => {
  it('returns English translation for English language', () => {
    expect(t('nav.route', 'en')).toBe('Route');
    expect(t('action.sos', 'en')).toBe('SOS');
  });

  it('returns translated string for each supported language', () => {
    expect(t('nav.route', 'es')).toBe('Ruta');
    expect(t('nav.route', 'fr')).toBe('Itinéraire');
    expect(t('nav.route', 'ar')).toBe('المسار');
    expect(t('nav.route', 'pt')).toBe('Rota');
    expect(t('nav.route', 'de')).toBe('Route');
    expect(t('nav.route', 'ja')).toBe('ルート');
    expect(t('nav.route', 'zh')).toBe('路线');
  });

  it('returns key with untranslatable indicator for unknown keys', () => {
    // Force a non-existent key by casting
    const fakeKey = 'nonexistent.key' as TranslationKey;
    const result = t(fakeKey, 'en');
    expect(result).toContain('[untranslated]');
  });

  it('all 8 languages have all defined keys', () => {
    const enKeys = Object.keys(translations['en']) as TranslationKey[];
    for (const lang of ALL_LANGUAGES) {
      for (const key of enKeys) {
        expect(translations[lang][key]).toBeDefined();
      }
    }
  });
});

describe('hasTranslation()', () => {
  it('returns true for existing key in a language', () => {
    expect(hasTranslation('nav.route', 'ja')).toBe(true);
    expect(hasTranslation('action.sos', 'zh')).toBe(true);
  });

  it('returns false for non-existent key', () => {
    const fakeKey = 'does.not.exist' as TranslationKey;
    expect(hasTranslation(fakeKey, 'en')).toBe(false);
  });
});

describe('LANGUAGE_NAMES', () => {
  it('provides native names for all 8 languages', () => {
    expect(Object.keys(LANGUAGE_NAMES)).toHaveLength(8);
    expect(LANGUAGE_NAMES['en']).toBe('English');
    expect(LANGUAGE_NAMES['ja']).toBe('日本語');
    expect(LANGUAGE_NAMES['ar']).toBe('العربية');
  });
});

describe('LANGUAGE_TONE_INSTRUCTIONS', () => {
  it('provides tone instructions for all 8 languages', () => {
    expect(Object.keys(LANGUAGE_TONE_INSTRUCTIONS)).toHaveLength(8);
    for (const lang of ALL_LANGUAGES) {
      expect(LANGUAGE_TONE_INSTRUCTIONS[lang]).toBeDefined();
      expect(LANGUAGE_TONE_INSTRUCTIONS[lang].length).toBeGreaterThan(0);
    }
  });

  it('Japanese uses formal/keigo', () => {
    expect(LANGUAGE_TONE_INSTRUCTIONS['ja']).toContain('formal');
  });

  it('Portuguese uses informal/friendly', () => {
    expect(LANGUAGE_TONE_INSTRUCTIONS['pt']).toContain('informal');
  });
});
