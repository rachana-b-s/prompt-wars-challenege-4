/**
 * Unit tests for the constraint solver.
 * Tests core functions: mergeProfiles, isZoneAllowed, isEdgeTraversable,
 * getEdgeWeight, identifyConflicts, buildRouteConstraints, buildGroupRouteConstraints.
 *
 * Requirements: 3.25, 4.2, 4.3, 5.2, 5.3, 5.4, 12.6
 */

import { describe, it, expect } from 'vitest';
import {
  mergeProfiles,
  isZoneAllowed,
  isEdgeTraversable,
  getEdgeWeight,
  identifyConflicts,
  buildRouteConstraints,
  buildGroupRouteConstraints,
} from './constraint-solver';
import type { FanGroupMember, AccessibilityProfile, GroupConstraintSet } from '@/types/fan';
import type { Zone, GraphEdge } from '@/types/stadium';
import type { RouteConstraints } from '@/types/route';
import type { DensityMap } from '@/types/crowd';

// --- Test Helpers ---

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

function makeMember(
  id: string,
  profile: Partial<AccessibilityProfile> = {}
): FanGroupMember {
  return {
    id,
    name: `Member ${id}`,
    accessibilityProfile: makeProfile(profile),
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
      hasHandrails: true,
      maxUninterruptedDistance: 100,
    },
    type: 'corridor',
    ...overrides,
  };
}

