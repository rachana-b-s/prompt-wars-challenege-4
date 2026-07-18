/**
 * A* Route Engine for the Smart Stadium Fan Navigator.
 *
 * Implements:
 * - computeRoute() — A* search with constraint-aware edge weighting, zone exclusion, density penalties
 * - computeGroupRoute() — route computation using merged GroupConstraintSet
 * - findAlternatives() — find N alternative routes by penalizing edges of previous best path
 * - computeSOSRoute() — emergency route override (shortest distance, ignore density/comfort)
 *
 * A* algorithm:
 *   f(n) = g(n) + h(n)
 *   g(n) = cost from start using getEdgeWeight() with constraints
 *   h(n) = Euclidean distance from zone position to destination position
 *
 * Edge cases:
 *   - No route found: BFS to find nearest reachable zone to destination, return with status 'not_found'
 *   - High-density reroute: zones with density > 80 get heavy penalty (3x weight)
 *   - Zone closed: treated as excluded via isZoneAllowed
 *   - SOS: isSOS = true, uses raw distance, ignores comfort penalties
 *
 * Estimated time: distance / 80 m/min. Zones with density > 60 add 20%, > 80 add 50%.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 5.2, 5.3, 15.6
 */

import type { StadiumGraph, Zone, ZoneId, GraphEdge } from '@/types/stadium';
import type {
  RouteRequest,
  GroupRouteRequest,
  RouteResult,
  RouteSegment,
  RouteWarning,
  RouteConstraints,
} from '@/types/route';
import type { DensityMap } from '@/types/crowd';
import {
  isZoneAllowed,
  isEdgeTraversable,
  getEdgeWeight,
  buildRouteConstraints,
  buildGroupRouteConstraints,
} from './constraint-solver';

// === Priority Queue (Min-Heap) ===

interface HeapNode {
  zoneId: ZoneId;
  f: number; // f = g + h
  g: number; // cost from start
}

/**
 * Simple array-based min-heap for the A* priority queue.
 * Stadium graphs are small (~30 zones), so this is efficient enough.
 */
class MinHeap {
  private heap: HeapNode[] = [];

  push(node: HeapNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): HeapNode | undefined {
    if (this.heap.length === 0) return undefined;
    const min = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return min;
  }

  get size(): number {
    return this.heap.length;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].f <= this.heap[i].f) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private bubbleDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left].f < this.heap[smallest].f) smallest = left;
      if (right < n && this.heap[right].f < this.heap[smallest].f) smallest = right;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

// === Helper Functions ===

/**
 * Build an adjacency list from the graph's edges.
 * For bidirectional edges, add both directions.
 */
function buildAdjacencyList(
  graph: StadiumGraph
): Map<ZoneId, { edge: GraphEdge; neighbor: ZoneId }[]> {
  const adj = new Map<ZoneId, { edge: GraphEdge; neighbor: ZoneId }[]>();

  for (const zone of graph.zones) {
    adj.set(zone.id, []);
  }

  for (const edge of graph.edges) {
    adj.get(edge.source)?.push({ edge, neighbor: edge.target });
    if (edge.bidirectional) {
      adj.get(edge.target)?.push({ edge, neighbor: edge.source });
    }
  }

  return adj;
}

/**
 * Build a zone lookup map for fast access by ZoneId.
 */
function buildZoneMap(graph: StadiumGraph): Map<ZoneId, Zone> {
  const map = new Map<ZoneId, Zone>();
  for (const zone of graph.zones) {
    map.set(zone.id, zone);
  }
  return map;
}

/**
 * Compute Euclidean distance between two zone positions (heuristic for A*).
 */
function euclideanDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Estimate travel time in seconds.
 * Base: distance / 80 m/min = distance / (80/60) m/sec = distance * 60 / 80
 * Zones with density > 60 add 20%, > 80 add 50%.
 */
