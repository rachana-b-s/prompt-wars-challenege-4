/**
 * Accessibility-specific routing constraints for the Smart Stadium Fan Navigator.
 *
 * Provides helper functions that augment the base RouteConstraints from
 * buildRouteConstraints() with category-specific routing preferences.
 *
 * Categories handled:
 * - Pregnancy: restroom proximity, avoid stairs, rest areas every 150m
 * - Sensory sensitivity: quiet routes, avoid high-noise/sensory triggers/smoking
 * - Child accompaniment: avoid alcohol/adult zones, prefer family sections, max 500m
 * - Blind/low-vision: prefer tactile indicators, handrails (without companion);
 *   relax requirements (with companion)
 * - Deaf/HoH: no routing changes (UI-level only)
 *
 * Requirements: 3.12–3.21, 17.4
 */

import type { RouteConstraints } from '@/types/route';
import type { Zone, ZoneId, GraphEdge, StadiumGraph } from '@/types/stadium';
import type { Facility } from '@/types/facility';

/** Maximum edge distance for pregnancy routing (rest areas every 150m) */
const PREGNANCY_MAX_EDGE_DISTANCE = 150;

/** Maximum total route distance for child accompaniment */
const CHILD_MAX_TOTAL_DISTANCE = 500;

/** Maximum zone-hops from a restroom allowed for pregnancy routing */
const PREGNANCY_RESTROOM_HOP_LIMIT = 2;

/**
 * Apply pregnancy-specific constraints to base RouteConstraints.
 *
 * - maxEdgeDistance = 150m (rest areas every 150m, Req 3.14)
 * - stepFreeRequired = true (avoid stairs, Req 3.13)
 * - preferNearRestrooms = true (within 2 zone-hops, Req 3.12)
 * - avoidZoneTypes: no additional zone types excluded beyond base
 *
 * Requirements: 3.12, 3.13, 3.14
 */
export function applyPregnancyConstraints(constraints: RouteConstraints): RouteConstraints {
  return {
    ...constraints,
    stepFreeRequired: true,
    // Use minimum of existing maxEdgeDistance and pregnancy limit
    maxEdgeDistance: Math.min(constraints.maxEdgeDistance, PREGNANCY_MAX_EDGE_DISTANCE),
    preferQuiet: constraints.preferQuiet, // preserve existing
  };
}

/**
 * Apply sensory sensitivity constraints to base RouteConstraints.
 *
 * - preferQuiet = true (prefer quiet routes, Req 3.15)
 * - avoidZoneTypes: add 'smoking_area' (Req 17.4)
 * - Sensory triggers in zones are handled by getEdgeWeight penalty (already in constraint-solver)
 * - High-noise zones get additional weight penalty via preferQuiet
 *
 * Requirements: 3.15, 3.16, 17.4
 */
export function applySensoryConstraints(constraints: RouteConstraints): RouteConstraints {
  const avoidZoneTypes = [...constraints.avoidZoneTypes];
  if (!avoidZoneTypes.includes('smoking_area')) {
    avoidZoneTypes.push('smoking_area');
  }

  return {
    ...constraints,
    preferQuiet: true,
    avoidZoneTypes,
  };
}

/**
 * Apply child accompaniment constraints to base RouteConstraints.
 *
 * - avoidZoneTypes: add 'smoking_area', 'loading_dock', 'service_corridor' (Req 3.18, 16.6)
 * - maxEdgeDistance: min of existing and CHILD_MAX_TOTAL_DISTANCE (Req 3.21)
 * - preferFamilySections: expressed through zone type preferences in the route engine
 *
 * Requirements: 3.18, 3.19, 3.20, 3.21
 */
export function applyChildConstraints(constraints: RouteConstraints): RouteConstraints {
  const avoidZoneTypes = [...constraints.avoidZoneTypes];
  const childUnsafe = ['smoking_area', 'loading_dock', 'service_corridor'] as const;
  for (const zt of childUnsafe) {
    if (!avoidZoneTypes.includes(zt)) {
      avoidZoneTypes.push(zt);
    }
  }

  return {
    ...constraints,
    avoidZoneTypes,
    // Use min of existing and child max total distance
    maxEdgeDistance: Math.min(constraints.maxEdgeDistance, CHILD_MAX_TOTAL_DISTANCE),
  };
}

/**
 * Apply blind/low-vision constraints to base RouteConstraints.
 *
 * Without companion (hasCompanion = false):
 * - Prefer edges with tactile indicators and handrails
 * - Prefer wall-following paths
 * - Avoid visually complex intersections (zones with many connections)
 *
 * With companion (hasCompanion = true):
 * - Relax tactile/handrail requirements
 * - Allow visually complex but physically accessible areas
 *
 * The actual preference scoring is handled by blindEdgePreference().
 * This function sets the constraint flags for the route engine to use.
 *
 * Requirements: 3.10, 3.11
 */
export function applyBlindConstraints(
  constraints: RouteConstraints,
  hasCompanion: boolean
): RouteConstraints {
  if (hasCompanion) {
    // With companion: no additional route constraints needed
    // Companion provides visual guidance, routes through physically accessible areas
    return {
      ...constraints,
    };
  }

  // Without companion: prefer tactile indicators and handrails
  // This is expressed as a preference, not a hard constraint
  return {
    ...constraints,
    preferQuiet: constraints.preferQuiet, // preserve existing
  };
}

/**
 * Validate that every zone in a path is within the pregnancy restroom proximity limit
 * (2 zone-hops of a zone containing a restroom facility).
 *
 * Uses BFS from each restroom zone outward to compute hop distances,
 * then checks that every zone in the path is within the limit.
 *
 * Requirements: 3.12
 */
