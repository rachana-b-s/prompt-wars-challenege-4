/**
 * Property-based tests for accessibility-specific routing constraints.
 *
 * Property 9: Child Safety Zone Exclusion
 * Property 10: Sensory Sensitivity Zone Avoidance
 * Property 22: Pregnancy Restroom Proximity
 *
 * Validates: Requirements 3.12, 3.15, 3.16, 3.18, 16.6, 17.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeRoute } from './route-engine';
import { validatePregnancyRestroomProximity } from './accessibility-constraints';
import { syntheticStadium } from '@/data/synthetic-stadium';
import { syntheticFacilities } from '@/data/synthetic-facilities';
import type { RouteRequest } from '@/types/route';
import type { DensityMap } from '@/types/crowd';
import type { FanProfile } from '@/types/fan';

// --- Test Helpers ---

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _emptyDensityMap: DensityMap = {};

/**
 * Get all zone IDs from the synthetic stadium.
 */
const syntheticZoneIds = syntheticStadium.zones.map((z) => z.id);

/**
 * Arbitrary that picks a random zone from the synthetic stadium.
 */
const syntheticZoneArb = fc.constantFrom(...syntheticZoneIds);

/**
 * Build a density map from the synthetic stadium data.
 */
function buildDensityMapFromGraph(): DensityMap {
  const map: DensityMap = {};
  for (const zone of syntheticStadium.zones) {
    map[zone.id] = {
      zoneId: zone.id,
      density: zone.currentDensity,
      lastUpdated: zone.lastDensityUpdate,
      level:
        zone.currentDensity <= 40
          ? 'green'
          : zone.currentDensity <= 70
            ? 'yellow'
            : 'red',
    };
  }
  return map;
}

function makeProfile(overrides: Partial<FanProfile> = {}): FanProfile {
  return {
    id: 'fan-1',
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
    recentDestinations: [],
    ...overrides,
  };
}

// --- Property 9: Child Safety Zone Exclusion ---
// Feature: smart-stadium-fan-navigator, Property 9: Child Safety Zone Exclusion
// **Validates: Requirements 3.18, 16.6**