function estimateTime(distance: number, path: ZoneId[], densityMap: DensityMap): number {
  const baseTimeMinutes = distance / 80; // minutes
  let timeMultiplier = 1.0;

  // Check densities along path — use the worst zone's penalty
  let maxPenalty = 0;
  for (const zoneId of path) {
    const entry = densityMap[zoneId];
    if (entry) {
      if (entry.density > 80) {
        maxPenalty = Math.max(maxPenalty, 0.5);
      } else if (entry.density > 60) {
        maxPenalty = Math.max(maxPenalty, 0.2);
      }
    }
  }
  timeMultiplier += maxPenalty;

  return Math.round(baseTimeMinutes * timeMultiplier * 60); // convert to seconds
}

/**
 * Generate route warnings based on the path.
 */
function generateWarnings(
  path: ZoneId[],
  zoneMap: Map<ZoneId, Zone>,
  adjacencyList: Map<ZoneId, { edge: GraphEdge; neighbor: ZoneId }[]>,
  constraints: RouteConstraints,
  densityMap: DensityMap
): RouteWarning[] {
  const warnings: RouteWarning[] = [];

  for (const zoneId of path) {
    const zone = zoneMap.get(zoneId);
    if (!zone) continue;

    // High density warning (density > 70)
    const densityEntry = densityMap[zoneId];
    if (densityEntry && densityEntry.density > 70) {
      warnings.push({
        type: 'high_density',
        message: `Zone "${zone.name}" has high crowd density (${densityEntry.density}%).`,
        zone: zoneId,
      });
    }

    // Sensory trigger warning (for preferQuiet fans)
    if (constraints.preferQuiet && zone.sensoryTriggers.length > 0) {
      warnings.push({
        type: 'sensory_trigger',
        message: `Zone "${zone.name}" has sensory triggers: ${zone.sensoryTriggers.join(', ')}.`,
        zone: zoneId,
      });
    }

    // Sun exposure warning
    if (zone.isSunExposed) {
      warnings.push({
        type: 'sun_exposure',
        message: `Zone "${zone.name}" is sun-exposed.`,
        zone: zoneId,
      });
    }

    // Allegiance proximity warning: check if any neighbor is opposing allegiance
    const neighbors = adjacencyList.get(zoneId) ?? [];
    for (const { neighbor } of neighbors) {
      const neighborZone = zoneMap.get(neighbor);
      if (!neighborZone) continue;
      if (
        constraints.excludeAllegiance.includes(neighborZone.allegiance as 'home' | 'away') &&
        !path.includes(neighbor) // only warn about proximity, not zones in our path
      ) {
        warnings.push({
          type: 'allegiance_proximity',
          message: `Zone "${zone.name}" is adjacent to opposing allegiance zone "${neighborZone.name}".`,
          zone: zoneId,
        });
        break; // one warning per zone is enough
      }
    }
  }

  return warnings;
}

/**
 * Calculate total distance along a path by summing edge distances.
 */
function calculatePathDistance(
  path: ZoneId[],
  adjacencyList: Map<ZoneId, { edge: GraphEdge; neighbor: ZoneId }[]>
): number {
  let totalDistance = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const neighbors = adjacencyList.get(path[i]) ?? [];
    const connection = neighbors.find((n) => n.neighbor === path[i + 1]);
    if (connection) {
      totalDistance += connection.edge.distance;
    }
  }
  return totalDistance;
}

/**
 * Build route segments from a path.
 */
function buildSegments(
  path: ZoneId[],
  adjacencyList: Map<ZoneId, { edge: GraphEdge; neighbor: ZoneId }[]>,
  zoneMap: Map<ZoneId, Zone>
): RouteSegment[] {
  const segments: RouteSegment[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const neighbors = adjacencyList.get(path[i]) ?? [];
    const connection = neighbors.find((n) => n.neighbor === path[i + 1]);
    const toZone = zoneMap.get(path[i + 1]);
    if (connection && toZone) {
      segments.push({
        fromZone: path[i],
        toZone: path[i + 1],
        edgeId: connection.edge.id,
        distance: connection.edge.distance,
        instruction: `Proceed to ${toZone.name} via ${connection.edge.type}.`,
      });
    }
  }
  return segments;
}

/**
 * Find nearest reachable zone to a destination using BFS from the source.
 * Returns the reachable zone closest (Euclidean) to the original destination.
 */