function makeConstraints(overrides: Partial<RouteConstraints> = {}): RouteConstraints {
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

// --- mergeProfiles Tests ---

describe('mergeProfiles', () => {
  it('returns default values for empty group', () => {
    const result = mergeProfiles([]);
    expect(result.stepFreeRequired).toBe(false);
    expect(result.maxWalkingDistance).toBe(2000);
    expect(result.avoidStairs).toBe(false);
    expect(result.avoidCrowds).toBe(false);
    expect(result.preferQuiet).toBe(false);
    expect(result.hasChild).toBe(false);
    expect(result.hasPregnant).toBe(false);
    expect(result.excludedZoneTypes).toEqual([]);
    expect(result.allergens).toEqual([]);
  });

  it('sets stepFreeRequired when any member uses wheelchair', () => {
    const members = [
      makeMember('a', { categories: ['wheelchair'] }),
      makeMember('b', {}),
    ];
    const result = mergeProfiles(members);
    expect(result.stepFreeRequired).toBe(true);
  });

  it('sets stepFreeRequired when any member has limited_mobility', () => {
    const members = [
      makeMember('a', { categories: ['limited_mobility'] }),
      makeMember('b', {}),
    ];
    const result = mergeProfiles(members);
    expect(result.stepFreeRequired).toBe(true);
  });

  it('sets stepFreeRequired when any member has avoidStairs', () => {
    const members = [
      makeMember('a', { avoidStairs: true }),
      makeMember('b', {}),
    ];
    const result = mergeProfiles(members);
    expect(result.stepFreeRequired).toBe(true);
  });

  it('uses minimum maxWalkingDistance across all members', () => {
    const members = [
      makeMember('a', { maxWalkingDistance: 500 }),
      makeMember('b', { maxWalkingDistance: 200 }),
      makeMember('c', { maxWalkingDistance: 800 }),
    ];
    const result = mergeProfiles(members);
    expect(result.maxWalkingDistance).toBe(200);
  });

  it('unions allergens from all members', () => {
    const members = [
      makeMember('a', { allergens: ['peanut', 'gluten'] }),
      makeMember('b', { allergens: ['dairy', 'peanut'] }),
    ];
    const result = mergeProfiles(members);
    expect(result.allergens).toHaveLength(3);
    expect(result.allergens).toContain('peanut');
    expect(result.allergens).toContain('gluten');
    expect(result.allergens).toContain('dairy');
  });

  it('sets hasChild when any member has child_accompanied', () => {
    const members = [
      makeMember('a', { categories: ['child_accompanied'] }),
      makeMember('b', {}),
    ];
    const result = mergeProfiles(members);
    expect(result.hasChild).toBe(true);
  });

  it('excludes child-unsafe zones when hasChild is true', () => {
    const members = [
      makeMember('a', { categories: ['child_accompanied'] }),
    ];
    const result = mergeProfiles(members);
    expect(result.excludedZoneTypes).toContain('smoking_area');
    expect(result.excludedZoneTypes).toContain('loading_dock');
    expect(result.excludedZoneTypes).toContain('service_corridor');
  });

  it('sets hasPregnant when any member has pregnant category', () => {
    const members = [
      makeMember('a', { categories: ['pregnant'] }),
      makeMember('b', {}),
    ];
    const result = mergeProfiles(members);
    expect(result.hasPregnant).toBe(true);
  });

  it('weakest-link applies avoidCrowds if ANY member needs it', () => {
    const members = [
      makeMember('a', { avoidCrowds: true }),
      makeMember('b', { avoidCrowds: false }),
    ];
    const result = mergeProfiles(members);
    expect(result.avoidCrowds).toBe(true);
  });

  it('weakest-link applies preferQuiet if ANY member needs it', () => {
    const members = [
      makeMember('a', { preferQuiet: true }),
      makeMember('b', { preferQuiet: false }),
    ];
    const result = mergeProfiles(members);
    expect(result.preferQuiet).toBe(true);
  });
});

// --- isZoneAllowed Tests ---

describe('isZoneAllowed', () => {
  it('allows neutral zone with no constraints', () => {
    const zone = makeZone({ allegiance: 'neutral' });
    const constraints = makeConstraints();
    expect(isZoneAllowed(zone, constraints)).toBe(true);
  });

  it('blocks away zone when excludeAllegiance includes away', () => {
    const zone = makeZone({ allegiance: 'away' });
    const constraints = makeConstraints({ excludeAllegiance: ['away'] });
    expect(isZoneAllowed(zone, constraints)).toBe(false);
  });

  it('blocks home zone when excludeAllegiance includes home', () => {
    const zone = makeZone({ allegiance: 'home' });
    const constraints = makeConstraints({ excludeAllegiance: ['home'] });
    expect(isZoneAllowed(zone, constraints)).toBe(false);
  });

  it('blocks zone with excluded type', () => {
    const zone = makeZone({ type: 'smoking_area' });
    const constraints = makeConstraints({ avoidZoneTypes: ['smoking_area'] });
    expect(isZoneAllowed(zone, constraints)).toBe(false);
  });

  it('blocks service_corridor when child safety constraints active', () => {
    const zone = makeZone({ type: 'service_corridor' });
    const constraints = makeConstraints({
      avoidZoneTypes: ['smoking_area', 'loading_dock', 'service_corridor'],
    });
    expect(isZoneAllowed(zone, constraints)).toBe(false);
  });

  it('allows zone when allegiance matches', () => {
    const zone = makeZone({ allegiance: 'home' });
    const constraints = makeConstraints({ excludeAllegiance: ['away'] });
    expect(isZoneAllowed(zone, constraints)).toBe(true);
  });
});

// --- isEdgeTraversable Tests ---

describe('isEdgeTraversable', () => {
  it('allows step-free edge when step-free is required', () => {
    const edge = makeEdge({ accessibility: { ...makeEdge().accessibility, stepFree: true } });
    const constraints = makeConstraints({ stepFreeRequired: true });
    expect(isEdgeTraversable(edge, constraints)).toBe(true);
  });

  it('blocks non-step-free edge when step-free is required', () => {
    const edge = makeEdge({
      accessibility: { ...makeEdge().accessibility, stepFree: false },
    });
    const constraints = makeConstraints({ stepFreeRequired: true });
    expect(isEdgeTraversable(edge, constraints)).toBe(false);
  });

  it('blocks edge with high gradient when step-free required', () => {
    const edge = makeEdge({
      accessibility: { ...makeEdge().accessibility, stepFree: true, gradient: 12 },
    });
    const constraints = makeConstraints({ stepFreeRequired: true });
    expect(isEdgeTraversable(edge, constraints)).toBe(false);
  });

  it('allows edge with acceptable gradient when step-free required', () => {
    const edge = makeEdge({
      accessibility: { ...makeEdge().accessibility, stepFree: true, gradient: 5 },
    });
    const constraints = makeConstraints({ stepFreeRequired: true });
    expect(isEdgeTraversable(edge, constraints)).toBe(true);
  });

  it('blocks edge exceeding max distance', () => {
    const edge = makeEdge({ distance: 300 });
    const constraints = makeConstraints({ maxEdgeDistance: 200 });
    expect(isEdgeTraversable(edge, constraints)).toBe(false);
  });

  it('allows edge within max distance', () => {
    const edge = makeEdge({ distance: 150 });
    const constraints = makeConstraints({ maxEdgeDistance: 200 });
    expect(isEdgeTraversable(edge, constraints)).toBe(true);
  });

  it('allows any edge when no constraints set', () => {
    const edge = makeEdge({
      accessibility: { ...makeEdge().accessibility, stepFree: false, gradient: 15 },
      distance: 500,
    });
    const constraints = makeConstraints({ stepFreeRequired: false, maxEdgeDistance: 2000 });
    expect(isEdgeTraversable(edge, constraints)).toBe(true);
  });
});

// --- getEdgeWeight Tests ---

describe('getEdgeWeight', () => {
  const emptyDensityMap: DensityMap = {};

  it('returns base distance with no penalties', () => {
    const edge = makeEdge({ distance: 100 });
    const constraints = makeConstraints();
    const zone = makeZone();
    expect(getEdgeWeight(edge, constraints, emptyDensityMap, zone)).toBe(100);
  });

  it('returns Infinity for opposing allegiance zone', () => {
    const edge = makeEdge({ distance: 100 });
    const constraints = makeConstraints({ excludeAllegiance: ['away'] });
    const zone = makeZone({ allegiance: 'away' });
    expect(getEdgeWeight(edge, constraints, emptyDensityMap, zone)).toBe(Infinity);
  });

  it('returns Infinity for excluded zone type', () => {
    const edge = makeEdge({ distance: 100 });
    const constraints = makeConstraints({ avoidZoneTypes: ['smoking_area'] });
    const zone = makeZone({ type: 'smoking_area' });
    expect(getEdgeWeight(edge, constraints, emptyDensityMap, zone)).toBe(Infinity);
  });

  it('applies density penalty for density > 80', () => {
    const edge = makeEdge({ distance: 100 });
    const constraints = makeConstraints({ avoidHighDensity: true });
    const zone = makeZone({ id: 'z1' });
    const densityMap: DensityMap = {
      z1: { zoneId: 'z1', density: 85, lastUpdated: Date.now(), level: 'red' },
    };
    const weight = getEdgeWeight(edge, constraints, densityMap, zone);
    // base (100) + density (100 * 3.0 = 300) = 400
    expect(weight).toBe(400);
  });

  it('applies density penalty for density > 60', () => {
    const edge = makeEdge({ distance: 100 });
    const constraints = makeConstraints({ avoidHighDensity: true });
    const zone = makeZone({ id: 'z1' });
    const densityMap: DensityMap = {
      z1: { zoneId: 'z1', density: 70, lastUpdated: Date.now(), level: 'yellow' },
    };
    const weight = getEdgeWeight(edge, constraints, densityMap, zone);
    // base (100) + density (100 * 1.5 = 150) = 250
    expect(weight).toBe(250);
  });

  it('no density penalty for density <= 60', () => {
    const edge = makeEdge({ distance: 100 });
    const constraints = makeConstraints({ avoidHighDensity: true });
    const zone = makeZone({ id: 'z1' });
    const densityMap: DensityMap = {
      z1: { zoneId: 'z1', density: 50, lastUpdated: Date.now(), level: 'yellow' },
    };
    const weight = getEdgeWeight(edge, constraints, densityMap, zone);
    expect(weight).toBe(100);
  });

  it('applies sensory trigger penalty when preferQuiet', () => {
    const edge = makeEdge({ distance: 100 });
    const constraints = makeConstraints({ preferQuiet: true });
    const zone = makeZone({ sensoryTriggers: ['fireworks'] });
    const weight = getEdgeWeight(edge, constraints, emptyDensityMap, zone);
    // base (100) + sensory penalty (100 * 2.5 = 250) = 350
    expect(weight).toBe(350);
  });

  it('returns base distance in SOS mode ignoring all penalties', () => {
    const edge = makeEdge({ distance: 100 });
    const constraints = makeConstraints({
      isSOS: true,
      excludeAllegiance: ['away'],
      avoidHighDensity: true,
      preferQuiet: true,
    });
    const zone = makeZone({
      id: 'z1',
      allegiance: 'away',
      sensoryTriggers: ['fireworks'],
    });
    const densityMap: DensityMap = {
      z1: { zoneId: 'z1', density: 95, lastUpdated: Date.now(), level: 'red' },
    };
    const weight = getEdgeWeight(edge, constraints, densityMap, zone);
    expect(weight).toBe(100);
  });

  it('combines density and sensory penalties additively', () => {
    const edge = makeEdge({ distance: 100 });
    const constraints = makeConstraints({ avoidHighDensity: true, preferQuiet: true });
    const zone = makeZone({ id: 'z1', sensoryTriggers: ['dj_booth'] });
    const densityMap: DensityMap = {
      z1: { zoneId: 'z1', density: 90, lastUpdated: Date.now(), level: 'red' },
    };
    const weight = getEdgeWeight(edge, constraints, densityMap, zone);
    // base (100) + density (300) + sensory (250) = 650
    expect(weight).toBe(650);
  });
});

// --- identifyConflicts Tests ---

describe('identifyConflicts', () => {
  it('returns empty array for single member', () => {
    const members = [makeMember('a', {})];
    expect(identifyConflicts(members)).toEqual([]);
  });

  it('returns empty array for empty group', () => {
    expect(identifyConflicts([])).toEqual([]);
  });

  it('returns empty array when no conflicts exist', () => {
    const members = [
      makeMember('a', { categories: ['wheelchair'] }),
      makeMember('b', { categories: ['deaf'] }),
    ];
    expect(identifyConflicts(members)).toEqual([]);
  });

  it('detects extremely restrictive walking distance conflict', () => {
    const members = [
      makeMember('a', { maxWalkingDistance: 30 }),
      makeMember('b', { maxWalkingDistance: 40 }),
    ];
    const conflicts = identifyConflicts(members);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].constraint).toBe('maxWalkingDistance');
  });

  it('detects excessive combined allergen restrictions', () => {
    const members = [
      makeMember('a', { allergens: ['peanut', 'gluten', 'dairy'] }),
      makeMember('b', { allergens: ['soy', 'shellfish', 'egg'] }),
    ];
    const conflicts = identifyConflicts(members);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].constraint).toBe('allergens');
  });
});

