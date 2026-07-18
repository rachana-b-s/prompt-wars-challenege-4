/**
 * Unit tests for the A* route engine.
 * Tests: computeRoute, computeGroupRoute, findAlternatives, computeSOSRoute.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 5.2, 5.3, 15.6
 */

import { describe, it, expect } from 'vitest';
import { computeRoute, computeGroupRoute, findAlternatives, computeSOSRoute } from './route-engine';
import type { StadiumGraph, Zone, GraphEdge } from '@/types/stadium';
import type { RouteRequest, GroupRouteRequest } from '@/types/route';
import type { DensityMap } from '@/types/crowd';
import type { FanProfile, FanGroup } from '@/types/fan';

// --- Test Helpers ---

function makeZone(id: string, overrides: Partial<Zone> = {}): Zone {
  return {
    id,
    name: `Zone ${id}`,
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

function makeEdge(
  id: string,
  source: string,
  target: string,
  distance: number,
  overrides: Partial<GraphEdge> = {}
): GraphEdge {
  return {
    id,
    source,
    target,
    distance,
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
      maxUninterruptedDistance: distance,
    },
    type: 'corridor',
    ...overrides,
  };
}

function makeProfile(): FanProfile {
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
  };
}

/**
 * Simple linear graph: A -> B -> C -> D
 * Each zone positioned along x-axis for predictable heuristic.
 */
function makeLinearGraph(): StadiumGraph {
  return {
    zones: [
      makeZone('A', { position: { x: 0, y: 0 } }),
      makeZone('B', { position: { x: 100, y: 0 } }),
      makeZone('C', { position: { x: 200, y: 0 } }),
      makeZone('D', { position: { x: 300, y: 0 } }),
    ],
    edges: [
      makeEdge('e1', 'A', 'B', 100),
      makeEdge('e2', 'B', 'C', 100),
      makeEdge('e3', 'C', 'D', 100),
    ],
    metadata: { name: 'Test', capacity: 4000, zoneCount: 4, lastUpdated: new Date().toISOString() },
  };
}

/**
 * Diamond graph: A -> B -> D, A -> C -> D
 * B has high density, C is longer but clear.
 */
function makeDiamondGraph(): StadiumGraph {
  return {
    zones: [
      makeZone('A', { position: { x: 0, y: 100 } }),
      makeZone('B', { position: { x: 100, y: 0 } }),
      makeZone('C', { position: { x: 100, y: 200 } }),
      makeZone('D', { position: { x: 200, y: 100 } }),
    ],
    edges: [
      makeEdge('e1', 'A', 'B', 100),
      makeEdge('e2', 'A', 'C', 150),
      makeEdge('e3', 'B', 'D', 100),
      makeEdge('e4', 'C', 'D', 150),
    ],
    metadata: { name: 'Diamond', capacity: 4000, zoneCount: 4, lastUpdated: new Date().toISOString() },
  };
}

const emptyDensityMap: DensityMap = {};

// --- computeRoute Tests ---

