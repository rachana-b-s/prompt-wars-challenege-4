/**
 * Unit tests for accessibility-specific routing constraints.
 *
 * Tests the helper functions that augment base RouteConstraints
 * with category-specific routing preferences.
 *
 * Requirements: 3.12–3.21, 17.4
 */

import { describe, it, expect } from 'vitest';
import {
  applyPregnancyConstraints,
  applySensoryConstraints,
  applyChildConstraints,
  applyBlindConstraints,
  validatePregnancyRestroomProximity,
  blindEdgePreference,
  blindZonePreference,
  getNoiseZonePenalty,
  isChildFriendlyZone,
  CONSTANTS,
} from './accessibility-constraints';
import { buildRouteConstraints } from './constraint-solver';
import type { RouteConstraints } from '@/types/route';
import type { StadiumGraph, Zone, GraphEdge } from '@/types/stadium';
import type { Facility } from '@/types/facility';
import type { AccessibilityProfile } from '@/types/fan';

// --- Test Helpers ---

function makeBaseConstraints(overrides: Partial<RouteConstraints> = {}): RouteConstraints {
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

function makeProfile(overrides: Partial<AccessibilityProfile> = {}): AccessibilityProfile {
  return {
    categories: [],
    hasCompanion: false,
    avoidStairs: false,
    avoidCrowds: false,
    preferQuiet: false,
    allergens: [],
    ...overrides,
  };
}

function makeZone(overrides: Partial<Zone> = {}): Zone {
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
      hasHandrails: false,
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

function makeEdge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: 'edge-1',
    source: 'zone-1',
    target: 'zone-2',
    distance: 100,
    bidirectional: true,
    accessibility: {
      stepFree: true,
      hasStairs: false,
      hasEscalator: false,
      hasRamp: true,
      hasElevator: false,
      width: 2.5,
      gradient: 2,
      hasTactileIndicators: false,
      hasHandrails: false,
      maxUninterruptedDistance: 100,
    },
    type: 'corridor',
    ...overrides,
  };
}

function makeSimpleGraph(zones: Zone[], edges: GraphEdge[]): StadiumGraph {
  return {
    zones,
    edges,
    metadata: {
      name: 'Test Stadium',
      capacity: 80000,
      zoneCount: zones.length,
      lastUpdated: new Date().toISOString(),
    },
  };
}

// --- applyPregnancyConstraints Tests ---

describe('applyPregnancyConstraints', () => {
  it('sets stepFreeRequired to true', () => {
    const base = makeBaseConstraints({ stepFreeRequired: false });
    const result = applyPregnancyConstraints(base);
    expect(result.stepFreeRequired).toBe(true);
  });

  it('limits maxEdgeDistance to 150m', () => {
    const base = makeBaseConstraints({ maxEdgeDistance: 2000 });
    const result = applyPregnancyConstraints(base);
    expect(result.maxEdgeDistance).toBe(CONSTANTS.PREGNANCY_MAX_EDGE_DISTANCE);
  });

  it('preserves existing maxEdgeDistance if already smaller than 150m', () => {
    const base = makeBaseConstraints({ maxEdgeDistance: 100 });
    const result = applyPregnancyConstraints(base);
    expect(result.maxEdgeDistance).toBe(100);
  });

  it('preserves other constraint fields', () => {
    const base = makeBaseConstraints({
      avoidHighDensity: true,
      excludeAllegiance: ['away'],
      preferQuiet: true,
    });
    const result = applyPregnancyConstraints(base);
    expect(result.avoidHighDensity).toBe(true);
    expect(result.excludeAllegiance).toEqual(['away']);
    expect(result.preferQuiet).toBe(true);
    expect(result.isSOS).toBe(false);
  });
});

// --- applySensoryConstraints Tests ---

describe('applySensoryConstraints', () => {
  it('sets preferQuiet to true', () => {
    const base = makeBaseConstraints({ preferQuiet: false });
    const result = applySensoryConstraints(base);
    expect(result.preferQuiet).toBe(true);
  });

  it('adds smoking_area to avoidZoneTypes', () => {
    const base = makeBaseConstraints({ avoidZoneTypes: [] });
    const result = applySensoryConstraints(base);
    expect(result.avoidZoneTypes).toContain('smoking_area');
  });

  it('does not duplicate smoking_area if already present', () => {
    const base = makeBaseConstraints({ avoidZoneTypes: ['smoking_area'] });
    const result = applySensoryConstraints(base);
    const count = result.avoidZoneTypes.filter((z) => z === 'smoking_area').length;
    expect(count).toBe(1);
  });

  it('preserves existing avoidZoneTypes', () => {
    const base = makeBaseConstraints({ avoidZoneTypes: ['loading_dock'] });
    const result = applySensoryConstraints(base);
    expect(result.avoidZoneTypes).toContain('loading_dock');
    expect(result.avoidZoneTypes).toContain('smoking_area');
  });
});

