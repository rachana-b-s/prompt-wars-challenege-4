/**
 * Zustand store for crowd density state management.
 * Initializes from synthetic stadium zones' currentDensity values.
 * Persists to localStorage for session continuity.
 *
 * Requirements: 6.1, 6.5
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ZoneId } from '@/types/stadium';
import type { DensityMap, DensityEntry, DensityLevel, DensityUpdate } from '@/types/crowd';
import { syntheticStadium } from '@/data/synthetic-stadium';

export interface CrowdState {
  densityMap: DensityMap;
  getDensity: (zoneId: ZoneId) => DensityEntry | undefined;
  updateDensity: (update: DensityUpdate) => void;
  bulkUpdate: (updates: DensityUpdate[]) => void;
  isStale: (zoneId: ZoneId) => boolean;
  getDensityLevel: (density: number) => DensityLevel;
}

function getDensityLevelForValue(density: number): DensityLevel {
  if (density <= 40) return 'green';
  if (density <= 70) return 'yellow';
  return 'red';
}

function buildInitialDensityMap(): DensityMap {
  const map: DensityMap = {};
  const now = Date.now();
  for (const zone of syntheticStadium.zones) {
    map[zone.id] = {
      zoneId: zone.id,
      density: zone.currentDensity,
      lastUpdated: now,
      level: getDensityLevelForValue(zone.currentDensity),
    };
  }
  return map;
}

export const useCrowdStore = create<CrowdState>()(
  persist(
    (set, get) => ({
      densityMap: buildInitialDensityMap(),

      getDensity: (zoneId: ZoneId): DensityEntry | undefined => {
        return get().densityMap[zoneId];
      },

      updateDensity: (update: DensityUpdate) => {
        set((state) => {
          const timestamp = update.timestamp ?? Date.now();
          const newMap = { ...state.densityMap };
          newMap[update.zoneId] = {
            zoneId: update.zoneId,
            density: update.density,
            lastUpdated: timestamp,
            level: getDensityLevelForValue(update.density),
          };
          return { densityMap: newMap };
        });
      },

      bulkUpdate: (updates: DensityUpdate[]) => {
        set((state) => {
          const newMap = { ...state.densityMap };
          for (const update of updates) {
            const timestamp = update.timestamp ?? Date.now();
            newMap[update.zoneId] = {
              zoneId: update.zoneId,
              density: update.density,
              lastUpdated: timestamp,
              level: getDensityLevelForValue(update.density),
            };
          }
          return { densityMap: newMap };
        });
      },

      isStale: (zoneId: ZoneId): boolean => {
        const entry = get().densityMap[zoneId];
        if (!entry) return true;
        return Date.now() - entry.lastUpdated > 60_000;
      },

      getDensityLevel: (density: number): DensityLevel => {
        return getDensityLevelForValue(density);
      },
    }),
    {
      name: 'crowd-density',
      partialize: (state) => ({ densityMap: state.densityMap }),
    }
  )
);