describe('computeRoute', () => {
  it('finds a simple route on a linear graph', () => {
    const graph = makeLinearGraph();
    const request: RouteRequest = {
      source: 'A',
      destination: 'D',
      fanProfile: makeProfile(),
    };

    const result = computeRoute(graph, request, emptyDensityMap);

    expect(result.status).toBe('found');
    expect(result.path).toEqual(['A', 'B', 'C', 'D']);
    expect(result.distance).toBe(300);
    expect(result.zonesTraversed).toBe(4);
    expect(result.estimatedTime).toBeGreaterThan(0);
  });

  it('returns source when source equals destination', () => {
    const graph = makeLinearGraph();
    const request: RouteRequest = {
      source: 'A',
      destination: 'A',
      fanProfile: makeProfile(),
    };

    const result = computeRoute(graph, request, emptyDensityMap);

    expect(result.status).toBe('found');
    expect(result.path).toEqual(['A']);
    expect(result.distance).toBe(0);
    expect(result.zonesTraversed).toBe(1);
  });

  it('returns not_found when destination is unreachable', () => {
    // Graph with disconnected node
    const graph: StadiumGraph = {
      zones: [
        makeZone('A', { position: { x: 0, y: 0 } }),
        makeZone('B', { position: { x: 100, y: 0 } }),
        makeZone('C', { position: { x: 200, y: 0 } }), // disconnected
      ],
      edges: [makeEdge('e1', 'A', 'B', 100)],
      metadata: { name: 'Test', capacity: 3000, zoneCount: 3, lastUpdated: new Date().toISOString() },
    };

    const request: RouteRequest = {
      source: 'A',
      destination: 'C',
      fanProfile: makeProfile(),
    };

    const result = computeRoute(graph, request, emptyDensityMap);

    expect(result.status).toBe('not_found');
    expect(result.path).toEqual([]);
    expect(result.nearestReachable).toBe('B'); // B is reachable and nearest to C
  });

  it('avoids zones excluded by allegiance', () => {
    const graph: StadiumGraph = {
      zones: [
        makeZone('A', { position: { x: 0, y: 0 } }),
        makeZone('B', { position: { x: 100, y: 0 }, allegiance: 'away' }),
        makeZone('C', { position: { x: 100, y: 100 } }),
        makeZone('D', { position: { x: 200, y: 0 } }),
      ],
      edges: [
        makeEdge('e1', 'A', 'B', 100),
        makeEdge('e2', 'A', 'C', 150),
        makeEdge('e3', 'B', 'D', 100),
        makeEdge('e4', 'C', 'D', 150),
      ],
      metadata: { name: 'Test', capacity: 4000, zoneCount: 4, lastUpdated: new Date().toISOString() },
    };

    const profile = makeProfile();
    profile.allegiance = 'home'; // should exclude 'away' zones

    const request: RouteRequest = {
      source: 'A',
      destination: 'D',
      fanProfile: profile,
    };

    const result = computeRoute(graph, request, emptyDensityMap);

    expect(result.status).toBe('found');
    expect(result.path).not.toContain('B');
    expect(result.path).toContain('C');
  });

  it('respects step-free constraint by avoiding non-step-free edges', () => {
    const graph: StadiumGraph = {
      zones: [
        makeZone('A', { position: { x: 0, y: 0 } }),
        makeZone('B', { position: { x: 100, y: 0 } }),
        makeZone('C', { position: { x: 100, y: 100 } }),
        makeZone('D', { position: { x: 200, y: 0 } }),
      ],
      edges: [
        makeEdge('e1', 'A', 'B', 100, {
          accessibility: {
            ...makeEdge('', '', '', 0).accessibility,
            stepFree: false, // stairs
          },
        }),
        makeEdge('e2', 'A', 'C', 150),
        makeEdge('e3', 'B', 'D', 100),
        makeEdge('e4', 'C', 'D', 150),
      ],
      metadata: { name: 'Test', capacity: 4000, zoneCount: 4, lastUpdated: new Date().toISOString() },
    };

    const profile = makeProfile();
    profile.accessibilityProfile.categories = ['wheelchair'];

    const request: RouteRequest = {
      source: 'A',
      destination: 'D',
      fanProfile: profile,
    };

    const result = computeRoute(graph, request, emptyDensityMap);

    expect(result.status).toBe('found');
    // Should go A -> C -> D (avoiding the stairs edge e1)
    expect(result.path).toContain('C');
    expect(result.path).not.toContain('B');
  });

  it('applies density penalty for high density zones', () => {
    const graph = makeDiamondGraph();
    const densityMap: DensityMap = {
      B: { zoneId: 'B', density: 90, lastUpdated: Date.now(), level: 'red' },
    };

    const profile = makeProfile();
    profile.accessibilityProfile.avoidCrowds = true;

    const request: RouteRequest = {
      source: 'A',
      destination: 'D',
      fanProfile: profile,
    };

    const result = computeRoute(graph, request, densityMap);

    expect(result.status).toBe('found');
    // Should prefer the C path even though it's longer due to B's high density
    expect(result.path).toContain('C');
  });

  it('generates high_density warning for zones with density > 70', () => {
    const graph = makeLinearGraph();
    const densityMap: DensityMap = {
      B: { zoneId: 'B', density: 75, lastUpdated: Date.now(), level: 'red' },
    };

    const request: RouteRequest = {
      source: 'A',
      destination: 'D',
      fanProfile: makeProfile(),
    };

    const result = computeRoute(graph, request, densityMap);

    expect(result.status).toBe('found');
    expect(result.warnings.some((w) => w.type === 'high_density' && w.zone === 'B')).toBe(true);
  });

  it('generates allegiance_proximity warning when path is adjacent to opposing zone', () => {
    const graph: StadiumGraph = {
      zones: [
        makeZone('A', { position: { x: 0, y: 0 } }),
        makeZone('B', { position: { x: 100, y: 0 } }),
        makeZone('AWAY', { position: { x: 100, y: 50 }, allegiance: 'away' }),
      ],
      edges: [
        makeEdge('e1', 'A', 'B', 100),
        makeEdge('e2', 'B', 'AWAY', 50),
      ],
      metadata: { name: 'Test', capacity: 3000, zoneCount: 3, lastUpdated: new Date().toISOString() },
    };

    const profile = makeProfile();
    profile.allegiance = 'home'; // excludes 'away'

    const request: RouteRequest = {
      source: 'A',
      destination: 'B',
      fanProfile: profile,
    };

    const result = computeRoute(graph, request, emptyDensityMap);

    expect(result.status).toBe('found');
    expect(result.warnings.some((w) => w.type === 'allegiance_proximity')).toBe(true);
  });

  it('adds time multiplier for high density along path', () => {
    const graph = makeLinearGraph();
    const densityMapLow: DensityMap = {};
    const densityMapHigh: DensityMap = {
      B: { zoneId: 'B', density: 85, lastUpdated: Date.now(), level: 'red' },
      C: { zoneId: 'C', density: 85, lastUpdated: Date.now(), level: 'red' },
    };

    const request: RouteRequest = {
      source: 'A',
      destination: 'D',
      fanProfile: makeProfile(),
    };

    const resultLow = computeRoute(graph, request, densityMapLow);
    const resultHigh = computeRoute(graph, request, densityMapHigh);

    // High density should result in longer estimated time
    expect(resultHigh.estimatedTime).toBeGreaterThan(resultLow.estimatedTime);
  });
});