// --- applyChildConstraints Tests ---

describe('applyChildConstraints', () => {
  it('adds child-unsafe zone types to avoidZoneTypes', () => {
    const base = makeBaseConstraints({ avoidZoneTypes: [] });
    const result = applyChildConstraints(base);
    expect(result.avoidZoneTypes).toContain('smoking_area');
    expect(result.avoidZoneTypes).toContain('loading_dock');
    expect(result.avoidZoneTypes).toContain('service_corridor');
  });

  it('limits maxEdgeDistance to 500m', () => {
    const base = makeBaseConstraints({ maxEdgeDistance: 2000 });
    const result = applyChildConstraints(base);
    expect(result.maxEdgeDistance).toBe(CONSTANTS.CHILD_MAX_TOTAL_DISTANCE);
  });

  it('preserves existing maxEdgeDistance if already smaller than 500m', () => {
    const base = makeBaseConstraints({ maxEdgeDistance: 200 });
    const result = applyChildConstraints(base);
    expect(result.maxEdgeDistance).toBe(200);
  });

  it('does not duplicate zone types already present', () => {
    const base = makeBaseConstraints({
      avoidZoneTypes: ['smoking_area', 'loading_dock'],
    });
    const result = applyChildConstraints(base);
    const smokingCount = result.avoidZoneTypes.filter((z) => z === 'smoking_area').length;
    const loadingCount = result.avoidZoneTypes.filter((z) => z === 'loading_dock').length;
    expect(smokingCount).toBe(1);
    expect(loadingCount).toBe(1);
    expect(result.avoidZoneTypes).toContain('service_corridor');
  });
});

// --- applyBlindConstraints Tests ---

describe('applyBlindConstraints', () => {
  it('returns constraints unchanged when companion present', () => {
    const base = makeBaseConstraints({ preferQuiet: true, maxEdgeDistance: 300 });
    const result = applyBlindConstraints(base, true);
    expect(result).toEqual(base);
  });

  it('preserves existing constraints without companion', () => {
    const base = makeBaseConstraints({
      stepFreeRequired: true,
      avoidHighDensity: true,
    });
    const result = applyBlindConstraints(base, false);
    expect(result.stepFreeRequired).toBe(true);
    expect(result.avoidHighDensity).toBe(true);
  });
});

// --- validatePregnancyRestroomProximity Tests ---

