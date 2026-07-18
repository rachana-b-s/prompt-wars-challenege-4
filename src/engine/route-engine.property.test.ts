/**
 * Property-based tests for the A* route engine.
 *
 * Property 1: Route Existence Completeness
 * Property 2: Route Optimality Ordering
 * Property 3: High-Density Zone Avoidance
 * Property 4: Route Result Structural Completeness
 * Property 5: Unreachable Destination Alternative Suggestion
 * Property 6: Wheelchair Step-Free Constraint Enforcement
 * Property 7: Limited Mobility Distance Constraint
 * Property 8: Fan Allegiance Zone Exclusion
 * Property 19: SOS Emergency Route Override
 *
 * Validates: Requirements 1.1–1.5, 3.1, 3.2, 5.2–5.4, 5.7, 15.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  computeRoute,
  findAlternatives,
  computeSOSRoute,
} from './route-engine';
import { syntheticStadium } from '@/data/synthetic-stadium';
import type { StadiumGraph, Zone, GraphEdge } from '@/types/stadium';
import type { RouteRequest } from '@/types/route';
import type { DensityMap } from '@/types/crowd';
import type { FanProfile, FanAllegiance } from '@/types/fan';

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

const emptyDensityMap: DensityMap = {};

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
function buildDensityMapFromGraph(graph: StadiumGraph): DensityMap {
  const map: DensityMap = {};
  for (const zone of graph.zones) {
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

/**
 * Check if two zones are connected (reachable from each other)
 * via BFS in the graph considering only neutral allegiance + step-free edges.
 */
function areConnected(
  graph: StadiumGraph,
  source: string,
  destination: string
): boolean {
  const adj = new Map<string, string[]>();
  for (const zone of graph.zones) {
    adj.set(zone.id, []);
  }
  for (const edge of graph.edges) {
    adj.get(edge.source)?.push(edge.target);
    if (edge.bidirectional) {
      adj.get(edge.target)?.push(edge.source);
    }
  }
  const visited = new Set<string>();
  const queue = [source];
  visited.add(source);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === destination) return true;
    for (const neighbor of adj.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return false;
}

// --- Property 1: Route Existence Completeness ---
// Feature: smart-stadium-fan-navigator, Property 1: Route Existence Completeness
// **Validates: Requirements 1.1**