// --- computeGroupRoute Tests ---

describe('computeGroupRoute', () => {
  it('finds a route for a group with merged constraints', () => {
    const graph = makeLinearGraph();
    const group: FanGroup = {
      id: 'group-1',
      members: [
        {
          id: 'm1',
          name: 'Member 1',
          accessibilityProfile: {
            categories: [],
            hasCompanion: false,
            avoidStairs: false,
            avoidCrowds: false,
            preferQuiet: false,
            allergens: [],
          },
        },
      ],
      constraintSet: {
        stepFreeRequired: false,
        maxWalkingDistance: 2000,
        avoidStairs: false,
        avoidCrowds: false,
        preferQuiet: false,
        excludedZoneTypes: [],
        excludedAllegiances: [],
        allergens: [],
        hasChild: false,
        hasPregnant: false,
      },
    };

    const request: GroupRouteRequest = {
      source: 'A',
      destination: 'D',
      group,
    };

    const result = computeGroupRoute(graph, request, emptyDensityMap);

    expect(result.status).toBe('found');
    expect(result.path).toEqual(['A', 'B', 'C', 'D']);
  });

  it('applies step-free constraint when group requires it', () => {
    const graph: StadiumGraph = {
      zones: [
        makeZone('A', { position: { x: 0, y: 0 } }),
        makeZone('B', { position: { x: 100, y: 0 } }),
        makeZone('C', { position: { x: 100, y: 100 } }),
        makeZone('D', { position: { x: 200, y: 0 } }),
      ],
      edges: [
        makeEdge('e1', 'A', 'B', 100, {
          accessibility: {
            ...makeEdge('', '', '', 0).accessibility,
            stepFree: false,
          },
        }),
        makeEdge('e2', 'A', 'C', 150),
        makeEdge('e3', 'B', 'D', 100),
        makeEdge('e4', 'C', 'D', 150),
      ],
      metadata: { name: 'Test', capacity: 4000, zoneCount: 4, lastUpdated: new Date().toISOString() },
    };

    const group: FanGroup = {
      id: 'group-1',
      members: [],
      constraintSet: {
        stepFreeRequired: true,
        maxWalkingDistance: 2000,
        avoidStairs: true,
        avoidCrowds: false,
        preferQuiet: false,
        excludedZoneTypes: [],
        excludedAllegiances: [],
        allergens: [],
        hasChild: false,
        hasPregnant: false,
      },
    };

    const request: GroupRouteRequest = {
      source: 'A',
      destination: 'D',
      group,
    };

    const result = computeGroupRoute(graph, request, emptyDensityMap);

    expect(result.status).toBe('found');
    expect(result.path).toContain('C');
    expect(result.path).not.toContain('B');
  });
});

// --- findAlternatives Tests ---