describe('validatePregnancyRestroomProximity', () => {
  it('returns true for empty path', () => {
    const graph = makeSimpleGraph([], []);
    expect(validatePregnancyRestroomProximity([], graph, [])).toBe(true);
  });

  it('returns false when no restrooms exist', () => {
    const zones = [makeZone({ id: 'z1' }), makeZone({ id: 'z2' })];
    const edges: GraphEdge[] = [
      makeEdge({ id: 'e1', source: 'z1', target: 'z2' }),
    ];
    const graph = makeSimpleGraph(zones, edges);
    expect(validatePregnancyRestroomProximity(['z1', 'z2'], graph, [])).toBe(false);
  });

  it('returns true when zone itself contains a restroom', () => {
    const zones = [makeZone({ id: 'z1' }), makeZone({ id: 'z2' })];
    const edges: GraphEdge[] = [
      makeEdge({ id: 'e1', source: 'z1', target: 'z2' }),
    ];
    const graph = makeSimpleGraph(zones, edges);
    const facilities: Facility[] = [
      {
        id: 'f1',
        name: 'Restroom A',
        type: 'restroom_standard',
        zone: 'z1',
        status: 'open',
        accessibility: { wheelchairAccessible: true, hasSignLanguageSupport: false, hasBrailleSignage: false, familyFriendly: false },
        queueEstimate: 2,
        attributes: {},
      },
      {
        id: 'f2',
        name: 'Restroom B',
        type: 'restroom_accessible',
        zone: 'z2',
        status: 'open',
        accessibility: { wheelchairAccessible: true, hasSignLanguageSupport: false, hasBrailleSignage: false, familyFriendly: false },
        queueEstimate: 3,
        attributes: {},
      },
    ];
    expect(validatePregnancyRestroomProximity(['z1', 'z2'], graph, facilities)).toBe(true);
  });

  it('returns true when zone is within 2 hops of a restroom', () => {
    const zones = [
      makeZone({ id: 'z1' }),
      makeZone({ id: 'z2' }),
      makeZone({ id: 'z3' }),
    ];
    const edges: GraphEdge[] = [
      makeEdge({ id: 'e1', source: 'z1', target: 'z2' }),
      makeEdge({ id: 'e2', source: 'z2', target: 'z3' }),
    ];
    const graph = makeSimpleGraph(zones, edges);
    // Restroom in z1 — z3 is 2 hops away
    const facilities: Facility[] = [
      {
        id: 'f1',
        name: 'Restroom A',
        type: 'restroom_family',
        zone: 'z1',
        status: 'open',
        accessibility: { wheelchairAccessible: true, hasSignLanguageSupport: false, hasBrailleSignage: false, familyFriendly: true },
        queueEstimate: 1,
        attributes: {},
      },
    ];
    expect(validatePregnancyRestroomProximity(['z1', 'z2', 'z3'], graph, facilities)).toBe(true);
  });

  it('returns false when zone is more than 2 hops from a restroom', () => {
    const zones = [
      makeZone({ id: 'z1' }),
      makeZone({ id: 'z2' }),
      makeZone({ id: 'z3' }),
      makeZone({ id: 'z4' }),
    ];
    const edges: GraphEdge[] = [
      makeEdge({ id: 'e1', source: 'z1', target: 'z2' }),
      makeEdge({ id: 'e2', source: 'z2', target: 'z3' }),
      makeEdge({ id: 'e3', source: 'z3', target: 'z4' }),
    ];
    const graph = makeSimpleGraph(zones, edges);
    // Restroom only in z1 — z4 is 3 hops away (exceeds limit of 2)
    const facilities: Facility[] = [
      {
        id: 'f1',
        name: 'Restroom A',
        type: 'restroom_standard',
        zone: 'z1',
        status: 'open',
        accessibility: { wheelchairAccessible: true, hasSignLanguageSupport: false, hasBrailleSignage: false, familyFriendly: false },
        queueEstimate: 2,
        attributes: {},
      },
    ];
    expect(validatePregnancyRestroomProximity(['z1', 'z2', 'z3', 'z4'], graph, facilities)).toBe(false);
  });

  it('handles multiple restrooms — uses nearest', () => {
    const zones = [
      makeZone({ id: 'z1' }),
      makeZone({ id: 'z2' }),
      makeZone({ id: 'z3' }),
      makeZone({ id: 'z4' }),
      makeZone({ id: 'z5' }),
    ];
    const edges: GraphEdge[] = [
      makeEdge({ id: 'e1', source: 'z1', target: 'z2' }),
      makeEdge({ id: 'e2', source: 'z2', target: 'z3' }),
      makeEdge({ id: 'e3', source: 'z3', target: 'z4' }),
      makeEdge({ id: 'e4', source: 'z4', target: 'z5' }),
    ];
    const graph = makeSimpleGraph(zones, edges);
    // Restrooms in z1 and z5: z3 is 2 hops from both
    const facilities: Facility[] = [
      {
        id: 'f1',
        name: 'Restroom A',
        type: 'restroom_standard',
        zone: 'z1',
        status: 'open',
        accessibility: { wheelchairAccessible: true, hasSignLanguageSupport: false, hasBrailleSignage: false, familyFriendly: false },
        queueEstimate: 2,
        attributes: {},
      },
      {
        id: 'f2',
        name: 'Restroom B',
        type: 'restroom_gender_neutral',
        zone: 'z5',
        status: 'open',
        accessibility: { wheelchairAccessible: true, hasSignLanguageSupport: false, hasBrailleSignage: false, familyFriendly: false },
        queueEstimate: 1,
        attributes: {},
      },
    ];
    // All zones are within 2 hops of at least one restroom
    expect(validatePregnancyRestroomProximity(['z1', 'z2', 'z3', 'z4', 'z5'], graph, facilities)).toBe(true);
  });
});

// --- blindEdgePreference Tests ---

