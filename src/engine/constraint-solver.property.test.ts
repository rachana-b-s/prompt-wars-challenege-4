/**
 * Property-based tests for the constraint solver.
 *
 * Property 11: Group Constraint Merge Monotonicity
 * Property 13: Constraint Priority Ordering
 * Property 25: Constraint Conflict Identification
 *
 * Validates: Requirements 4.2, 4.3, 3.25, 12.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  mergeProfiles,
  isZoneAllowed,
  identifyConflicts,
} from './constraint-solver';
import type {
  AccessibilityProfile,
  AccessibilityCategory,
  FanGroupMember,
} from '@/types/fan';
import type { Zone, ZoneType } from '@/types/stadium';
import type { RouteConstraints } from '@/types/route';

// --- Generators ---

const accessibilityCategoryArb: fc.Arbitrary<AccessibilityCategory> = fc.oneof(
  fc.constant('wheelchair' as AccessibilityCategory),
  fc.constant('limited_mobility' as AccessibilityCategory),
  fc.constant('blind' as AccessibilityCategory),
  fc.constant('low_vision' as AccessibilityCategory),
  fc.constant('deaf' as AccessibilityCategory),
  fc.constant('hard_of_hearing' as AccessibilityCategory),
  fc.constant('neurodivergent' as AccessibilityCategory),
  fc.constant('pregnant' as AccessibilityCategory),
  fc.constant('elderly' as AccessibilityCategory),
  fc.constant('child_accompanied' as AccessibilityCategory)
);

const accessibilityProfileArb: fc.Arbitrary<AccessibilityProfile> = fc.record({
  categories: fc.uniqueArray(accessibilityCategoryArb, { maxLength: 4 }),
  hasCompanion: fc.boolean(),
  maxWalkingDistance: fc.option(fc.integer({ min: 50, max: 2000 }), { nil: undefined }),
  avoidStairs: fc.boolean(),
  avoidCrowds: fc.boolean(),
  preferQuiet: fc.boolean(),
  allergens: fc.uniqueArray(
    fc.oneof(
      fc.constant('peanut'),
      fc.constant('gluten'),
      fc.constant('dairy'),
      fc.constant('soy'),
      fc.constant('shellfish'),
      fc.constant('egg'),
      fc.constant('tree_nut')
    ),
    { maxLength: 4 }
  ),
});

const fanGroupMemberArb: fc.Arbitrary<FanGroupMember> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  accessibilityProfile: accessibilityProfileArb,
});

const fanGroupArb = (minSize = 1, maxSize = 5): fc.Arbitrary<FanGroupMember[]> =>
  fc.array(fanGroupMemberArb, { minLength: minSize, maxLength: maxSize });

const zoneTypeArb: fc.Arbitrary<ZoneType> = fc.oneof(
  fc.constant('gate' as ZoneType),
  fc.constant('concourse' as ZoneType),
  fc.constant('seating_section' as ZoneType),
  fc.constant('concession_area' as ZoneType),
  fc.constant('restroom_cluster' as ZoneType),
  fc.constant('medical_area' as ZoneType),
  fc.constant('family_section' as ZoneType),
  fc.constant('accessible_seating' as ZoneType),
  fc.constant('service_corridor' as ZoneType),
  fc.constant('loading_dock' as ZoneType),
  fc.constant('smoking_area' as ZoneType),
  fc.constant('cooling_zone' as ZoneType),
  fc.constant('prayer_area' as ZoneType)
);

function makeTestZone(overrides: Partial<Zone> = {}): Zone {
  return {
    id: 'zone-1',
    name: 'Test Zone',
    type: 'concourse',
    allegiance: 'neutral',
    capacity: 1000,
    currentDensity: 30,
    lastDensityUpdate: Date.now(),
    accessibilityFeatures: {
      stepFree: true,
      hasRamp: true,
      hasElevator: false,
      hasTactileIndicators: false,
      hasHandrails: true,
      hasRestArea: false,
      wideCorridors: true,
      maxGradient: 3,
      hasWallFollowingPath: false,
    },
    noiseLevel: 'low',
    sensoryTriggers: [],
    isSunExposed: false,
    isIndoor: true,
    facilities: [],
    position: { x: 0, y: 0 },
    shape: { type: 'rect', data: '' },
    ...overrides,
  };
}

function makeTestConstraints(overrides: Partial<RouteConstraints> = {}): RouteConstraints {
  return {
    stepFreeRequired: false,
    maxEdgeDistance: 2000,
    avoidHighDensity: false,
    avoidZoneTypes: [],
    excludeAllegiance: [],
    preferQuiet: false,
    isSOS: false,
    ...overrides,
  };
}

// --- Property 11: Group Constraint Merge Monotonicity ---
// Feature: smart-stadium-fan-navigator, Property 11: Group Constraint Merge Monotonicity
// Validates: Requirements 4.2, 4.3

describe('Property 11: Group Constraint Merge Monotonicity', () => {
  it('merged set is at least as restrictive as any individual profile', () => {
    fc.assert(
      fc.property(fanGroupArb(1, 5), (members) => {
        const merged = mergeProfiles(members);

        for (const member of members) {
          const profile = member.accessibilityProfile;

          // stepFreeRequired: merged >= individual need
          // If individual needs step-free (wheelchair, limited_mobility, or avoidStairs), merged must too
          const individualNeedsStepFree =
            profile.avoidStairs ||
            profile.categories.includes('wheelchair') ||
            profile.categories.includes('limited_mobility');
          if (individualNeedsStepFree) {
            expect(merged.stepFreeRequired).toBe(true);
          }

          // maxWalkingDistance: merged <= individual (more restrictive means smaller)
          if (profile.maxWalkingDistance !== undefined) {
            expect(merged.maxWalkingDistance).toBeLessThanOrEqual(
              profile.maxWalkingDistance
            );
          }

          // avoidCrowds: merged >= individual (true if any member needs it)
          if (profile.avoidCrowds) {
            expect(merged.avoidCrowds).toBe(true);
          }

          // preferQuiet: merged >= individual (true if any member needs it)
          if (profile.preferQuiet) {
            expect(merged.preferQuiet).toBe(true);
          }

          // allergens: every individual allergen present in merged set
          for (const allergen of profile.allergens) {
            expect(merged.allergens).toContain(allergen);
          }

          // hasChild: true if individual has child_accompanied
          if (profile.categories.includes('child_accompanied')) {
            expect(merged.hasChild).toBe(true);
          }

          // hasPregnant: true if individual has pregnant
          if (profile.categories.includes('pregnant')) {
            expect(merged.hasPregnant).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 13: Constraint Priority Ordering ---
// Feature: smart-stadium-fan-navigator, Property 13: Constraint Priority Ordering
// Validates: Requirements 3.25

describe('Property 13: Constraint Priority Ordering', () => {
  it('safety constraints block zones regardless of comfort preferences', () => {
    fc.assert(
      fc.property(
        // Generate random comfort preferences
        fc.boolean(), // preferQuiet
        fc.boolean(), // avoidHighDensity
        // Generate allegiance for the zone that conflicts
        fc.oneof(fc.constant('home' as const), fc.constant('away' as const)),
        (preferQuiet, avoidHighDensity, opposingAllegiance) => {
          // Create a zone with the opposing allegiance
          const zone = makeTestZone({ allegiance: opposingAllegiance });

          // Build constraints that exclude the opposing allegiance (safety constraint)
          // but have various comfort settings
          const constraints = makeTestConstraints({
            excludeAllegiance: [opposingAllegiance],
            preferQuiet,
            avoidHighDensity,
          });

          // Safety constraint should ALWAYS block the zone, regardless of comfort
          expect(isZoneAllowed(zone, constraints)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('zone type exclusion (child safety) blocks zones regardless of comfort preferences', () => {
    fc.assert(
      fc.property(
        // Generate random comfort preferences
        fc.boolean(), // preferQuiet
        fc.boolean(), // avoidHighDensity
        // Generate a child-unsafe zone type
        fc.oneof(
          fc.constant('smoking_area' as ZoneType),
          fc.constant('loading_dock' as ZoneType),
          fc.constant('service_corridor' as ZoneType)
        ),
        (preferQuiet, avoidHighDensity, unsafeZoneType) => {
          // Create a zone with the unsafe type
          const zone = makeTestZone({ type: unsafeZoneType });

          // Build constraints that exclude child-unsafe zones but have varied comfort settings
          const constraints = makeTestConstraints({
            avoidZoneTypes: ['smoking_area', 'loading_dock', 'service_corridor'],
            preferQuiet,
            avoidHighDensity,
          });

          // Safety/physical access constraint should ALWAYS block the zone
          expect(isZoneAllowed(zone, constraints)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('comfort preferences alone do not block zones via isZoneAllowed', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // preferQuiet
        fc.boolean(), // avoidHighDensity
        zoneTypeArb,
        (preferQuiet, avoidHighDensity, zoneType) => {
          // Only test zone types that are NOT in the exclusion list
          // (i.e., zones that should be allowed when no safety constraints active)
          const zone = makeTestZone({
            type: zoneType,
            allegiance: 'neutral',
            noiseLevel: 'high',
            sensoryTriggers: ['fireworks', 'dj_booth'],
          });

          // No safety exclusions — only comfort preferences
          const constraints = makeTestConstraints({
            excludeAllegiance: [],
            avoidZoneTypes: [], // No zone type exclusions
            preferQuiet,
            avoidHighDensity,
          });

          // Comfort preferences alone should NOT block a zone via isZoneAllowed
          // (they only add weight penalties in getEdgeWeight)
          expect(isZoneAllowed(zone, constraints)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// --- Property 25: Constraint Conflict Identification ---
// Feature: smart-stadium-fan-navigator, Property 25: Constraint Conflict Identification
// Validates: Requirements 12.6

describe('Property 25: Constraint Conflict Identification', () => {
  it('identifies conflicts when members have very restrictive walking distances', () => {
    fc.assert(
      fc.property(
        // Generate 2-5 members with very restrictive walking distances (<50m)
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 10 }),
            accessibilityProfile: fc.record({
              categories: fc.constant([] as AccessibilityCategory[]),
              hasCompanion: fc.boolean(),
              maxWalkingDistance: fc.integer({ min: 10, max: 49 }),
              avoidStairs: fc.boolean(),
              avoidCrowds: fc.boolean(),
              preferQuiet: fc.boolean(),
              allergens: fc.constant([] as string[]),
            }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (members) => {
          const conflicts = identifyConflicts(members);
          // With maxWalkingDistance < 50m, at least one walking distance conflict should be detected
          expect(conflicts.length).toBeGreaterThan(0);
          const hasWalkingConflict = conflicts.some(
            (c) => c.constraint === 'maxWalkingDistance'
          );
          expect(hasWalkingConflict).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('no walking distance conflicts when all members have relaxed distances', () => {
    fc.assert(
      fc.property(
        // Generate 2-5 members with relaxed walking distances (>200m)
        fc.array(
          fc.record({
            id: fc.uuid(),
            name: fc.string({ minLength: 1, maxLength: 10 }),
            accessibilityProfile: fc.record({
              categories: fc.constant([] as AccessibilityCategory[]),
              hasCompanion: fc.boolean(),
              maxWalkingDistance: fc.integer({ min: 201, max: 2000 }),
              avoidStairs: fc.boolean(),
              avoidCrowds: fc.boolean(),
              preferQuiet: fc.boolean(),
              allergens: fc.constant([] as string[]),
            }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (members) => {
          const conflicts = identifyConflicts(members);
          // No walking distance conflicts when all members have > 200m
          const hasWalkingConflict = conflicts.some(
            (c) => c.constraint === 'maxWalkingDistance'
          );
          expect(hasWalkingConflict).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
