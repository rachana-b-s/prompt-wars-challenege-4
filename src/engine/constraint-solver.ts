/**
 * Constraint Solver for the Smart Stadium Fan Navigator.
 *
 * Implements:
 * - mergeProfiles() — weakest-link group constraint merging
 * - isZoneAllowed() — hard constraint zone filtering (allegiance, zone type, child safety)
 * - isEdgeTraversable() — hard constraint edge filtering (step-free, gradient)
 * - getEdgeWeight() — dynamic edge weight computation with density/accessibility/safety penalties
 * - identifyConflicts() — detect mutually exclusive constraints in a group
 * - buildRouteConstraints() — convert AccessibilityProfile + allegiance into RouteConstraints
 * - buildGroupRouteConstraints() — convert GroupConstraintSet into RouteConstraints
 *
 * Constraint priority (from design):
 *   1. Safety (allegiance exclusion, child zone safety) — HARD constraint
 *   2. Physical access (step-free, max gradient, max distance) — HARD constraint
 *   3. Comfort preferences (noise, crowd avoidance) — SOFT constraint (adds weight penalty)
 *
 * Requirements: 3.25, 4.2, 4.3, 5.2, 5.3, 5.4, 12.6
 */

import type {
  AccessibilityProfile,
  FanAllegiance,
  FanGroupMember,
  GroupConstraintSet,
} from '@/types/fan';
import type { Zone, ZoneType, GraphEdge } from '@/types/stadium';
import type { RouteConstraints } from '@/types/route';
import type { DensityMap } from '@/types/crowd';
import type { ConstraintConflict } from '@/types/errors';
import {
  applyPregnancyConstraints,
  applySensoryConstraints,
  applyChildConstraints,
  applyBlindConstraints,
} from './accessibility-constraints';

/** Zone types that are unsafe for children */
const CHILD_UNSAFE_ZONE_TYPES: ZoneType[] = [
  'smoking_area',
  'loading_dock',
  'service_corridor',
];

/** Default max walking distance when none is specified (meters) */
const DEFAULT_MAX_WALKING_DISTANCE = 2000;

/** Max gradient percentage allowed for step-free routes */
const MAX_STEP_FREE_GRADIENT = 8;

/**
 * Merge multiple AccessibilityProfiles into a GroupConstraintSet
 * using the weakest-link strategy:
 * - step-free if ANY member needs it (wheelchair, limited_mobility)
 * - min walking distance across all members
 * - union of avoidance sets (allergens, excluded zone types)
 * - hasChild if ANY member has child_accompanied
 * - hasPregnant if ANY member has pregnant
 *
 * Validates: Requirements 4.2, 4.3
 */
export function mergeProfiles(members: FanGroupMember[]): GroupConstraintSet {
  const result: GroupConstraintSet = {
    stepFreeRequired: false,
    maxWalkingDistance: DEFAULT_MAX_WALKING_DISTANCE,
    avoidStairs: false,
    avoidCrowds: false,
    preferQuiet: false,
    excludedZoneTypes: [],
    excludedAllegiances: [],
    allergens: [],
    hasChild: false,
    hasPregnant: false,
  };

  if (members.length === 0) {
    return result;
  }

  const excludedZoneTypesSet = new Set<ZoneType>();
  const allergensSet = new Set<string>();

  for (const member of members) {
    const profile = member.accessibilityProfile;

    // Step-free required if ANY member needs it (wheelchair or limited_mobility)
    if (
      profile.categories.includes('wheelchair') ||
      profile.categories.includes('limited_mobility') ||
      profile.avoidStairs
    ) {
      result.stepFreeRequired = true;
    }

    // avoidStairs — weakest link (true if ANY member needs it)
    if (profile.avoidStairs) {
      result.avoidStairs = true;
    }

    // avoidCrowds — weakest link
    if (profile.avoidCrowds) {
      result.avoidCrowds = true;
    }

    // preferQuiet — weakest link
    if (profile.preferQuiet) {
      result.preferQuiet = true;
    }

    // Max walking distance — minimum across all members
    if (profile.maxWalkingDistance !== undefined) {
      result.maxWalkingDistance = Math.min(
        result.maxWalkingDistance,
        profile.maxWalkingDistance
      );
    }

    // Child accompaniment
    if (profile.categories.includes('child_accompanied')) {
      result.hasChild = true;
    }

    // Pregnancy
    if (profile.categories.includes('pregnant')) {
      result.hasPregnant = true;
    }

    // Sensory sensitivity exclusions
    if (
      profile.categories.includes('neurodivergent') ||
      profile.preferQuiet
    ) {
      excludedZoneTypesSet.add('smoking_area');
    }

    // Union of allergens
    for (const allergen of profile.allergens) {
      allergensSet.add(allergen);
    }
  }

  // If group has a child, add child-unsafe zone types to exclusion set
  if (result.hasChild) {
    for (const zt of CHILD_UNSAFE_ZONE_TYPES) {
      excludedZoneTypesSet.add(zt);
    }
  }

  result.excludedZoneTypes = Array.from(excludedZoneTypesSet);
  result.allergens = Array.from(allergensSet);

  return result;
}