describe('blindEdgePreference', () => {
  it('returns 0 for edge with no accessibility features (no companion)', () => {
    const edge = makeEdge();
    expect(blindEdgePreference(edge, false)).toBe(0);
  });

  it('returns 3 for edge with tactile indicators (no companion)', () => {
    const edge = makeEdge({
      accessibility: { ...makeEdge().accessibility, hasTactileIndicators: true },
    });
    expect(blindEdgePreference(edge, false)).toBe(3);
  });

  it('returns 2 for edge with handrails (no companion)', () => {
    const edge = makeEdge({
      accessibility: { ...makeEdge().accessibility, hasHandrails: true },
    });
    expect(blindEdgePreference(edge, false)).toBe(2);
  });

  it('returns 5 for edge with both tactile and handrails (no companion)', () => {
    const edge = makeEdge({
      accessibility: {
        ...makeEdge().accessibility,
        hasTactileIndicators: true,
        hasHandrails: true,
      },
    });
    expect(blindEdgePreference(edge, false)).toBe(5);
  });

  it('returns 1 for edge with tactile indicators (with companion)', () => {
    const edge = makeEdge({
      accessibility: { ...makeEdge().accessibility, hasTactileIndicators: true },
    });
    expect(blindEdgePreference(edge, true)).toBe(1);
  });

  it('returns 0 for edge without tactile indicators (with companion)', () => {
    const edge = makeEdge({
      accessibility: { ...makeEdge().accessibility, hasHandrails: true },
    });
    expect(blindEdgePreference(edge, true)).toBe(0);
  });
});

// --- blindZonePreference Tests ---

describe('blindZonePreference', () => {
  it('returns 0 for zone with no features (with companion)', () => {
    const zone = makeZone();
    expect(blindZonePreference(zone, true)).toBe(0);
  });

  it('returns 0 for zone with features (with companion)', () => {
    const zone = makeZone({
      accessibilityFeatures: {
        ...makeZone().accessibilityFeatures,
        hasTactileIndicators: true,
        hasHandrails: true,
        hasWallFollowingPath: true,
      },
    });
    expect(blindZonePreference(zone, true)).toBe(0);
  });

  it('returns positive score for zone with tactile indicators (no companion)', () => {
    const zone = makeZone({
      accessibilityFeatures: {
        ...makeZone().accessibilityFeatures,
        hasTactileIndicators: true,
      },
    });
    expect(blindZonePreference(zone, false)).toBe(2);
  });

  it('returns positive score for zone with handrails (no companion)', () => {
    const zone = makeZone({
      accessibilityFeatures: {
        ...makeZone().accessibilityFeatures,
        hasHandrails: true,
      },
    });
    expect(blindZonePreference(zone, false)).toBe(2);
  });

  it('returns positive score for zone with wall-following path (no companion)', () => {
    const zone = makeZone({
      accessibilityFeatures: {
        ...makeZone().accessibilityFeatures,
        hasWallFollowingPath: true,
      },
    });
    expect(blindZonePreference(zone, false)).toBe(2);
  });

  it('sums all features for max score (no companion)', () => {
    const zone = makeZone({
      accessibilityFeatures: {
        ...makeZone().accessibilityFeatures,
        hasTactileIndicators: true,
        hasHandrails: true,
        hasWallFollowingPath: true,
      },
    });
    expect(blindZonePreference(zone, false)).toBe(6);
  });

  it('penalizes high noise zones (no companion)', () => {
    const zone = makeZone({
      noiseLevel: 'high',
      accessibilityFeatures: {
        ...makeZone().accessibilityFeatures,
        hasTactileIndicators: true,
      },
    });
    // +2 (tactile) - 1 (high noise) = 1
    expect(blindZonePreference(zone, false)).toBe(1);
  });
});

// --- getNoiseZonePenalty Tests ---

describe('getNoiseZonePenalty', () => {
  it('returns 1.0 for low noise zone with no triggers', () => {
    const zone = makeZone({ noiseLevel: 'low', sensoryTriggers: [] });
    expect(getNoiseZonePenalty(zone)).toBe(1.0);
  });

  it('returns 1.5 for medium noise zone', () => {
    const zone = makeZone({ noiseLevel: 'medium', sensoryTriggers: [] });
    expect(getNoiseZonePenalty(zone)).toBe(1.5);
  });

  it('returns 3.0 for high noise zone', () => {
    const zone = makeZone({ noiseLevel: 'high', sensoryTriggers: [] });
    expect(getNoiseZonePenalty(zone)).toBe(3.0);
  });

  it('adds 1.0 per sensory trigger', () => {
    const zone = makeZone({
      noiseLevel: 'low',
      sensoryTriggers: ['fireworks', 'dj_booth'],
    });
    expect(getNoiseZonePenalty(zone)).toBe(3.0); // 1.0 + 2*1.0
  });

  it('combines noise level and sensory trigger penalties', () => {
    const zone = makeZone({
      noiseLevel: 'high',
      sensoryTriggers: ['fireworks', 'large_screen_flash', 'pyrotechnics'],
    });
    expect(getNoiseZonePenalty(zone)).toBe(6.0); // 3.0 + 3*1.0
  });
});

