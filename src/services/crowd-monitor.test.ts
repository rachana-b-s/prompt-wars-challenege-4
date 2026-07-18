/**
 * Unit tests for the Crowd Monitor Service.
 * Tests core density operations: get, update, bulk update, staleness, and color classification.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */

import { describe, it, expect } from 'vitest';
import {
  getDensity,
  getAllDensities,
  updateDensity,
  bulkUpdate,
  isStale,
  getDensityLevel,
  getDensityColor,
} from './crowd-monitor';
import type { DensityMap, DensityEntry } from '@/types/crowd';

describe('CrowdMonitorService', () => {
  const now = 1700000000000;

  const sampleMap: DensityMap = {
    'zone-a': { zoneId: 'zone-a', density: 30, lastUpdated: now, level: 'green' },
    'zone-b': { zoneId: 'zone-b', density: 55, lastUpdated: now, level: 'yellow' },
    'zone-c': { zoneId: 'zone-c', density: 85, lastUpdated: now, level: 'red' },
  };

  describe('getDensity', () => {
    it('returns the entry for an existing zone', () => {
      const result = getDensity(sampleMap, 'zone-a');
      expect(result).toEqual(sampleMap['zone-a']);
    });

    it('returns undefined for a non-existent zone', () => {
      const result = getDensity(sampleMap, 'zone-x');
      expect(result).toBeUndefined();
    });
  });

  describe('getAllDensities', () => {
    it('returns the full density map', () => {
      expect(getAllDensities(sampleMap)).toBe(sampleMap);
    });
  });

  describe('updateDensity', () => {
    it('updates an existing zone with new density and timestamp', () => {
      const updated = updateDensity(sampleMap, {
        zoneId: 'zone-a',
        density: 60,
        timestamp: now + 5000,
      });
      expect(updated['zone-a']).toEqual({
        zoneId: 'zone-a',
        density: 60,
        lastUpdated: now + 5000,
        level: 'yellow',
      });
    });

    it('adds a new zone that did not exist before', () => {
      const updated = updateDensity(sampleMap, {
        zoneId: 'zone-d',
        density: 10,
        timestamp: now + 1000,
      });
      expect(updated['zone-d']).toEqual({
        zoneId: 'zone-d',
        density: 10,
        lastUpdated: now + 1000,
        level: 'green',
      });
    });

    it('does not mutate the original map', () => {
      const original = { ...sampleMap };
      updateDensity(sampleMap, { zoneId: 'zone-a', density: 99, timestamp: now });
      expect(sampleMap).toEqual(original);
    });

    it('uses Date.now() when timestamp is not provided', () => {
      const before = Date.now();
      const updated = updateDensity(sampleMap, { zoneId: 'zone-a', density: 50 });
      const after = Date.now();
      expect(updated['zone-a'].lastUpdated).toBeGreaterThanOrEqual(before);
      expect(updated['zone-a'].lastUpdated).toBeLessThanOrEqual(after);
    });
  });

  describe('bulkUpdate', () => {
    it('applies multiple updates at once', () => {
      const updates = [
        { zoneId: 'zone-a', density: 10, timestamp: now + 100 },
        { zoneId: 'zone-b', density: 90, timestamp: now + 100 },
      ];
      const updated = bulkUpdate(sampleMap, updates);
      expect(updated['zone-a'].density).toBe(10);
      expect(updated['zone-a'].level).toBe('green');
      expect(updated['zone-b'].density).toBe(90);
      expect(updated['zone-b'].level).toBe('red');
    });

    it('does not mutate the original map', () => {
      const original = { ...sampleMap };
      bulkUpdate(sampleMap, [{ zoneId: 'zone-a', density: 99, timestamp: now }]);
      expect(sampleMap).toEqual(original);
    });

    it('handles empty updates array', () => {
      const updated = bulkUpdate(sampleMap, []);
      expect(updated).toEqual(sampleMap);
    });
  });

  describe('isStale', () => {
    it('returns false when update was less than 60s ago', () => {
      const entry: DensityEntry = { zoneId: 'z', density: 50, lastUpdated: now, level: 'yellow' };
      expect(isStale(entry, now + 59_999)).toBe(false);
    });

    it('returns false at exactly 60s boundary', () => {
      const entry: DensityEntry = { zoneId: 'z', density: 50, lastUpdated: now, level: 'yellow' };
      expect(isStale(entry, now + 60_000)).toBe(false);
    });

    it('returns true when update was more than 60s ago', () => {
      const entry: DensityEntry = { zoneId: 'z', density: 50, lastUpdated: now, level: 'yellow' };
      expect(isStale(entry, now + 60_001)).toBe(true);
    });

    it('returns true for undefined entry', () => {
      expect(isStale(undefined, now)).toBe(true);
    });
  });

  describe('getDensityLevel', () => {
    it('returns green for density 0', () => {
      expect(getDensityLevel(0)).toBe('green');
    });

    it('returns green for density 40', () => {
      expect(getDensityLevel(40)).toBe('green');
    });

    it('returns yellow for density 41', () => {
      expect(getDensityLevel(41)).toBe('yellow');
    });

    it('returns yellow for density 70', () => {
      expect(getDensityLevel(70)).toBe('yellow');
    });

    it('returns red for density 71', () => {
      expect(getDensityLevel(71)).toBe('red');
    });

    it('returns red for density 100', () => {
      expect(getDensityLevel(100)).toBe('red');
    });
  });

  describe('getDensityColor', () => {
    it('returns correct hex for green', () => {
      expect(getDensityColor('green')).toBe('#22c55e');
    });

    it('returns correct hex for yellow', () => {
      expect(getDensityColor('yellow')).toBe('#eab308');
    });

    it('returns correct hex for red', () => {
      expect(getDensityColor('red')).toBe('#ef4444');
    });
  });
});