describe('Property 9: Child Safety Zone Exclusion', () => {
  it('child accompaniment excludes smoking_area, loading_dock, and service_corridor zones', () => {
    const densityMap = buildDensityMapFromGraph();

    fc.assert(
      fc.property(syntheticZoneArb, syntheticZoneArb, (source, destination) => {
        if (source === destination) return;

        const request: RouteRequest = {
          source,
          destination,
          fanProfile: makeProfile({
            accessibilityProfile: {
              categories: ['child_accompanied'],
              hasCompanion: false,
              avoidStairs: false,
              avoidCrowds: false,
              preferQuiet: false,
              allergens: [],
            },
          }),
        };

        const result = computeRoute(syntheticStadium, request, densityMap);

        if (result.status !== 'found') return;

        // Verify NO zone in path has type 'smoking_area', 'loading_dock', or 'service_corridor'
        const childUnsafeTypes = ['smoking_area', 'loading_dock', 'service_corridor'];

        for (const zoneId of result.path) {
          const zone = syntheticStadium.zones.find((z) => z.id === zoneId);
          expect(zone).toBeDefined();
          expect(childUnsafeTypes).not.toContain(zone!.type);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('child accompaniment via group membership also excludes unsafe zones', () => {
    const densityMap = buildDensityMapFromGraph();

    // Even when child_accompanied is set without other constraints,
    // unsafe zones should still be excluded
    fc.assert(
      fc.property(syntheticZoneArb, syntheticZoneArb, (source, destination) => {
        if (source === destination) return;

        const request: RouteRequest = {
          source,
          destination,
          fanProfile: makeProfile({
            accessibilityProfile: {
              categories: ['child_accompanied'],
              hasCompanion: true, // with companion
              avoidStairs: false,
              avoidCrowds: true,
              preferQuiet: true,
              allergens: [],
            },
          }),
        };

        const result = computeRoute(syntheticStadium, request, densityMap);

        if (result.status !== 'found') return;

        const childUnsafeTypes = ['smoking_area', 'loading_dock', 'service_corridor'];

        for (const zoneId of result.path) {
          const zone = syntheticStadium.zones.find((z) => z.id === zoneId);
          expect(zone).toBeDefined();
          expect(childUnsafeTypes).not.toContain(zone!.type);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 10: Sensory Sensitivity Zone Avoidance ---
// Feature: smart-stadium-fan-navigator, Property 10: Sensory Sensitivity Zone Avoidance
// **Validates: Requirements 3.15, 3.16, 17.4**

describe('Property 10: Sensory Sensitivity Zone Avoidance', () => {
  it('neurodivergent profile avoids smoking_area zones (hard exclusion)', () => {
    const densityMap = buildDensityMapFromGraph();

    fc.assert(
      fc.property(syntheticZoneArb, syntheticZoneArb, (source, destination) => {
        if (source === destination) return;

        const request: RouteRequest = {
          source,
          destination,
          fanProfile: makeProfile({
            accessibilityProfile: {
              categories: ['neurodivergent'],
              hasCompanion: false,
              avoidStairs: false,
              avoidCrowds: false,
              preferQuiet: true,
              allergens: [],
            },
          }),
        };

        const result = computeRoute(syntheticStadium, request, densityMap);

        if (result.status !== 'found') return;

        // Smoking areas should be hard-excluded for sensory sensitivity
        for (const zoneId of result.path) {
          const zone = syntheticStadium.zones.find((z) => z.id === zoneId);
          expect(zone).toBeDefined();
          expect(zone!.type).not.toBe('smoking_area');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('sensory sensitivity with preferQuiet avoids smoking_area zones', () => {
    const densityMap = buildDensityMapFromGraph();

    fc.assert(
      fc.property(syntheticZoneArb, syntheticZoneArb, (source, destination) => {
        if (source === destination) return;

        const request: RouteRequest = {
          source,
          destination,
          fanProfile: makeProfile({
            accessibilityProfile: {
              categories: [],
              hasCompanion: false,
              avoidStairs: false,
              avoidCrowds: false,
              preferQuiet: true, // triggers sensory constraints
              allergens: [],
            },
          }),
        };

        const result = computeRoute(syntheticStadium, request, densityMap);

        if (result.status !== 'found') return;

        // Smoking areas should be excluded when preferQuiet is set
        for (const zoneId of result.path) {
          const zone = syntheticStadium.zones.find((z) => z.id === zoneId);
          expect(zone).toBeDefined();
          expect(zone!.type).not.toBe('smoking_area');
        }
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 22: Pregnancy Restroom Proximity ---
// Feature: smart-stadium-fan-navigator, Property 22: Pregnancy Restroom Proximity
// **Validates: Requirements 3.12**

describe('Property 22: Pregnancy Restroom Proximity', () => {
  it('every zone in a pregnant profile route is within 2 zone-hops of a restroom', () => {
    const densityMap = buildDensityMapFromGraph();

    fc.assert(
      fc.property(syntheticZoneArb, syntheticZoneArb, (source, destination) => {
        if (source === destination) return;

        const request: RouteRequest = {
          source,
          destination,
          fanProfile: makeProfile({
            accessibilityProfile: {
              categories: ['pregnant'],
              hasCompanion: false,
              avoidStairs: true,
              avoidCrowds: false,
              preferQuiet: false,
              allergens: [],
            },
          }),
        };

        const result = computeRoute(syntheticStadium, request, densityMap);

        if (result.status !== 'found') return;

        // Validate pregnancy restroom proximity using the helper
        const proximityValid = validatePregnancyRestroomProximity(
          result.path,
          syntheticStadium,
          syntheticFacilities
        );

        // This is a best-effort property: if a route exists,
        // the proximity constraint should hold for the returned path
        expect(proximityValid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('validatePregnancyRestroomProximity returns true for empty path', () => {
    const result = validatePregnancyRestroomProximity(
      [],
      syntheticStadium,
      syntheticFacilities
    );
    expect(result).toBe(true);
  });

  it('validatePregnancyRestroomProximity returns false when no restrooms exist', () => {
    const result = validatePregnancyRestroomProximity(
      ['concourse-north'],
      syntheticStadium,
      [] // no facilities at all
    );
    expect(result).toBe(false);
  });
});
