/**
 * Zustand store for facility registry state management.
 * Auto-loads synthetic facilities on first access.
 * Persists to localStorage for session continuity.
 *
 * Requirements: 6.1, 7.5, 10.5
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ZoneId } from '@/types/stadium';
import type { Facility, FacilityType } from '@/types/facility';
import { syntheticFacilities } from '@/data/synthetic-facilities';

export interface FacilityState {
  facilities: Facility[];
  loadFacilities: (facilities: Facility[]) => void;
  getById: (id: string) => Facility | undefined;
  getByZone: (zoneId: ZoneId) => Facility[];
  getByType: (type: FacilityType) => Facility[];
  search: (query: string) => Facility[];
}

export const useFacilityStore = create<FacilityState>()(
  persist(
    (set, get) => ({
      facilities: syntheticFacilities,

      loadFacilities: (facilities: Facility[]) => {
        set({ facilities });
      },

      getById: (id: string): Facility | undefined => {
        return get().facilities.find((f) => f.id === id);
      },

      getByZone: (zoneId: ZoneId): Facility[] => {
        return get().facilities.filter((f) => f.zone === zoneId);
      },

      getByType: (type: FacilityType): Facility[] => {
        return get().facilities.filter((f) => f.type === type);
      },

      search: (query: string): Facility[] => {
        const lowerQuery = query.toLowerCase();
        return get().facilities.filter(
          (f) =>
            f.name.toLowerCase().includes(lowerQuery) ||
            f.type.toLowerCase().includes(lowerQuery) ||
            f.zone.toLowerCase().includes(lowerQuery)
        );
      },
    }),
    {
      name: 'facility-registry',
      partialize: (state) => ({ facilities: state.facilities }),
    }
  )
);