describe('findAlternatives', () => {
  it('returns alternatives for a graph with multiple paths', () => {
    const graph = makeDiamondGraph();
    const request: RouteRequest = {
      source: 'A',
      destination: 'D',
      fanProfile: makeProfile(),
    };

    const alts = findAlternatives(graph, request, emptyDensityMap, 2);

    // Should find at least 1 alternative
    expect(alts.length).toBeGreaterThanOrEqual(1);
    // Alternative should be different from direct shortest path
    expect(alts[0].status).toBe('found');
    expect(alts[0].path.length).toBeGreaterThan(0);
  });

  it('returns empty array when no alternative exists (linear graph)', () => {
    const graph = makeLinearGraph();
    const request: RouteRequest = {
      source: 'A',
      destination: 'D',
      fanProfile: makeProfile(),
    };

    const alts = findAlternatives(graph, request, emptyDensityMap, 2);

    // Linear graph has only one path, so no distinct alternatives
    expect(alts.length).toBe(0);
  });

  it('returns empty array when no route exists', () => {
    const graph: StadiumGraph = {
      zones: [
        makeZone('A', { position: { x: 0, y: 0 } }),
        makeZone('B', { position: { x: 200, y: 0 } }),
      ],
      edges: [],
      metadata: { name: 'Test', capacity: 2000, zoneCount: 2, lastUpdated: new Date().toISOString() },
    };

    const request: RouteRequest = {
      source: 'A',
      destination: 'B',
      fanProfile: makeProfile(),
    };

    const alts = findAlternatives(graph, request, emptyDensityMap, 2);
    expect(alts).toEqual([]);
  });
});

// --- computeSOSRoute Tests ---

describe('computeSOSRoute', () => {
  it('finds shortest path ignoring all penalties', () => {
    // B is "away" zone but SOS should ignore it
    const graph: StadiumGraph = {
      zones: [
        makeZone('A', { position: { x: 0, y: 0 } }),
        makeZone('B', { position: { x: 100, y: 0 }, allegiance: 'away' }),
        makeZone('C', { position: { x: 100, y: 200 } }),
        makeZone('D', { position: { x: 200, y: 0 } }),
      ],
      edges: [
        makeEdge('e1', 'A', 'B', 100),
        makeEdge('e2', 'A', 'C', 200),
        makeEdge('e3', 'B', 'D', 100),
        makeEdge('e4', 'C', 'D', 200),
      ],
      metadata: { name: 'Test', capacity: 4000, zoneCount: 4, lastUpdated: new Date().toISOString() },
    };

    const result = computeSOSRoute(graph, 'A', 'D', emptyDensityMap);

    expect(result.status).toBe('found');
    // SOS takes the shortest path (A -> B -> D = 200m) even though B is an 'away' zone
    expect(result.path).toEqual(['A', 'B', 'D']);
    expect(result.distance).toBe(200);
    expect(result.warnings).toEqual([]);
  });

  it('SOS route ignores density penalties', () => {
    const graph = makeLinearGraph();
    const densityMap: DensityMap = {
      B: { zoneId: 'B', density: 95, lastUpdated: Date.now(), level: 'red' },
      C: { zoneId: 'C', density: 95, lastUpdated: Date.now(), level: 'red' },
    };

    const result = computeSOSRoute(graph, 'A', 'D', densityMap);

    expect(result.status).toBe('found');
    expect(result.path).toEqual(['A', 'B', 'C', 'D']);
    expect(result.distance).toBe(300);
  });

  it('SOS route ignores step-free constraints', () => {
    const graph: StadiumGraph = {
      zones: [
        makeZone('A', { position: { x: 0, y: 0 } }),
        makeZone('B', { position: { x: 100, y: 0 } }),
        makeZone('C', { position: { x: 200, y: 0 } }),
      ],
      edges: [
        makeEdge('e1', 'A', 'B', 100, {
          accessibility: {
            ...makeEdge('', '', '', 0).accessibility,
            stepFree: false, // has stairs
          },
        }),
        makeEdge('e2', 'B', 'C', 100),
      ],
      metadata: { name: 'Test', capacity: 3000, zoneCount: 3, lastUpdated: new Date().toISOString() },
    };

    const result = computeSOSRoute(graph, 'A', 'C', emptyDensityMap);

    expect(result.status).toBe('found');
    expect(result.path).toEqual(['A', 'B', 'C']);
  });

  it('returns not_found when graph is disconnected', () => {
    const graph: StadiumGraph = {
      zones: [
        makeZone('A', { position: { x: 0, y: 0 } }),
        makeZone('B', { position: { x: 200, y: 0 } }),
      ],
      edges: [],
      metadata: { name: 'Test', capacity: 2000, zoneCount: 2, lastUpdated: new Date().toISOString() },
    };

    const result = computeSOSRoute(graph, 'A', 'B', emptyDensityMap);

    expect(result.status).toBe('not_found');
    expect(result.path).toEqual([]);
  });
});