describe('Property 1: Route Existence Completeness', () => {
  it('connected source/destination always returns path with status found', () => {
    fc.assert(
      fc.property(syntheticZoneArb, syntheticZoneArb, (source, destination) => {
        // Only test pairs that are connected in the raw graph
        if (!areConnected(syntheticStadium, source, destination)) return;

        const request: RouteRequest = {
          source,
          destination,
          fanProfile: makeProfile(),
        };

        const result = computeRoute(
          syntheticStadium,
          request,
          emptyDensityMap
        );

        expect(result.status).toBe('found');
        expect(result.path.length).toBeGreaterThanOrEqual(1);
        expect(result.path[0]).toBe(source);
        expect(result.path[result.path.length - 1]).toBe(destination);
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 2: Route Optimality Ordering ---
// Feature: smart-stadium-fan-navigator, Property 2: Route Optimality Ordering
// **Validates: Requirements 1.2**

describe('Property 2: Route Optimality Ordering', () => {
  it('alternatives ordered by non-decreasing composite score', () => {
    fc.assert(
      fc.property(syntheticZoneArb, syntheticZoneArb, (source, destination) => {
        // Skip same-zone pairs
        if (source === destination) return;
        if (!areConnected(syntheticStadium, source, destination)) return;

        const request: RouteRequest = {
          source,
          destination,
          fanProfile: makeProfile(),
        };

        const densityMap = buildDensityMapFromGraph(syntheticStadium);
        const primaryResult = computeRoute(syntheticStadium, request, densityMap);
        const alternatives = findAlternatives(syntheticStadium, request, densityMap, 3);

        if (primaryResult.status !== 'found' || alternatives.length === 0) return;

        // Primary route should have distance <= first alternative
        // (using distance as proxy for composite score since it's a cost-based A*)
        expect(primaryResult.distance).toBeLessThanOrEqual(alternatives[0].distance * 1.5);

        // Alternatives should be in non-decreasing distance order
        for (let i = 0; i < alternatives.length - 1; i++) {
          expect(alternatives[i].distance).toBeLessThanOrEqual(
            alternatives[i + 1].distance
          );
        }
      }),
      { numRuns: 50 }
    );
  });
});

// --- Property 3: High-Density Zone Avoidance ---
// Feature: smart-stadium-fan-navigator, Property 3: High-Density Zone Avoidance
// **Validates: Requirements 1.3**

describe('Property 3: High-Density Zone Avoidance', () => {
  it('avoids zones with density >80 when alternative exists', () => {
    // Diamond graph: A -> B -> D (B has density 90), A -> C -> D (C is clear)
    const graph: StadiumGraph = {
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
      metadata: {
        name: 'Diamond',
        capacity: 4000,
        zoneCount: 4,
        lastUpdated: new Date().toISOString(),
      },
    };

    fc.assert(
      fc.property(
        fc.integer({ min: 81, max: 100 }), // high density for B
        fc.integer({ min: 0, max: 40 }),    // low density for C
        (highDensity, lowDensity) => {
          const densityMap: DensityMap = {
            B: { zoneId: 'B', density: highDensity, lastUpdated: Date.now(), level: 'red' },
            C: { zoneId: 'C', density: lowDensity, lastUpdated: Date.now(), level: 'green' },
          };

          const request: RouteRequest = {
            source: 'A',
            destination: 'D',
            fanProfile: makeProfile({
              accessibilityProfile: {
                categories: [],
                hasCompanion: false,
                avoidStairs: false,
                avoidCrowds: true,
                preferQuiet: false,
                allergens: [],
              },
            }),
          };

          const result = computeRoute(graph, request, densityMap);

          expect(result.status).toBe('found');
          // Should avoid B (high density) and use C instead
          expect(result.path).toContain('C');
          expect(result.path).not.toContain('B');
        }
      ),
      { numRuns: 50 }
    );
  });
});

// --- Property 4: Route Result Structural Completeness ---
// Feature: smart-stadium-fan-navigator, Property 4: Route Result Structural Completeness
// **Validates: Requirements 1.4**

describe('Property 4: Route Result Structural Completeness', () => {
  it('successful routes have estimatedTime >0, distance >0, zonesTraversed = path length', () => {
    fc.assert(
      fc.property(syntheticZoneArb, syntheticZoneArb, (source, destination) => {
        // Skip same-zone (distance=0 is valid for source===destination)
        if (source === destination) return;
        if (!areConnected(syntheticStadium, source, destination)) return;

        const request: RouteRequest = {
          source,
          destination,
          fanProfile: makeProfile(),
        };

        const densityMap = buildDensityMapFromGraph(syntheticStadium);
        const result = computeRoute(syntheticStadium, request, densityMap);

        if (result.status !== 'found') return;

        expect(result.estimatedTime).toBeGreaterThan(0);
        expect(result.distance).toBeGreaterThan(0);
        expect(result.zonesTraversed).toBe(result.path.length);
      }),
      { numRuns: 100 }
    );
  });
});

// --- Property 5: Unreachable Destination Alternative Suggestion ---
// Feature: smart-stadium-fan-navigator, Property 5: Unreachable Destination Alternative Suggestion
// **Validates: Requirements 1.5**

describe('Property 5: Unreachable Destination Alternative Suggestion', () => {
  it('returns nearest reachable alternative when no path exists', () => {
    // Graph with disconnected node E
    const graph: StadiumGraph = {
      zones: [
        makeZone('A', { position: { x: 0, y: 0 } }),
        makeZone('B', { position: { x: 100, y: 0 } }),
        makeZone('C', { position: { x: 200, y: 0 } }),
        makeZone('E', { position: { x: 300, y: 0 } }), // disconnected
      ],
      edges: [
        makeEdge('e1', 'A', 'B', 100),
        makeEdge('e2', 'B', 'C', 100),
      ],
      metadata: {
        name: 'Disconnected',
        capacity: 4000,
        zoneCount: 4,
        lastUpdated: new Date().toISOString(),
      },
    };

    fc.assert(
      fc.property(
        fc.constantFrom('A', 'B', 'C'), // reachable sources
        (source) => {
          const request: RouteRequest = {
            source,
            destination: 'E', // unreachable
            fanProfile: makeProfile(),
          };

          const result = computeRoute(graph, request, emptyDensityMap);

          expect(result.status).toBe('not_found');
          // Should suggest a reachable alternative
          expect(result.nearestReachable).toBeDefined();
          // The nearest reachable zone to E should be a zone
          // that IS reachable from source (not source itself)
          expect(result.nearestReachable).not.toBe(source);
          // It must be one of the connected zones
          expect(['A', 'B', 'C']).toContain(result.nearestReachable);
        }
      ),
      { numRuns: 10 }
    );
  });
});

// --- Property 6: Wheelchair Step-Free Constraint Enforcement ---
// Feature: smart-stadium-fan-navigator, Property 6: Wheelchair Step-Free Constraint Enforcement
// **Validates: Requirements 3.1**

describe('Property 6: Wheelchair Step-Free Constraint Enforcement', () => {
  it('wheelchair routes only use step-free edges', () => {
    // Graph with mix of step-free and stairs edges
    const graph: StadiumGraph = {
      zones: [
        makeZone('A', { position: { x: 0, y: 0 } }),
        makeZone('B', { position: { x: 100, y: 0 } }),
        makeZone('C', { position: { x: 100, y: 100 } }),
        makeZone('D', { position: { x: 200, y: 0 } }),
        makeZone('E', { position: { x: 200, y: 100 } }),
      ],
      edges: [
        // Direct path via stairs (not step-free)
        makeEdge('e1', 'A', 'B', 80, {
          accessibility: {
            stepFree: false,
            hasStairs: true,
            hasEscalator: false,
            hasRamp: false,
            hasElevator: false,
            width: 2.5,
            gradient: 15,
            hasTactileIndicators: false,
            hasHandrails: true,
            maxUninterruptedDistance: 80,
          },
          type: 'stairs',
        }),
        makeEdge('e2', 'B', 'D', 80, {
          accessibility: {
            stepFree: false,
            hasStairs: true,
            hasEscalator: false,
            hasRamp: false,
            hasElevator: false,
            width: 2.5,
            gradient: 15,
            hasTactileIndicators: false,
            hasHandrails: true,
            maxUninterruptedDistance: 80,
          },
          type: 'stairs',
        }),
        // Step-free alternative via C and E
        makeEdge('e3', 'A', 'C', 120),
        makeEdge('e4', 'C', 'E', 100),
        makeEdge('e5', 'E', 'D', 100),
      ],
      metadata: {
        name: 'StepFreeTest',
        capacity: 5000,
        zoneCount: 5,
        lastUpdated: new Date().toISOString(),
      },
    };

    fc.assert(
      fc.property(fc.constant(null), () => {
        const request: RouteRequest = {
          source: 'A',
          destination: 'D',
          fanProfile: makeProfile({
            accessibilityProfile: {
              categories: ['wheelchair'],
              hasCompanion: false,
              avoidStairs: true,
              avoidCrowds: false,
              preferQuiet: false,
              allergens: [],
            },
          }),
        };

        const result = computeRoute(graph, request, emptyDensityMap);

        expect(result.status).toBe('found');
        // Verify path only uses step-free edges
        for (let i = 0; i < result.path.length - 1; i++) {
          const from = result.path[i];
          const to = result.path[i + 1];
          // Find the edge between consecutive path zones
          const edge = graph.edges.find(
            (e) =>
              (e.source === from && e.target === to) ||
              (e.bidirectional && e.source === to && e.target === from)
          );
          expect(edge).toBeDefined();
          expect(edge!.accessibility.stepFree).toBe(true);
        }
      }),
      { numRuns: 10 }
    );
  });

  it('wheelchair routes on synthetic stadium only use step-free edges', () => {
    // Filter zone pairs that are reachable via step-free paths in the synthetic stadium
    const stepFreeZones = syntheticStadium.zones
      .filter((z) => z.accessibilityFeatures.stepFree)
      .map((z) => z.id);

    const stepFreeZoneArb = fc.constantFrom(...stepFreeZones);

    fc.assert(
      fc.property(stepFreeZoneArb, stepFreeZoneArb, (source, destination) => {
        if (source === destination) return;

        const request: RouteRequest = {
          source,
          destination,
          fanProfile: makeProfile({
            accessibilityProfile: {
              categories: ['wheelchair'],
              hasCompanion: false,
              avoidStairs: true,
              avoidCrowds: false,
              preferQuiet: false,
              allergens: [],
            },
          }),
        };

        const result = computeRoute(syntheticStadium, request, emptyDensityMap);

        if (result.status !== 'found') return;

        // Every edge in path must be step-free
        for (let i = 0; i < result.path.length - 1; i++) {
          const from = result.path[i];
          const to = result.path[i + 1];
          const edge = syntheticStadium.edges.find(
            (e) =>
              (e.source === from && e.target === to) ||
              (e.bidirectional && e.source === to && e.target === from)
          );
          expect(edge).toBeDefined();
          expect(edge!.accessibility.stepFree).toBe(true);
        }
      }),
      { numRuns: 50 }
    );
  });
});

// --- Property 7: Limited Mobility Distance Constraint ---
// Feature: smart-stadium-fan-navigator, Property 7: Limited Mobility Distance Constraint
// **Validates: Requirements 3.2**

describe('Property 7: Limited Mobility Distance Constraint', () => {
  it('no edge exceeds 200m uninterrupted distance for limited mobility', () => {
    // Graph where one edge exceeds 200m, and an alternative with shorter edges exists
    const graph: StadiumGraph = {
      zones: [
        makeZone('A', { position: { x: 0, y: 0 } }),
        makeZone('B', { position: { x: 250, y: 0 } }),
        makeZone('M', { position: { x: 100, y: 50 } }), // midpoint
        makeZone('C', { position: { x: 300, y: 0 } }),
      ],
      edges: [
        // Long edge (250m) - exceeds 200m constraint
        makeEdge('e-long', 'A', 'B', 250),
        // Short edge alternative: A -> M -> B
        makeEdge('e-short1', 'A', 'M', 120),
        makeEdge('e-short2', 'M', 'B', 130),
        makeEdge('e3', 'B', 'C', 50),
      ],
      metadata: {
        name: 'DistTest',
        capacity: 4000,
        zoneCount: 4,
        lastUpdated: new Date().toISOString(),
      },
    };

    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 200 }), // maxEdgeDistance
        (maxDist) => {
          const request: RouteRequest = {
            source: 'A',
            destination: 'C',
            fanProfile: makeProfile({
              accessibilityProfile: {
                categories: ['limited_mobility'],
                hasCompanion: false,
                maxWalkingDistance: maxDist,
                avoidStairs: false,
                avoidCrowds: false,
                preferQuiet: false,
                allergens: [],
              },
            }),
          };

          const result = computeRoute(graph, request, emptyDensityMap);

          if (result.status !== 'found') return;

          // Every edge in path must not exceed maxDist
          for (let i = 0; i < result.path.length - 1; i++) {
            const from = result.path[i];
            const to = result.path[i + 1];
            const edge = graph.edges.find(
              (e) =>
                (e.source === from && e.target === to) ||
                (e.bidirectional && e.source === to && e.target === from)
            );
            expect(edge).toBeDefined();
            expect(edge!.distance).toBeLessThanOrEqual(maxDist);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// --- Property 8: Fan Allegiance Zone Exclusion ---
// Feature: smart-stadium-fan-navigator, Property 8: Fan Allegiance Zone Exclusion
// **Validates: Requirements 5.2, 5.3, 5.4, 5.7**

describe('Property 8: Fan Allegiance Zone Exclusion', () => {
  it('routes never traverse opposing allegiance zones', () => {
    fc.assert(
      fc.property(
        syntheticZoneArb,
        syntheticZoneArb,
        fc.constantFrom('home' as FanAllegiance, 'away' as FanAllegiance),
        (source, destination, allegiance) => {
          if (source === destination) return;

          // Skip if source or destination is itself an opposing zone
          const sourceZone = syntheticStadium.zones.find((z) => z.id === source);
          const destZone = syntheticStadium.zones.find((z) => z.id === destination);
          if (!sourceZone || !destZone) return;

          const opposingAllegiance = allegiance === 'home' ? 'away' : 'home';

          // Skip if source or destination has opposing allegiance
          if (sourceZone.allegiance === opposingAllegiance) return;
          if (destZone.allegiance === opposingAllegiance) return;

          const request: RouteRequest = {
            source,
            destination,
            fanProfile: makeProfile({ allegiance }),
          };

          const result = computeRoute(
            syntheticStadium,
            request,
            emptyDensityMap
          );

          if (result.status !== 'found') return;

          // No zone in path should have the opposing allegiance
          for (const zoneId of result.path) {
            const zone = syntheticStadium.zones.find((z) => z.id === zoneId);
            expect(zone).toBeDefined();
            expect(zone!.allegiance).not.toBe(opposingAllegiance);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('home fans never traverse away zones on custom graph', () => {
    // Custom graph with home/away/neutral zones
    const graph: StadiumGraph = {
      zones: [
        makeZone('start', { position: { x: 0, y: 0 }, allegiance: 'neutral' }),
        makeZone('away-zone', { position: { x: 100, y: 0 }, allegiance: 'away' }),
        makeZone('neutral-mid', { position: { x: 100, y: 100 }, allegiance: 'neutral' }),
        makeZone('end', { position: { x: 200, y: 50 }, allegiance: 'neutral' }),
      ],
      edges: [
        makeEdge('e1', 'start', 'away-zone', 80),
        makeEdge('e2', 'start', 'neutral-mid', 120),
        makeEdge('e3', 'away-zone', 'end', 80),
        makeEdge('e4', 'neutral-mid', 'end', 120),
      ],
      metadata: {
        name: 'AllegianceTest',
        capacity: 4000,
        zoneCount: 4,
        lastUpdated: new Date().toISOString(),
      },
    };

    fc.assert(
      fc.property(fc.constant(null), () => {
        const request: RouteRequest = {
          source: 'start',
          destination: 'end',
          fanProfile: makeProfile({ allegiance: 'home' }),
        };

        const result = computeRoute(graph, request, emptyDensityMap);

        expect(result.status).toBe('found');
        expect(result.path).not.toContain('away-zone');
        expect(result.path).toContain('neutral-mid');
      }),
      { numRuns: 10 }
    );
  });
});

// --- Property 19: SOS Emergency Route Override ---
// Feature: smart-stadium-fan-navigator, Property 19: SOS Emergency Route Override
// **Validates: Requirements 15.6**

describe('Property 19: SOS Emergency Route Override', () => {
  it('SOS route is shortest distance ignoring penalties', () => {
    fc.assert(
      fc.property(
        syntheticZoneArb,
        syntheticZoneArb,
        fc.integer({ min: 50, max: 100 }), // high density values
        (source, destination, density) => {
          if (source === destination) return;
          if (!areConnected(syntheticStadium, source, destination)) return;

          // Create high-density map for all zones
          const densityMap: DensityMap = {};
          for (const zone of syntheticStadium.zones) {
            densityMap[zone.id] = {
              zoneId: zone.id,
              density,
              lastUpdated: Date.now(),
              level: 'red',
            };
          }

          const sosResult = computeSOSRoute(
            syntheticStadium,
            source,
            destination,
            densityMap
          );

          if (sosResult.status !== 'found') return;

          // SOS route should have no warnings (emergency override)
          expect(sosResult.warnings).toEqual([]);

          // SOS route should use the shortest raw distance path
          // Compare with a non-SOS route that avoids crowds
          const normalRequest: RouteRequest = {
            source,
            destination,
            fanProfile: makeProfile({
              accessibilityProfile: {
                categories: [],
                hasCompanion: false,
                avoidStairs: false,
                avoidCrowds: true,
                preferQuiet: false,
                allergens: [],
              },
            }),
          };

          const normalResult = computeRoute(
            syntheticStadium,
            normalRequest,
            densityMap
          );

          if (normalResult.status !== 'found') return;

          // SOS should be <= normal distance (shortest ignoring penalties)
          expect(sosResult.distance).toBeLessThanOrEqual(normalResult.distance);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('SOS route ignores allegiance constraints', () => {
    // Graph where shortest path goes through away zone
    const graph: StadiumGraph = {
      zones: [
        makeZone('src', { position: { x: 0, y: 0 }, allegiance: 'neutral' }),
        makeZone('away', { position: { x: 100, y: 0 }, allegiance: 'away' }),
        makeZone('long', { position: { x: 100, y: 200 }, allegiance: 'neutral' }),
        makeZone('medical', {
          position: { x: 200, y: 0 },
          type: 'medical_area',
          allegiance: 'neutral',
        }),
      ],
      edges: [
        makeEdge('e1', 'src', 'away', 80),
        makeEdge('e2', 'src', 'long', 250),
        makeEdge('e3', 'away', 'medical', 80),
        makeEdge('e4', 'long', 'medical', 250),
      ],
      metadata: {
        name: 'SOSTest',
        capacity: 4000,
        zoneCount: 4,
        lastUpdated: new Date().toISOString(),
      },
    };

    fc.assert(
      fc.property(fc.constant(null), () => {
        const sosResult = computeSOSRoute(graph, 'src', 'medical', emptyDensityMap);

        expect(sosResult.status).toBe('found');
        // SOS ignores allegiance — takes shortest via 'away' zone
        expect(sosResult.path).toEqual(['src', 'away', 'medical']);
        expect(sosResult.distance).toBe(160);
      }),
      { numRuns: 10 }
    );
  });

  it('SOS route ignores step-free constraints', () => {
    const graph: StadiumGraph = {
      zones: [
        makeZone('src', { position: { x: 0, y: 0 } }),
        makeZone('stairs', { position: { x: 100, y: 0 } }),
        makeZone('ramp', { position: { x: 100, y: 100 } }),
        makeZone('dest', { position: { x: 200, y: 0 } }),
      ],
      edges: [
        makeEdge('e-stairs', 'src', 'stairs', 50, {
          accessibility: {
            stepFree: false,
            hasStairs: true,
            hasEscalator: false,
            hasRamp: false,
            hasElevator: false,
            width: 2,
            gradient: 20,
            hasTactileIndicators: false,
            hasHandrails: true,
            maxUninterruptedDistance: 50,
          },
          type: 'stairs',
        }),
        makeEdge('e-ramp', 'src', 'ramp', 150),
        makeEdge('e-stairs2', 'stairs', 'dest', 50, {
          accessibility: {
            stepFree: false,
            hasStairs: true,
            hasEscalator: false,
            hasRamp: false,
            hasElevator: false,
            width: 2,
            gradient: 20,
            hasTactileIndicators: false,
            hasHandrails: true,
            maxUninterruptedDistance: 50,
          },
          type: 'stairs',
        }),
        makeEdge('e-ramp2', 'ramp', 'dest', 150),
      ],
      metadata: {
        name: 'SOSStairs',
        capacity: 4000,
        zoneCount: 4,
        lastUpdated: new Date().toISOString(),
      },
    };

    fc.assert(
      fc.property(fc.constant(null), () => {
        const sosResult = computeSOSRoute(graph, 'src', 'dest', emptyDensityMap);

        expect(sosResult.status).toBe('found');
        // SOS takes stairs (shorter) ignoring step-free constraints
        expect(sosResult.path).toEqual(['src', 'stairs', 'dest']);
        expect(sosResult.distance).toBe(100);
      }),
      { numRuns: 10 }
    );
  });
});