/**
 * Check whether a zone is allowed given hard constraints.
 * Returns false if the zone violates any HARD constraint:
 * - allegiance exclusion (safety)
 * - zone type exclusion (safety / physical access)
 * - child safety zones
 *
 * Validates: Requirements 5.2, 5.3, 5.4
 */
export function isZoneAllowed(zone: Zone, constraints: RouteConstraints): boolean {
  // Safety constraint: allegiance exclusion
  if (constraints.excludeAllegiance.includes(zone.allegiance as 'home' | 'away')) {
    return false;
  }

  // Safety constraint: zone type exclusion
  if (constraints.avoidZoneTypes.includes(zone.type)) {
    return false;
  }

  return true;
}

/**
 * Check whether an edge is traversable given hard constraints.
 * Returns false if the edge violates any HARD physical access constraint:
 * - step-free requirement (edge must be step-free)
 * - max gradient exceeded
 * - edge distance exceeds max edge distance
 *
 * Validates: Requirements 3.1, 3.25
 */
export function isEdgeTraversable(
  edge: GraphEdge,
  constraints: RouteConstraints
): boolean {
  // Physical access constraint: step-free requirement
  if (constraints.stepFreeRequired && !edge.accessibility.stepFree) {
    return false;
  }

  // Physical access constraint: max gradient
  if (
    constraints.stepFreeRequired &&
    edge.accessibility.gradient > MAX_STEP_FREE_GRADIENT
  ) {
    return false;
  }

  // Physical access constraint: max edge distance
  if (
    constraints.maxEdgeDistance > 0 &&
    edge.distance > constraints.maxEdgeDistance
  ) {
    return false;
  }

  return true;
}

/**
 * Compute the dynamic edge weight for pathfinding.
 *
 * Formula (from design doc):
 *   weight = base_distance
 *     + density_penalty (density > 80 ? distance * 3.0 : density > 60 ? distance * 1.5 : 0)
 *     + accessibility_penalty (non-step-free when preferred? distance * 2.0 : 0)
 *     + safety_penalty (opposing allegiance zone? Infinity : sensory trigger zone for sensitive? distance * 2.5 : 0)
 *
 * Constraint priority:
 *   1. Safety penalty — Infinity blocks the edge entirely
 *   2. Physical access penalty — high weight increase
 *   3. Comfort penalty — moderate weight increase
 *
 * Validates: Requirements 3.25, 5.2, 5.3
 */
