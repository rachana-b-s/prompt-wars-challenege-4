/**
 * Property-based tests for the Crowd Monitor Service.
 *
 * Property 17: Density Color Classification — correct color for all values 0–100
 * Property 18: Density Staleness Detection — stale iff >60s since lastUpdated
 *
 * **Validates: Requirements 6.3, 6.5**
 */

import { describe, it } from 'vitest';
import fc from 'fast-check';
import { getDensityLevel, isStale } from './crowd-monitor';
import type { DensityEntry } from '@/types/crowd';

describe('Crowd Monitor — Property-Based Tests', () => {
  /**
   * Property 17: Density Color Classification
   *
   * For all density values in [0, 100], getDensityLevel must return:
   *   - 'green'  if density <= 40
   *   - 'yellow' if 41 <= density <= 70
   *   - 'red'    if density >= 71
   *
   * **Validates: Requirements 6.3**
   */
  describe('Property 17: Density Color Classification', () => {
    it('returns green for density values 0–40', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 40 }), (density) => {
          return getDensityLevel(density) === 'green';
        })
      );
    });

    it('returns yellow for density values 41–70', () => {
      fc.assert(
        fc.property(fc.integer({ min: 41, max: 70 }), (density) => {
          return getDensityLevel(density) === 'yellow';
        })
      );
    });

    it('returns red for density values 71–100', () => {
      fc.assert(
        fc.property(fc.integer({ min: 71, max: 100 }), (density) => {
          return getDensityLevel(density) === 'red';
        })
      );
    });

    it('classifies all values 0–100 into exactly one of green, yellow, or red', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), (density) => {
          const level = getDensityLevel(density);
          const validLevels = ['green', 'yellow', 'red'];
          return validLevels.includes(level);
        })
      );
    });

    it('classification is consistent with boundary definitions', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), (density) => {
          const level = getDensityLevel(density);
          if (density <= 40) return level === 'green';
          if (density <= 70) return level === 'yellow';
          return level === 'red';
        })
      );
    });
  });

  /**
   * Property 18: Density Staleness Detection
   *
   * An entry is stale if and only if (now - lastUpdated) > 60000ms.
   * An undefined entry is always stale.
   *
   * **Validates: Requirements 6.5**
   */
  describe('Property 18: Density Staleness Detection', () => {
    it('returns stale=true when elapsed time > 60000ms', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 1_000_000_000 }),
          fc.integer({ min: 60_001, max: 1_000_000 }),
          (lastUpdated, elapsed) => {
            const entry: DensityEntry = {
              zoneId: 'test-zone',
              density: 50,
              lastUpdated,
              level: 'yellow',
            };
            const now = lastUpdated + elapsed;
            return isStale(entry, now) === true;
          }
        )
      );
    });

    it('returns stale=false when elapsed time <= 60000ms', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 1_000_000_000 }),
          fc.integer({ min: 0, max: 60_000 }),
          (lastUpdated, elapsed) => {
            const entry: DensityEntry = {
              zoneId: 'test-zone',
              density: 50,
              lastUpdated,
              level: 'yellow',
            };
            const now = lastUpdated + elapsed;
            return isStale(entry, now) === false;
          }
        )
      );
    });

    it('undefined entry is always stale regardless of now value', () => {
      fc.assert(
        fc.property(fc.nat({ max: 2_000_000_000 }), (now) => {
          return isStale(undefined, now) === true;
        })
      );
    });

    it('staleness is exclusively determined by the 60s threshold', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 1_000_000_000 }),
          fc.nat({ max: 1_000_000 }),
          (lastUpdated, elapsed) => {
            const entry: DensityEntry = {
              zoneId: 'test-zone',
              density: 50,
              lastUpdated,
              level: 'yellow',
            };
            const now = lastUpdated + elapsed;
            const stale = isStale(entry, now);
            const expected = elapsed > 60_000;
            return stale === expected;
          }
        )
      );
    });
  });
});
