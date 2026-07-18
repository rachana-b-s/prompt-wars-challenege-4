'use client';

/**
 * DestinationSelector — searchable destination picker with categorized zones,
 * recent destinations quick-select, and map tap integration.
 *
 * Requirements: 11.1, 11.2, 11.4, 11.5
 */

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useStadiumStore } from '@/stores/stadium-store';
import { useFanStore } from '@/stores/fan-store';
import { UI_CONSTANTS } from '@/constants';
import type { Zone, ZoneType } from '@/types/stadium';

/** Category definition for grouping zones */
interface ZoneCategory {
  label: string;
  types: ZoneType[];
}

const ZONE_CATEGORIES: ZoneCategory[] = [
  { label: 'Gates', types: ['gate'] },
  { label: 'Restrooms', types: ['restroom_cluster'] },
  { label: 'Concessions', types: ['concession_area'] },
  { label: 'Seating', types: ['seating_section'] },
  { label: 'First Aid', types: ['medical_area'] },
  { label: 'Family', types: ['family_section'] },
  { label: 'Accessible', types: ['accessible_seating'] },
];

/** Debounce delay for search input (must be <500ms per Req 11.5) */
const SEARCH_DEBOUNCE_MS = UI_CONSTANTS.SEARCH_DEBOUNCE_MS;

export interface DestinationSelectorProps {
  /** Called when the user selects a destination zone */
  onSelectDestination: (zoneId: string) => void;
  /** Currently selected destination, if any */
  selectedDestination?: string;
}

export function DestinationSelector({
  onSelectDestination,
  selectedDestination,
}: DestinationSelectorProps) {
  const graph = useStadiumStore((s) => s.graph);
  const recentDestinations = useFanStore((s) => s.profile.recentDestinations);
  const addRecentDestination = useFanStore((s) => s.addRecentDestination);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery]);

  const zones: Zone[] = useMemo(() => graph?.zones ?? [], [graph]);

  // Filter zones by search query (case-insensitive name match)
  const filteredZones = useMemo(() => {
    if (!debouncedQuery.trim()) return zones;
    const query = debouncedQuery.trim().toLowerCase();
    return zones.filter((z) => z.name.toLowerCase().includes(query));
  }, [zones, debouncedQuery]);

  // Group filtered zones by category
  const categorizedZones = useMemo(() => {
    const result: { label: string; zones: Zone[] }[] = [];
    for (const category of ZONE_CATEGORIES) {
      const matching = filteredZones.filter((z) =>
        category.types.includes(z.type)
      );
      if (matching.length > 0) {
        result.push({ label: category.label, zones: matching });
      }
    }
    // Collect uncategorized zones
    const categorizedTypes = new Set(ZONE_CATEGORIES.flatMap((c) => c.types));
    const uncategorized = filteredZones.filter(
      (z) => !categorizedTypes.has(z.type)
    );
    if (uncategorized.length > 0) {
      result.push({ label: 'Other', zones: uncategorized });
    }
    return result;
  }, [filteredZones]);

  // Resolve recent destination IDs to Zone objects
  const recentZones = useMemo(() => {
    if (!recentDestinations.length) return [];
    return recentDestinations
      .map((id) => zones.find((z) => z.id === id))
      .filter((z): z is Zone => z !== undefined);
  }, [recentDestinations, zones]);

  const handleSelect = useCallback(
    (zoneId: string) => {
      addRecentDestination(zoneId);
      onSelectDestination(zoneId);
    },
    [addRecentDestination, onSelectDestination]
  );

  const isSearching = debouncedQuery.trim().length > 0;

  return (
    <div className="flex flex-col gap-3" role="search" aria-label="Destination search">
      {/* Search input */}
      <div>
        <label
          htmlFor="destination-search"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Search destination
        </label>
        <input
          id="destination-search"
          type="search"
          placeholder="Search zones by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-2 focus:outline-blue-600 focus:border-blue-600"
          aria-describedby="destination-search-hint"
        />
        <p id="destination-search-hint" className="sr-only">
          Type to search for stadium zones. Results update within 500 milliseconds.
        </p>
      </div>

      {/* Recent destinations */}
      {!isSearching && recentZones.length > 0 && (
        <section aria-labelledby="recent-destinations-heading">
          <h3
            id="recent-destinations-heading"
            className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1"
          >
            Recent
          </h3>
          <ul className="flex flex-wrap gap-1" role="list">
            {recentZones.map((zone) => (
              <li key={zone.id}>
                <button
                  onClick={() => handleSelect(zone.id)}
                  aria-pressed={selectedDestination === zone.id}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors focus:outline-2 focus:outline-blue-600 ${
                    selectedDestination === zone.id
                      ? 'bg-blue-100 dark:bg-blue-900 border-blue-400 text-blue-800 dark:text-blue-200'
                      : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {zone.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Categorized zone list */}
      <section aria-labelledby="zones-list-heading">
        <h3
          id="zones-list-heading"
          className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1"
        >
          {isSearching ? 'Search Results' : 'All Destinations'}
        </h3>

        {filteredZones.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 py-2">
            No zones found matching &quot;{debouncedQuery}&quot;.
          </p>
        ) : (
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {categorizedZones.map((category) => (
              <div key={category.label}>
                <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {category.label}
                </h4>
                <ul role="listbox" aria-label={`${category.label} destinations`}>
                  {category.zones.map((zone) => (
                    <li key={zone.id} role="option" aria-selected={selectedDestination === zone.id}>
                      <button
                        onClick={() => handleSelect(zone.id)}
                        className={`w-full text-left px-3 py-2 text-sm rounded transition-colors focus:outline-2 focus:outline-blue-600 ${
                          selectedDestination === zone.id
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                            : 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        aria-label={`Select ${zone.name} as destination`}
                      >
                        {zone.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