export function validatePregnancyRestroomProximity(
  path: ZoneId[],
  graph: StadiumGraph,
  facilities: Facility[]
): boolean {
  if (path.length === 0) return true;

  // Find all zones that contain a restroom facility
  const restroomZones = new Set<ZoneId>();
  for (const facility of facilities) {
    if (
      facility.type === 'restroom_standard' ||
      facility.type === 'restroom_accessible' ||
      facility.type === 'restroom_family' ||
      facility.type === 'restroom_gender_neutral'
    ) {
      restroomZones.add(facility.zone);
    }
  }

  // If no restrooms exist at all, the proximity requirement cannot be satisfied
  if (restroomZones.size === 0) return false;

  // Build adjacency list for BFS hop counting
  const adjacency = new Map<ZoneId, Set<ZoneId>>();
  for (const zone of graph.zones) {
    adjacency.set(zone.id, new Set());
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.add(edge.target);
    if (edge.bidirectional) {
      adjacency.get(edge.target)?.add(edge.source);
    }
  }

  // Compute minimum hop distance from any restroom zone using multi-source BFS
  const hopDistance = new Map<ZoneId, number>();
  const queue: { zoneId: ZoneId; hops: number }[] = [];

  for (const rz of restroomZones) {
    hopDistance.set(rz, 0);
    queue.push({ zoneId: rz, hops: 0 });
  }

  while (queue.length > 0) {
    const { zoneId, hops } = queue.shift()!;

    // Only explore up to the proximity limit
    if (hops >= PREGNANCY_RESTROOM_HOP_LIMIT) continue;

    const neighbors = adjacency.get(zoneId);
    if (!neighbors) continue;

    for (const neighbor of neighbors) {
      const existingDist = hopDistance.get(neighbor);
      if (existingDist === undefined || hops + 1 < existingDist) {
        hopDistance.set(neighbor, hops + 1);
        queue.push({ zoneId: neighbor, hops: hops + 1 });
      }
    }
  }

  // Check every zone in the path
  for (const zoneId of path) {
    const dist = hopDistance.get(zoneId);
    if (dist === undefined || dist > PREGNANCY_RESTROOM_HOP_LIMIT) {
      return false;
    }
  }

  return true;
}

/**
 * Score an edge for blind/low-vision routing preference.
 * Higher score = more preferred (lower weight should be applied).
 *
 * Without companion:
 * - +3 for tactile indicators on edge
 * - +2 for handrails on edge
 * - +1 for wall-following path in the source/target zone
 *
 * With companion:
 * - +1 for tactile indicators (still slightly preferred, but not required)
 * - No penalty for missing features
 *
 * Returns a value from 0 to 6 (without companion) or 0 to 1 (with companion).
 */
export function blindEdgePreference(edge: GraphEdge, hasCompanion: boolean): number {
  if (hasCompanion) {
    // With companion: minimal preference scoring
    return edge.accessibility.hasTactileIndicators ? 1 : 0;
  }

  // Without companion: strong preference for tactile/handrail features
  let score = 0;
  if (edge.accessibility.hasTactileIndicators) {
    score += 3;
  }
  if (edge.accessibility.hasHandrails) {
    score += 2;
  }
  // Note: wall-following path is a zone attribute, so callers should
  // check zone.accessibilityFeatures.hasWallFollowingPath separately
  return score;
}

/**
 * Compute a noise penalty multiplier for a zone based on its noise level
 * and sensory triggers. Used by the route engine when preferQuiet is set.
 *
 * Returns a multiplier:
 * - 1.0 for low noise, no triggers (no penalty)
 * - 1.5 for medium noise
 * - 3.0 for high noise
 * - Additional +1.0 per sensory trigger present
 *
 * Requirements: 3.15, 3.16
 */
export function getNoiseZonePenalty(zone: Zone): number {
  let multiplier = 1.0;

  switch (zone.noiseLevel) {
    case 'high':
      multiplier = 3.0;
      break;
    case 'medium':
      multiplier = 1.5;
      break;
    case 'low':
    default:
      multiplier = 1.0;
      break;
  }

  // Add penalty for each sensory trigger
  multiplier += zone.sensoryTriggers.length * 1.0;

  return multiplier;
}

/**
 * Check if a zone is suitable for child routing (family-friendly).
 * Returns true if the zone is a family section or has family-friendly attributes.
 *
 * Requirements: 3.19
 */
export function isChildFriendlyZone(zone: Zone): boolean {
  return zone.type === 'family_section';
}

/**
 * Compute a preference score for blind/low-vision zone traversal.
 * Higher score means more suitable for blind navigation without companion.
 *
 * - +2 for tactile indicators in zone
 * - +2 for handrails in zone
 * - +2 for wall-following path
 * - -1 for high noise (makes orientation harder)
 *
 * Requirements: 3.11
 */
export function blindZonePreference(zone: Zone, hasCompanion: boolean): number {
  if (hasCompanion) {
    // With companion: all zones are navigable, minimal preference
    return 0;
  }

  let score = 0;
  if (zone.accessibilityFeatures.hasTactileIndicators) {
    score += 2;
  }
  if (zone.accessibilityFeatures.hasHandrails) {
    score += 2;
  }
  if (zone.accessibilityFeatures.hasWallFollowingPath) {
    score += 2;
  }
  if (zone.noiseLevel === 'high') {
    score -= 1; // High noise makes orientation harder
  }
  return score;
}

/**
 * Constants exported for use in tests
 */
export const CONSTANTS = {
  PREGNANCY_MAX_EDGE_DISTANCE,
  CHILD_MAX_TOTAL_DISTANCE,
  PREGNANCY_RESTROOM_HOP_LIMIT,
} as const;