function findNearestReachable(
  graph: StadiumGraph,
  source: ZoneId,
  destination: ZoneId,
  constraints: RouteConstraints,
  adjacencyList: Map<ZoneId, { edge: GraphEdge; neighbor: ZoneId }[]>,
  zoneMap: Map<ZoneId, Zone>
): ZoneId | undefined {
  const destZone = zoneMap.get(destination);
  if (!destZone) return undefined;

  // BFS from source to find all reachable zones
  const visited = new Set<ZoneId>();
  const queue: ZoneId[] = [source];
  visited.add(source);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacencyList.get(current) ?? [];
    for (const { edge, neighbor } of neighbors) {
      if (visited.has(neighbor)) continue;
      const neighborZone = zoneMap.get(neighbor);
      if (!neighborZone) continue;
      if (!isZoneAllowed(neighborZone, constraints)) continue;
      if (!isEdgeTraversable(edge, constraints)) continue;
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  // Remove source from candidates (don't suggest staying in place)
  visited.delete(source);

  if (visited.size === 0) return undefined;

  // Find the reachable zone nearest (Euclidean) to the destination
  let nearest: ZoneId | undefined;
  let minDist = Infinity;

  for (const zoneId of visited) {
    const zone = zoneMap.get(zoneId);
    if (!zone) continue;
    const dist = euclideanDistance(zone.position, destZone.position);
    if (dist < minDist) {
      minDist = dist;
      nearest = zoneId;
    }
  }

  return nearest;
}

// === Core A* Implementation ===

/**
 * Run A* search from source to destination with given constraints.
 * Optionally accepts edge penalty multipliers (for alternative route computation).
 *
 * Returns the path as an array of ZoneIds, or null if no path found.
 */
function aStarSearch(
  source: ZoneId,
  destination: ZoneId,
  constraints: RouteConstraints,
  densityMap: DensityMap,
  adjacencyList: Map<ZoneId, { edge: GraphEdge; neighbor: ZoneId }[]>,
  zoneMap: Map<ZoneId, Zone>,
  edgePenalties?: Map<string, number>
): { path: ZoneId[]; cost: number } | null {
  const destZone = zoneMap.get(destination);
  const srcZone = zoneMap.get(source);
  if (!destZone || !srcZone) return null;

  // Check if source or destination zones are allowed
  if (!isZoneAllowed(srcZone, constraints) && !constraints.isSOS) return null;
  if (!isZoneAllowed(destZone, constraints) && !constraints.isSOS) return null;

  // Special case: source === destination
  if (source === destination) {
    return { path: [source], cost: 0 };
  }

  const openSet = new MinHeap();
  const gScore = new Map<ZoneId, number>();
  const cameFrom = new Map<ZoneId, ZoneId>();
  const visited = new Set<ZoneId>();

  gScore.set(source, 0);
  openSet.push({
    zoneId: source,
    g: 0,
    f: euclideanDistance(srcZone.position, destZone.position),
  });

  while (openSet.size > 0) {
    const current = openSet.pop()!;

    if (current.zoneId === destination) {
      // Reconstruct path
      const path: ZoneId[] = [];
      let node: ZoneId | undefined = destination;
      while (node !== undefined) {
        path.unshift(node);
        node = cameFrom.get(node);
      }
      return { path, cost: current.g };
    }

    if (visited.has(current.zoneId)) continue;
    visited.add(current.zoneId);

    const neighbors = adjacencyList.get(current.zoneId) ?? [];
    for (const { edge, neighbor } of neighbors) {
      if (visited.has(neighbor)) continue;

      const neighborZone = zoneMap.get(neighbor);
      if (!neighborZone) continue;

      // Skip zones not allowed by constraints (unless SOS mode)
      if (!constraints.isSOS && !isZoneAllowed(neighborZone, constraints)) continue;

      // Skip edges not traversable (unless SOS mode)
      if (!constraints.isSOS && !isEdgeTraversable(edge, constraints)) continue;

      // Compute edge weight
      let weight = getEdgeWeight(edge, constraints, densityMap, neighborZone);
      if (weight === Infinity) continue;

      // Apply edge penalties for alternative route computation
      if (edgePenalties) {
        const penalty = edgePenalties.get(edge.id);
        if (penalty) {
          weight *= penalty;
        }
      }

      const tentativeG = current.g + weight;
      const currentBestG = gScore.get(neighbor) ?? Infinity;

      if (tentativeG < currentBestG) {
        cameFrom.set(neighbor, current.zoneId);
        gScore.set(neighbor, tentativeG);
        const h = euclideanDistance(neighborZone.position, destZone.position);
        openSet.push({
          zoneId: neighbor,
          g: tentativeG,
          f: tentativeG + h,
        });
      }
    }
  }

  // No path found
  return null;
}

// === Exported Functions ===

/**
 * Compute a route from source to destination for a single fan.
 * Uses A* with constraint-aware edge weighting.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 5.2, 5.3
 */
export function computeRoute(
  graph: StadiumGraph,
  request: RouteRequest,
  densityMap: DensityMap
): RouteResult {
  const adjacencyList = buildAdjacencyList(graph);
  const zoneMap = buildZoneMap(graph);
  const constraints = buildRouteConstraints(
    request.fanProfile.accessibilityProfile,
    request.fanProfile.allegiance
  );

  const result = aStarSearch(
    request.source,
    request.destination,
    constraints,
    densityMap,
    adjacencyList,
    zoneMap
  );

  if (!result) {
    // No path found — find nearest reachable alternative
    const nearest = findNearestReachable(
      graph,
      request.source,
      request.destination,
      constraints,
      adjacencyList,
      zoneMap
    );

    return {
      status: 'not_found',
      path: [],
      segments: [],
      distance: 0,
      estimatedTime: 0,
      zonesTraversed: 0,
      warnings: [],
      nearestReachable: nearest,
    };
  }

  const distance = calculatePathDistance(result.path, adjacencyList);
  const segments = buildSegments(result.path, adjacencyList, zoneMap);
  const warnings = generateWarnings(
    result.path,
    zoneMap,
    adjacencyList,
    constraints,
    densityMap
  );
  const estimatedTime = estimateTime(distance, result.path, densityMap);

  return {
    status: 'found',
    path: result.path,
    segments,
    distance,
    estimatedTime,
    zonesTraversed: result.path.length,
    warnings,
  };
}

/**
 * Compute a route for a group using merged GroupConstraintSet.
 * Applies weakest-link routing: the path must satisfy the most restrictive
 * constraint from any group member.
 *
 * Requirements: 4.2, 4.3
 */
export function computeGroupRoute(
  graph: StadiumGraph,
  request: GroupRouteRequest,
  densityMap: DensityMap
): RouteResult {
  const adjacencyList = buildAdjacencyList(graph);
  const zoneMap = buildZoneMap(graph);
  const constraints = buildGroupRouteConstraints(request.group.constraintSet);

  const result = aStarSearch(
    request.source,
    request.destination,
    constraints,
    densityMap,
    adjacencyList,
    zoneMap
  );

  if (!result) {
    const nearest = findNearestReachable(
      graph,
      request.source,
      request.destination,
      constraints,
      adjacencyList,
      zoneMap
    );

    return {
      status: 'not_found',
      path: [],
      segments: [],
      distance: 0,
      estimatedTime: 0,
      zonesTraversed: 0,
      warnings: [],
      nearestReachable: nearest,
    };
  }

  const distance = calculatePathDistance(result.path, adjacencyList);
  const segments = buildSegments(result.path, adjacencyList, zoneMap);
  const warnings = generateWarnings(
    result.path,
    zoneMap,
    adjacencyList,
    constraints,
    densityMap
  );
  const estimatedTime = estimateTime(distance, result.path, densityMap);

  return {
    status: 'found',
    path: result.path,
    segments,
    distance,
    estimatedTime,
    zonesTraversed: result.path.length,
    warnings,
  };
}

/**
 * Find N alternative routes by penalizing edges of the previous best path.
 * Each alternative penalizes the best path's edges by 3x, then re-runs A*.
 *
 * Requirements: 1.2
 */
export function findAlternatives(
  graph: StadiumGraph,
  request: RouteRequest,
  densityMap: DensityMap,
  count: number = 2
): RouteResult[] {
  const adjacencyList = buildAdjacencyList(graph);
  const zoneMap = buildZoneMap(graph);
  const constraints = buildRouteConstraints(
    request.fanProfile.accessibilityProfile,
    request.fanProfile.allegiance
  );

  const alternatives: RouteResult[] = [];
  const edgePenalties = new Map<string, number>();

  // First, compute the best route
  const best = aStarSearch(
    request.source,
    request.destination,
    constraints,
    densityMap,
    adjacencyList,
    zoneMap
  );

  if (!best) return alternatives;

  // Penalize edges of the best path
  for (let i = 0; i < best.path.length - 1; i++) {
    const neighbors = adjacencyList.get(best.path[i]) ?? [];
    const connection = neighbors.find((n) => n.neighbor === best.path[i + 1]);
    if (connection) {
      edgePenalties.set(connection.edge.id, 3);
    }
  }

  // Find alternatives by repeatedly penalizing
  for (let k = 0; k < count; k++) {
    const altResult = aStarSearch(
      request.source,
      request.destination,
      constraints,
      densityMap,
      adjacencyList,
      zoneMap,
      edgePenalties
    );

    if (!altResult || altResult.path.length === 0) break;

    // Check if this alternative is actually different from best and previous alternatives
    const pathStr = altResult.path.join(',');
    const bestStr = best.path.join(',');
    const isDuplicate =
      pathStr === bestStr ||
      alternatives.some((a) => a.path.join(',') === pathStr);

    if (isDuplicate) break;

    const distance = calculatePathDistance(altResult.path, adjacencyList);
    const segments = buildSegments(altResult.path, adjacencyList, zoneMap);
    const warnings = generateWarnings(
      altResult.path,
      zoneMap,
      adjacencyList,
      constraints,
      densityMap
    );
    const estimatedTime = estimateTime(distance, altResult.path, densityMap);

    alternatives.push({
      status: 'found',
      path: altResult.path,
      segments,
      distance,
      estimatedTime,
      zonesTraversed: altResult.path.length,
      warnings,
    });

    // Also penalize edges of this alternative for the next iteration
    for (let i = 0; i < altResult.path.length - 1; i++) {
      const neighbors = adjacencyList.get(altResult.path[i]) ?? [];
      const connection = neighbors.find((n) => n.neighbor === altResult.path[i + 1]);
      if (connection) {
        const existing = edgePenalties.get(connection.edge.id) ?? 1;
        edgePenalties.set(connection.edge.id, existing * 3);
      }
    }
  }

  return alternatives;
}

/**
 * Compute an SOS emergency route — shortest distance path ignoring
 * density penalties and comfort preferences.
 * Uses raw distance only for edge weights (isSOS = true in constraints).
 *
 * Requirements: 15.6
 */
export function computeSOSRoute(
  graph: StadiumGraph,
  source: ZoneId,
  destination: ZoneId,
  densityMap: DensityMap
): RouteResult {
  const adjacencyList = buildAdjacencyList(graph);
  const zoneMap = buildZoneMap(graph);

  const sosConstraints: RouteConstraints = {
    stepFreeRequired: false,
    maxEdgeDistance: Infinity,
    avoidHighDensity: false,
    avoidZoneTypes: [],
    excludeAllegiance: [],
    preferQuiet: false,
    isSOS: true,
  };

  const result = aStarSearch(
    source,
    destination,
    sosConstraints,
    densityMap,
    adjacencyList,
    zoneMap
  );

  if (!result) {
    const nearest = findNearestReachable(
      graph,
      source,
      destination,
      sosConstraints,
      adjacencyList,
      zoneMap
    );

    return {
      status: 'not_found',
      path: [],
      segments: [],
      distance: 0,
      estimatedTime: 0,
      zonesTraversed: 0,
      warnings: [],
      nearestReachable: nearest,
    };
  }

  const distance = calculatePathDistance(result.path, adjacencyList);
  const segments = buildSegments(result.path, adjacencyList, zoneMap);
  // SOS routes have no warnings (emergency override)
  const estimatedTime = estimateTime(distance, result.path, densityMap);

  return {
    status: 'found',
    path: result.path,
    segments,
    distance,
    estimatedTime,
    zonesTraversed: result.path.length,
    warnings: [],
  };
}
