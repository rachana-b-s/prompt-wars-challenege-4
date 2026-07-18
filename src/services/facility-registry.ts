/**
 * Facility Registry Service — pure functional API for facility search, filtering, and sorting.
 *
 * Provides search and filtering functions for the facility registry, including
 * dietary filtering, type filtering, combined filtering (AND conjunction), proximity
 * sorting using BFS zone distance, and allergen flagging.
 *
 * Requirements: 13.1, 13.6, 13.8, 14.1, 16.4, 17.7, 17.8
 */

import type { Facility, FacilityType, DietaryFilter } from '@/types/facility';
import type { ZoneId, StadiumGraph } from '@/types/stadium';

export interface FacilitySearchOptions {
  type?: FacilityType;
  dietaryFilter?: DietaryFilter[];
  cuisineType?: string;
  kidFriendly?: boolean;
  maxQueueEstimate?: number;
  zone?: ZoneId; // for proximity-based results
  allergens?: string[]; // flag facilities with matching allergens
}

export type SortBy = 'proximity' | 'queue';

/**
 * Search facilities using combined filters (AND conjunction).
 * All active filters are applied in sequence; results satisfy ALL filters simultaneously.
 *
 * Validates: Requirements 13.1, 13.6, 13.8, 14.1, 16.4
 */
export function search(facilities: Facility[], options: FacilitySearchOptions): Facility[] {
  let results = facilities;

  if (options.type !== undefined) {
    results = filterByType(results, options.type);
  }

  if (options.dietaryFilter !== undefined && options.dietaryFilter.length > 0) {
    results = filterByDietary(results, options.dietaryFilter);
  }

  if (options.cuisineType !== undefined) {
    results = results.filter(
      (f) =>
        f.attributes.cuisineType !== undefined &&
        f.attributes.cuisineType.toLowerCase() === options.cuisineType!.toLowerCase()
    );
  }

  if (options.kidFriendly === true) {
    results = results.filter((f) => f.attributes.kidFriendly === true);
  }

  if (options.maxQueueEstimate !== undefined) {
    results = results.filter((f) => f.queueEstimate <= options.maxQueueEstimate!);
  }

  return results;
}

/**
 * Filter facilities to only those whose dietaryOptions include ALL requested filters.
 * A facility matches if its attributes.dietaryOptions array contains every filter
 * in the provided filters array (intersection logic).
 *
 * Validates: Requirements 13.1
 */
export function filterByDietary(facilities: Facility[], filters: DietaryFilter[]): Facility[] {
  if (filters.length === 0) {
    return facilities;
  }

  return facilities.filter((f) => {
    const options = f.attributes.dietaryOptions;
    if (!options || options.length === 0) {
      return false;
    }
    return filters.every((filter) => options.includes(filter));
  });
}

/**
 * Filter facilities to only those matching the specified FacilityType.
 *
 * Validates: Requirements 14.1
 */
export function filterByType(facilities: Facility[], type: FacilityType): Facility[] {
  return facilities.filter((f) => f.type === type);
}

/**
 * Find the nearest facility of a given type from a zone using BFS zone distance
 * (number of edge hops in the stadium graph).
 * Returns undefined if no facility of the given type exists.
 *
 * Validates: Requirements 17.7
 */
export function getNearestByType(
  facilities: Facility[],
  type: FacilityType,
  fromZone: ZoneId,
  graph: StadiumGraph
): Facility | undefined {
  const matchingFacilities = facilities.filter((f) => f.type === type);

  if (matchingFacilities.length === 0) {
    return undefined;
  }

  const distances = computeZoneDistances(fromZone, graph);

  let nearest: Facility | undefined;
  let minDistance = Infinity;

  for (const facility of matchingFacilities) {
    const distance = distances.get(facility.zone) ?? Infinity;
    if (distance < minDistance) {
      minDistance = distance;
      nearest = facility;
    }
  }

  return nearest;
}

/**
 * Sort facilities by proximity (zone hops from a given zone) or queue estimate.
 * For proximity sort, a graph and fromZone are required.
 * Facilities with unknown zone distance are placed at the end.
 *
 * Validates: Requirements 17.8
 */
export function sortFacilities(
  facilities: Facility[],
  sortBy: SortBy,
  fromZone?: ZoneId,
  graph?: StadiumGraph
): Facility[] {
  if (sortBy === 'queue') {
    return [...facilities].sort((a, b) => a.queueEstimate - b.queueEstimate);
  }

  // Sort by proximity
  if (!fromZone || !graph) {
    // Cannot compute proximity without zone and graph; return as-is
    return [...facilities];
  }

  const distances = computeZoneDistances(fromZone, graph);

  return [...facilities].sort((a, b) => {
    const distA = distances.get(a.zone) ?? Infinity;
    const distB = distances.get(b.zone) ?? Infinity;
    return distA - distB;
  });
}

/**
 * Flag allergens present in a facility's allergenInfo that match the fan's declared allergens.
 * Returns the list of matching allergens (intersection of facility's allergenInfo and fan's allergens).
 *
 * Validates: Requirements 13.5
 */
export function flagAllergens(facility: Facility, allergens: string[]): string[] {
  const facilityAllergens = facility.attributes.allergenInfo;
  if (!facilityAllergens || facilityAllergens.length === 0 || allergens.length === 0) {
    return [];
  }

  const allergenSet = new Set(allergens.map((a) => a.toLowerCase()));
  return facilityAllergens.filter((a) => allergenSet.has(a.toLowerCase()));
}

/**
 * BFS from a starting zone to compute the hop distance to every reachable zone.
 * Uses bidirectional edges from the stadium graph.
 */
function computeZoneDistances(fromZone: ZoneId, graph: StadiumGraph): Map<ZoneId, number> {
  const distances = new Map<ZoneId, number>();
  distances.set(fromZone, 0);

  const queue: ZoneId[] = [fromZone];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    const currentDist = distances.get(current)!;

    for (const edge of graph.edges) {
      let neighbor: ZoneId | null = null;

      if (edge.source === current) {
        neighbor = edge.target;
      } else if (edge.bidirectional && edge.target === current) {
        neighbor = edge.source;
      }

      if (neighbor !== null && !distances.has(neighbor)) {
        distances.set(neighbor, currentDist + 1);
        queue.push(neighbor);
      }
    }
  }

  return distances;
}
