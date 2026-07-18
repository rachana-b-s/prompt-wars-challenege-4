/**
 * Tests for the useTranslation hook.
 * Verifies translation lookup, language switching, and hasTranslation.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTranslation } from './useTranslation';
import { useFanStore } from '@/stores/fan-store';

describe('useTranslation', () => {
  beforeEach(() => {
    useFanStore.setState({
      profile: {
        ...useFanStore.getState().profile,
        language: 'en',
      },
    });
  });

  it('returns t function that translates keys in English', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t('nav.route')).toBe('Route');
    expect(result.current.language).toBe('en');
  });

  it('translates to Spanish when language is set to es', () => {
    useFanStore.setState({
      profile: { ...useFanStore.getState().profile, language: 'es' },
    });
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t('nav.route')).toBe('Ruta');
    expect(result.current.language).toBe('es');
  });

  it('translates to French when language is set to fr', () => {
    useFanStore.setState({
      profile: { ...useFanStore.getState().profile, language: 'fr' },
    });
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t('nav.route')).toBe('Itinéraire');
  });

  it('hasTranslation returns true for existing keys', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.hasTranslation('nav.route')).toBe(true);
    expect(result.current.hasTranslation('action.sos')).toBe(true);
  });

  it('translates action keys correctly', () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t('action.sos')).toBe('SOS');
    expect(result.current.t('action.save')).toBe('Save');
    expect(result.current.t('status.loading')).toBe('Loading...');
  });
});