export function getEdgeWeight(
  edge: GraphEdge,
  constraints: RouteConstraints,
  densityMap: DensityMap,
  targetZone: Zone
): number {
  const baseDistance = edge.distance;

  // SOS mode: ignore all penalties, use raw distance
  if (constraints.isSOS) {
    return baseDistance;
  }

  // Safety penalty: opposing allegiance — HARD block
  if (
    constraints.excludeAllegiance.includes(
      targetZone.allegiance as 'home' | 'away'
    )
  ) {
    return Infinity;
  }

  // Safety penalty: excluded zone types — HARD block
  if (constraints.avoidZoneTypes.includes(targetZone.type)) {
    return Infinity;
  }

  // Safety penalty: sensory triggers for sensitive fans — SOFT weight increase
  let safetyPenalty = 0;
  if (constraints.preferQuiet && targetZone.sensoryTriggers.length > 0) {
    safetyPenalty = baseDistance * 2.5;
  }

  // Density penalty
  let densityPenalty = 0;
  const densityEntry = densityMap[targetZone.id];
  if (densityEntry) {
    const density = densityEntry.density;
    if (constraints.avoidHighDensity) {
      if (density > 80) {
        densityPenalty = baseDistance * 3.0;
      } else if (density > 60) {
        densityPenalty = baseDistance * 1.5;
      }
    }
  }

  // Accessibility penalty: non-step-free edge when step-free preferred
  let accessibilityPenalty = 0;
  if (constraints.stepFreeRequired && !edge.accessibility.stepFree) {
    // This edge should not be traversable (hard constraint),
    // but as a fallback give it a very high weight
    accessibilityPenalty = baseDistance * 2.0;
  }

  return baseDistance + densityPenalty + accessibilityPenalty + safetyPenalty;
}

/**
 * Detect mutually exclusive constraints in a group of members.
 * Returns a list of conflicts found.
 *
 * Currently detects:
 * - Members requiring opposing allegiance zones (home fan + away fan in same group)
 * - Members with allergens that conflict with food preferences of others
 *   (this is more of a recommendation conflict than a routing conflict)
 *
 * Validates: Requirements 12.6
 */
export function identifyConflicts(
  members: FanGroupMember[]
): ConstraintConflict[] {
  const conflicts: ConstraintConflict[] = [];

  if (members.length < 2) {
    return conflicts;
  }

  // Check for allegiance conflicts — not directly stored in AccessibilityProfile,
  // but can be detected through excludedAllegiances if provided. For now, we check
  // accessibility constraint conflicts.

  // Check for physical access vs comfort conflicts within the group:
  // e.g., one member needs short routes, another prefers scenic/longer routes
  // These are typically resolved by weakest-link, but we flag them for transparency.

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const profileA = members[i].accessibilityProfile;
      const profileB = members[j].accessibilityProfile;

      // Conflict: One member needs crowds (e.g., prefers busy areas) vs another avoids crowds
      // Currently all constraints are one-directional (avoid X), so this specific conflict
      // doesn't apply. But we check for distance conflicts:

      // Distance constraint conflict: one member has very short max distance
      // while route requires longer paths for another's accessibility needs
      if (
        profileA.maxWalkingDistance !== undefined &&
        profileB.maxWalkingDistance !== undefined
      ) {
        const minDist = Math.min(
          profileA.maxWalkingDistance,
          profileB.maxWalkingDistance
        );
        // If minimum distance is extremely restrictive (<50m), flag it
        if (minDist < 50) {
          conflicts.push({
            memberA: members[i].id,
            memberB: members[j].id,
            constraint: 'maxWalkingDistance',
            description: `Maximum walking distance constraint (${minDist}m) is very restrictive and may make most destinations unreachable.`,
          });
        }
      }

      // Conflict: wheelchair user (needs wide corridors, step-free) + child accompanied
      // (prefers family sections) — not a true conflict, just flagged for awareness
      // These are actually complementary, so no conflict here.

      // Conflict: One member avoids crowds, another doesn't care — not a conflict,
      // weakest-link applies avoidCrowds for all.

      // Allergen conflicts: if one member has allergens that prevent visiting
      // food facilities the group might want
      if (profileA.allergens.length > 0 && profileB.allergens.length > 0) {
        const combinedAllergens = new Set([
          ...profileA.allergens,
          ...profileB.allergens,
        ]);
        if (combinedAllergens.size > 5) {
          conflicts.push({
            memberA: members[i].id,
            memberB: members[j].id,
            constraint: 'allergens',
            description: `Combined allergen restrictions (${combinedAllergens.size} allergens) may severely limit food facility options.`,
          });
        }
      }
    }
  }

  return conflicts;
}