// --- buildRouteConstraints Tests ---

describe('buildRouteConstraints', () => {
  it('excludes away zones for home fan', () => {
    const profile = makeProfile({});
    const result = buildRouteConstraints(profile, 'home');
    expect(result.excludeAllegiance).toContain('away');
  });

  it('excludes home zones for away fan', () => {
    const profile = makeProfile({});
    const result = buildRouteConstraints(profile, 'away');
    expect(result.excludeAllegiance).toContain('home');
  });

  it('no allegiance exclusions for neutral fan', () => {
    const profile = makeProfile({});
    const result = buildRouteConstraints(profile, 'neutral');
    expect(result.excludeAllegiance).toEqual([]);
  });

  it('sets stepFreeRequired for wheelchair users', () => {
    const profile = makeProfile({ categories: ['wheelchair'] });
    const result = buildRouteConstraints(profile, 'neutral');
    expect(result.stepFreeRequired).toBe(true);
  });

  it('adds child-unsafe zones to avoidZoneTypes for child accompaniment', () => {
    const profile = makeProfile({ categories: ['child_accompanied'] });
    const result = buildRouteConstraints(profile, 'neutral');
    expect(result.avoidZoneTypes).toContain('smoking_area');
    expect(result.avoidZoneTypes).toContain('loading_dock');
    expect(result.avoidZoneTypes).toContain('service_corridor');
  });

  it('uses maxWalkingDistance from profile', () => {
    const profile = makeProfile({ maxWalkingDistance: 300 });
    const result = buildRouteConstraints(profile, 'neutral');
    expect(result.maxEdgeDistance).toBe(300);
  });

  it('uses default max distance when not specified', () => {
    const profile = makeProfile({});
    const result = buildRouteConstraints(profile, 'neutral');
    expect(result.maxEdgeDistance).toBe(2000);
  });

  it('sets isSOS to false by default', () => {
    const profile = makeProfile({});
    const result = buildRouteConstraints(profile, 'neutral');
    expect(result.isSOS).toBe(false);
  });
});

// --- buildGroupRouteConstraints Tests ---

describe('buildGroupRouteConstraints', () => {
  it('maps GroupConstraintSet to RouteConstraints correctly', () => {
    const constraintSet: GroupConstraintSet = {
      stepFreeRequired: true,
      maxWalkingDistance: 300,
      avoidStairs: true,
      avoidCrowds: true,
      preferQuiet: true,
      excludedZoneTypes: ['smoking_area', 'loading_dock'],
      excludedAllegiances: ['away'],
      allergens: ['peanut'],
      hasChild: true,
      hasPregnant: false,
    };
    const result = buildGroupRouteConstraints(constraintSet);
    expect(result.stepFreeRequired).toBe(true);
    expect(result.maxEdgeDistance).toBe(300);
    expect(result.avoidHighDensity).toBe(true);
    expect(result.avoidZoneTypes).toEqual(['smoking_area', 'loading_dock']);
    expect(result.excludeAllegiance).toEqual(['away']);
    expect(result.preferQuiet).toBe(true);
    expect(result.isSOS).toBe(false);
  });
});
