/**
 * Zustand store for fan profile state management.
 * Supports profile updates at any time, multiple simultaneous accessibility categories,
 * and persists to localStorage.
 *
 * Requirements: 3.22, 3.23, 5.1, 8.1, 11.4
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  FanProfile,
  AccessibilityProfile,
  FanAllegiance,
  LanguageCode,
} from '@/types/fan';
import type { ZoneId } from '@/types/stadium';

/** Maximum number of recent destinations to retain */
const MAX_RECENT_DESTINATIONS = 5;

export interface FanState {
  profile: FanProfile;
  updateProfile: (updates: Partial<FanProfile>) => void;
  updateAccessibility: (updates: Partial<AccessibilityProfile>) => void;
  setCurrentZone: (zone: ZoneId | undefined) => void;
  addRecentDestination: (zone: ZoneId) => void;
  setLanguage: (lang: LanguageCode) => void;
  setAllegiance: (allegiance: FanAllegiance) => void;
}

function createDefaultProfile(): FanProfile {
  return {
    id: crypto.randomUUID(),
    accessibilityProfile: {
      categories: [],
      hasCompanion: false,
      avoidStairs: false,
      avoidCrowds: false,
      preferQuiet: false,
      allergens: [],
    },
    allegiance: 'neutral',
    language: 'en',
    currentZone: undefined,
    recentDestinations: [],
  };
}

export const useFanStore = create<FanState>()(
  persist(
    (set) => ({
      profile: createDefaultProfile(),

      /** Update one or more top-level profile fields (partial merge). */
      updateProfile: (updates: Partial<FanProfile>) => {
        set((state) => ({
          profile: { ...state.profile, ...updates },
        }));
      },

      /** Update accessibility profile fields (partial merge into nested object). */
      updateAccessibility: (updates: Partial<AccessibilityProfile>) => {
        set((state) => ({
          profile: {
            ...state.profile,
            accessibilityProfile: {
              ...state.profile.accessibilityProfile,
              ...updates,
            },
          },
        }));
      },

      /** Set the fan's current zone (used for proximity-based features). */
      setCurrentZone: (zone: ZoneId | undefined) => {
        set((state) => ({
          profile: { ...state.profile, currentZone: zone },
        }));
      },

      /** Add a zone to the front of recent destinations (deduplicates, caps at MAX_RECENT_DESTINATIONS). */
      addRecentDestination: (zone: ZoneId) => {
        set((state) => {
          // Remove duplicate if already in list, then prepend
          const filtered = state.profile.recentDestinations.filter(
            (z) => z !== zone
          );
          const updated = [zone, ...filtered].slice(0, MAX_RECENT_DESTINATIONS);
          return {
            profile: { ...state.profile, recentDestinations: updated },
          };
        });
      },

      /** Set the preferred UI language. */
      setLanguage: (lang: LanguageCode) => {
        set((state) => ({
          profile: { ...state.profile, language: lang },
        }));
      },

      /** Set the fan's team allegiance (affects zone routing for rival separation). */
      setAllegiance: (allegiance: FanAllegiance) => {
        set((state) => ({
          profile: { ...state.profile, allegiance },
        }));
      },
    }),
    {
      name: 'fan-profile',
      partialize: (state) => ({ profile: state.profile }),
    }
  )
);
