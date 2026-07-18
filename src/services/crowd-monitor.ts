/**
 * Crowd Monitor Service — pure functional API for crowd density management.
 *
 * Provides a clean service layer wrapping density operations so they can be used
 * by both React components and pure functions (like the route engine) without
 * depending on Zustand hooks.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */

import type { ZoneId } from '@/types/stadium';
import type { DensityMap, DensityEntry, DensityLevel, DensityUpdate } from '@/types/crowd';

/**
 * Get the density entry for a specific zone.
 */
export function getDensity(map: DensityMap, zoneId: ZoneId): DensityEntry | undefined {
  return map[zoneId];
}

/**
 * Return the full density map (identity function for API consistency).
 */
export function getAllDensities(map: DensityMap): DensityMap {
  return map;
}

/**
 * Update a single zone's density, returning a new DensityMap.
 */
export function updateDensity(map: DensityMap, update: DensityUpdate): DensityMap {
  const timestamp = update.timestamp ?? Date.now();
  return {
    ...map,
    [update.zoneId]: {
      zoneId: update.zoneId,
      density: update.density,
      lastUpdated: timestamp,
      level: getDensityLevel(update.density),
    },
  };
}

/**
 * Apply multiple density updates, returning a new DensityMap.
 */
export function bulkUpdate(map: DensityMap, updates: DensityUpdate[]): DensityMap {
  let result = { ...map };
  for (const update of updates) {
    const timestamp = update.timestamp ?? Date.now();
    result[update.zoneId] = {
      zoneId: update.zoneId,
      density: update.density,
      lastUpdated: timestamp,
      level: getDensityLevel(update.density),
    };
  }
  return result;
}

/**
 * Returns true if the density entry is stale (>60 seconds since last update).
 * If no entry exists, considers it stale.
 */
export function isStale(entry: DensityEntry | undefined, now?: number): boolean {
  if (!entry) return true;
  const currentTime = now ?? Date.now();
  return currentTime - entry.lastUpdated > 60_000;
}

/**
 * Classify a density value (0–100) into a DensityLevel.
 *   green:  0–40
 *   yellow: 41–70
 *   red:    71–100
 */
export function getDensityLevel(density: number): DensityLevel {
  if (density <= 40) return 'green';
  if (density <= 70) return 'yellow';
  return 'red';
}

/**
 * Return the hex color string for a given DensityLevel.
 */
export function getDensityColor(level: DensityLevel): string {
  switch (level) {
    case 'green':
      return '#22c55e';
    case 'yellow':
      return '#eab308';
    case 'red':
      return '#ef4444';
  }
}
