/**
 * Crowd density types for the Smart Stadium Fan Navigator.
 */

import type { ZoneId } from './stadium';

export type DensityLevel = 'green' | 'yellow' | 'red';

export interface DensityEntry {
  zoneId: ZoneId;
  density: number;
  lastUpdated: number;
  level: DensityLevel;
}

export type DensityMap = Record<ZoneId, DensityEntry>;

export interface DensityUpdate {
  zoneId: ZoneId;
  density: number;
  timestamp?: number;
}