// --- isChildFriendlyZone Tests ---

describe('isChildFriendlyZone', () => {
  it('returns true for family_section zone', () => {
    const zone = makeZone({ type: 'family_section' });
    expect(isChildFriendlyZone(zone)).toBe(true);
  });

  it('returns false for non-family zone types', () => {
    const zone = makeZone({ type: 'concourse' });
    expect(isChildFriendlyZone(zone)).toBe(false);
  });

  it('returns false for gate zone', () => {
    const zone = makeZone({ type: 'gate' });
    expect(isChildFriendlyZone(zone)).toBe(false);
  });
});

// --- Integration with buildRouteConstraints ---

describe('buildRouteConstraints accessibility integration', () => {
  it('applies pregnancy constraints when pregnant category is set', () => {
    const profile = makeProfile({ categories: ['pregnant'] });
    const result = buildRouteConstraints(profile, 'neutral');
    expect(result.stepFreeRequired).toBe(true);
    expect(result.maxEdgeDistance).toBe(CONSTANTS.PREGNANCY_MAX_EDGE_DISTANCE);
  });

  it('applies sensory constraints when neurodivergent category is set', () => {
    const profile = makeProfile({ categories: ['neurodivergent'] });
    const result = buildRouteConstraints(profile, 'neutral');
    expect(result.preferQuiet).toBe(true);
    expect(result.avoidZoneTypes).toContain('smoking_area');
  });

  it('applies child constraints when child_accompanied is set', () => {
    const profile = makeProfile({ categories: ['child_accompanied'] });
    const result = buildRouteConstraints(profile, 'neutral');
    expect(result.avoidZoneTypes).toContain('smoking_area');
    expect(result.avoidZoneTypes).toContain('loading_dock');
    expect(result.avoidZoneTypes).toContain('service_corridor');
    expect(result.maxEdgeDistance).toBe(CONSTANTS.CHILD_MAX_TOTAL_DISTANCE);
  });

  it('applies blind constraints when blind category is set', () => {
    const profile = makeProfile({ categories: ['blind'], hasCompanion: false });
    const result = buildRouteConstraints(profile, 'neutral');
    // Blind constraints don't change hard constraints, just preference scoring
    expect(result.isSOS).toBe(false);
  });

  it('deaf/HoH categories do not change routing constraints', () => {
    const profileDeaf = makeProfile({ categories: ['deaf'] });
    const profileHoH = makeProfile({ categories: ['hard_of_hearing'] });
    const profileNone = makeProfile({});

    const resultDeaf = buildRouteConstraints(profileDeaf, 'neutral');
    const resultHoH = buildRouteConstraints(profileHoH, 'neutral');
    const resultNone = buildRouteConstraints(profileNone, 'neutral');

    // Deaf/HoH should produce identical routing constraints to no categories
    expect(resultDeaf).toEqual(resultNone);
    expect(resultHoH).toEqual(resultNone);
  });

  it('combines multiple categories correctly (pregnant + child)', () => {
    const profile = makeProfile({
      categories: ['pregnant', 'child_accompanied'],
    });
    const result = buildRouteConstraints(profile, 'neutral');
    expect(result.stepFreeRequired).toBe(true);
    // Pregnancy max (150) is more restrictive than child max (500)
    expect(result.maxEdgeDistance).toBe(CONSTANTS.PREGNANCY_MAX_EDGE_DISTANCE);
    expect(result.avoidZoneTypes).toContain('smoking_area');
    expect(result.avoidZoneTypes).toContain('loading_dock');
    expect(result.avoidZoneTypes).toContain('service_corridor');
  });

  it('combines sensory + child constraints', () => {
    const profile = makeProfile({
      categories: ['neurodivergent', 'child_accompanied'],
    });
    const result = buildRouteConstraints(profile, 'neutral');
    expect(result.preferQuiet).toBe(true);
    expect(result.avoidZoneTypes).toContain('smoking_area');
    expect(result.avoidZoneTypes).toContain('loading_dock');
    expect(result.avoidZoneTypes).toContain('service_corridor');
    expect(result.maxEdgeDistance).toBe(CONSTANTS.CHILD_MAX_TOTAL_DISTANCE);
  });
});