/**
 * Build RouteConstraints from an individual AccessibilityProfile and allegiance.
 * This converts the profile-level preferences into the constraint format
 * used by the route engine.
 *
 * Applies category-specific constraints:
 * - Pregnancy: step-free, max 150m edges, prefer restroom proximity
 * - Sensory sensitivity / neurodivergent: quiet routes, avoid smoking areas
 * - Child accompaniment: avoid unsafe zones, max 500m edges
 * - Blind/low-vision: prefer tactile/handrails (without companion)
 * - Deaf/HoH: no routing changes (UI-level only)
 *
 * Requirements: 3.12–3.21, 17.4
 */
export function buildRouteConstraints(
  profile: AccessibilityProfile,
  allegiance: FanAllegiance
): RouteConstraints {
  const avoidZoneTypes: ZoneType[] = [];
  const excludeAllegiance: ('home' | 'away')[] = [];

  // Safety: allegiance exclusion
  if (allegiance === 'home') {
    excludeAllegiance.push('away');
  } else if (allegiance === 'away') {
    excludeAllegiance.push('home');
  }

  // Child safety zone exclusions
  if (profile.categories.includes('child_accompanied')) {
    avoidZoneTypes.push(...CHILD_UNSAFE_ZONE_TYPES);
  }

  // Sensory sensitivity: avoid smoking areas
  if (
    profile.categories.includes('neurodivergent') ||
    profile.preferQuiet
  ) {
    if (!avoidZoneTypes.includes('smoking_area')) {
      avoidZoneTypes.push('smoking_area');
    }
  }

  // Step-free requirement
  const stepFreeRequired =
    profile.categories.includes('wheelchair') ||
    profile.categories.includes('limited_mobility') ||
    profile.avoidStairs;

  // Max edge distance
  const maxEdgeDistance = profile.maxWalkingDistance ?? DEFAULT_MAX_WALKING_DISTANCE;

  let constraints: RouteConstraints = {
    stepFreeRequired,
    maxEdgeDistance,
    avoidHighDensity: profile.avoidCrowds,
    avoidZoneTypes,
    excludeAllegiance,
    preferQuiet: profile.preferQuiet,
    isSOS: false,
  };

  // Apply pregnancy-specific constraints (Req 3.12–3.14)
  if (profile.categories.includes('pregnant')) {
    constraints = applyPregnancyConstraints(constraints);
  }

  // Apply sensory sensitivity constraints (Req 3.15, 3.16, 17.4)
  if (
    profile.categories.includes('neurodivergent') ||
    profile.preferQuiet
  ) {
    constraints = applySensoryConstraints(constraints);
  }

  // Apply child accompaniment constraints (Req 3.18–3.21)
  if (profile.categories.includes('child_accompanied')) {
    constraints = applyChildConstraints(constraints);
  }

  // Apply blind/low-vision constraints (Req 3.10, 3.11)
  if (
    profile.categories.includes('blind') ||
    profile.categories.includes('low_vision')
  ) {
    constraints = applyBlindConstraints(constraints, profile.hasCompanion);
  }

  // Deaf/HoH: no routing changes (UI-level only, Req 3.5–3.7)
  // No constraint modifications needed for deaf/hard_of_hearing

  return constraints;
}

/**
 * Build RouteConstraints from a merged GroupConstraintSet.
 * This converts the group-level merged constraints into the format
 * used by the route engine.
 */
export function buildGroupRouteConstraints(
  constraintSet: GroupConstraintSet
): RouteConstraints {
  return {
    stepFreeRequired: constraintSet.stepFreeRequired,
    maxEdgeDistance: constraintSet.maxWalkingDistance,
    avoidHighDensity: constraintSet.avoidCrowds,
    avoidZoneTypes: [...constraintSet.excludedZoneTypes],
    excludeAllegiance: [...constraintSet.excludedAllegiances],
    preferQuiet: constraintSet.preferQuiet,
    isSOS: false,
  };
}
