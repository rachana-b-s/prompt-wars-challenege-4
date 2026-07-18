'use client';

/**
 * FacilityFinder — tabbed interface for searching and filtering stadium facilities.
 * Supports food, restrooms, medical, and comfort amenity categories with
 * dietary, cuisine, restroom type, queue time, proximity, kid-friendly,
 * and allergen filtering.
 *
 * Requirements: 13.1–13.8, 14.1–14.8, 17.2–17.8
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useFacilityStore } from '@/stores/facility-store';
import { useStadiumStore } from '@/stores/stadium-store';
import { useFanStore } from '@/stores/fan-store';
import { useRouteStore } from '@/stores/route-store';
import { search, sortFacilities } from '@/services/facility-registry';
import { FacilityCard } from './FacilityCard';
import { TabButton } from '@/components/ui';
import { UI_CONSTANTS } from '@/constants';
import type { FacilityType, DietaryFilter } from '@/types/facility';
import type { SortBy } from '@/services/facility-registry';

type NavFeedback = { type: 'success' | 'error' | 'info'; message: string } | null;

type FacilityTab = 'food' | 'restrooms' | 'medical' | 'comfort';

const DIETARY_OPTIONS: { value: DietaryFilter; label: string }[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten_free', label: 'Gluten Free' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'nut_free', label: 'Nut Free' },
  { value: 'dairy_free', label: 'Dairy Free' },
];

const RESTROOM_TYPES: { value: FacilityType; label: string }[] = [
  { value: 'restroom_standard', label: 'Standard' },
  { value: 'restroom_accessible', label: 'Accessible' },
  { value: 'restroom_family', label: 'Family' },
  { value: 'restroom_gender_neutral', label: 'Gender Neutral' },
];

const FOOD_TYPES: FacilityType[] = ['food_stall', 'water_station'];
const MEDICAL_TYPES: FacilityType[] = ['first_aid', 'medical_center', 'AED_station'];
const COMFORT_TYPES: FacilityType[] = [
  'nursing_room',
  'charging_station',
  'prayer_room',
  'cooling_zone',
];

export function FacilityFinder() {
  const [activeTab, setActiveTab] = useState<FacilityTab>('food');
  const [selectedDietary, setSelectedDietary] = useState<DietaryFilter[]>([]);
  const [cuisineFilter, setCuisineFilter] = useState('');
  const [kidFriendlyOnly, setKidFriendlyOnly] = useState(false);
  const [maxQueue, setMaxQueue] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortBy>('queue');
  const [restroomType, setRestroomType] = useState<FacilityType | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = UI_CONSTANTS.FACILITY_PAGE_SIZE;

  const facilities = useFacilityStore((s) => s.facilities);
  const graph = useStadiumStore((s) => s.graph);
  const fanProfile = useFanStore((s) => s.profile);

  const currentZone = fanProfile.currentZone;
  const allergens = fanProfile.accessibilityProfile.allergens;

  const setDestination = useRouteStore((s) => s.setDestination);
  const addRecentDestination = useFanStore((s) => s.addRecentDestination);
  const routeStatus = useRouteStore((s) => s.route?.status);

  const [navFeedback, setNavFeedback] = useState<NavFeedback>(null);

  const handleNavigate = useCallback((zoneId: string) => {
    const currentZone = useFanStore.getState().profile.currentZone;
    if (!currentZone) {
      setNavFeedback({ type: 'info', message: 'Set your location on the map first (click a zone → "Set as my location")' });
      return;
    }
    setDestination(zoneId);
    addRecentDestination(zoneId);
    setNavFeedback({ type: 'success', message: `Navigating to ${zoneId}. Check the Route tab for directions.` });
    setTimeout(() => setNavFeedback(null), 3000);
  }, [setDestination, addRecentDestination]);

  // Show error feedback when route comes back as not_found
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (routeStatus === 'not_found') {
      setNavFeedback({ type: 'error', message: 'No route available. Try adjusting your accessibility or allegiance settings in the Profile tab.' });
    }
  }, [routeStatus]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Filter facilities based on active tab and filters
  const filteredFacilities = useMemo(() => {
    let typesToInclude: FacilityType[];

    switch (activeTab) {
      case 'food':
        typesToInclude = FOOD_TYPES;
        break;
      case 'restrooms':
        typesToInclude = restroomType
          ? [restroomType]
          : RESTROOM_TYPES.map((r) => r.value);
        break;
      case 'medical':
        typesToInclude = MEDICAL_TYPES;
        break;
      case 'comfort':
        typesToInclude = COMFORT_TYPES;
        break;
    }

    // Filter by types for the active tab
    const tabFacilities = facilities.filter((f) => typesToInclude.includes(f.type));

    // Apply additional filters via the search function (for food tab)
    if (activeTab === 'food') {
      const results = search(tabFacilities, {
        dietaryFilter: selectedDietary.length > 0 ? selectedDietary : undefined,
        cuisineType: cuisineFilter || undefined,
        kidFriendly: kidFriendlyOnly || undefined,
        maxQueueEstimate: maxQueue,
      });
      return results;
    }

    // For other tabs, only apply maxQueue filter
    if (maxQueue !== undefined) {
      return tabFacilities.filter((f) => f.queueEstimate <= maxQueue);
    }

    return tabFacilities;
  }, [
    facilities,
    activeTab,
    selectedDietary,
    cuisineFilter,
    kidFriendlyOnly,
    maxQueue,
    restroomType,
  ]);

  // Sort results
  const sortedFacilities = useMemo(() => {
    if (sortBy === 'proximity' && currentZone && graph) {
      return sortFacilities(filteredFacilities, 'proximity', currentZone, graph);
    }
    return sortFacilities(filteredFacilities, 'queue');
  }, [filteredFacilities, sortBy, currentZone, graph]);

  // Extract unique cuisine types for the filter dropdown
  const availableCuisines = useMemo(() => {
    const cuisines = new Set<string>();
    for (const f of facilities) {
      if (f.type === 'food_stall' && f.attributes.cuisineType) {
        cuisines.add(f.attributes.cuisineType);
      }
    }
    return Array.from(cuisines).sort();
  }, [facilities]);

  // Reset pagination when filters change
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setCurrentPage(0);
  }, [activeTab, selectedDietary, cuisineFilter, kidFriendlyOnly, maxQueue, restroomType, sortBy]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const toggleDietary = (filter: DietaryFilter) => {
    setSelectedDietary((prev) =>
      prev.includes(filter) ? prev.filter((d) => d !== filter) : [...prev, filter]
    );
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Facilities</h2>

      {/* Category Tabs */}
      <nav aria-label="Facility categories">
        <div role="tablist" className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <TabButton
            id="facility-tab-food"
            label="Food"
            isActive={activeTab === 'food'}
            panelId="facility-panel-food"
            onClick={() => setActiveTab('food')}
            variant="compact"
          />
          <TabButton
            id="facility-tab-restrooms"
            label="Restrooms"
            isActive={activeTab === 'restrooms'}
            panelId="facility-panel-restrooms"
            onClick={() => setActiveTab('restrooms')}
            variant="compact"
          />
          <TabButton
            id="facility-tab-medical"
            label="Medical"
            isActive={activeTab === 'medical'}
            panelId="facility-panel-medical"
            onClick={() => setActiveTab('medical')}
            variant="compact"
          />
          <TabButton
            id="facility-tab-comfort"
            label="Comfort"
            isActive={activeTab === 'comfort'}
            panelId="facility-panel-comfort"
            onClick={() => setActiveTab('comfort')}
            variant="compact"
          />
        </div>
      </nav>

      {/* Filters */}
      <div className="space-y-3">
        {/* Food tab filters */}
        {activeTab === 'food' && (
          <>
            {/* Dietary multi-select */}
            <fieldset>
              <legend className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Dietary Filters
              </legend>
              <div className="flex flex-wrap gap-1">
                {DIETARY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="checkbox"
                    aria-checked={selectedDietary.includes(opt.value)}
                    onClick={() => toggleDietary(opt.value)}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                      selectedDietary.includes(opt.value)
                        ? 'bg-blue-100 dark:bg-blue-900 border-blue-400 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Cuisine type filter */}
            <div>
              <label
                htmlFor="cuisine-filter"
                className="text-xs font-medium text-gray-600 dark:text-gray-400"
              >
                Cuisine Type
              </label>
              <select
                id="cuisine-filter"
                value={cuisineFilter}
                onChange={(e) => setCuisineFilter(e.target.value)}
                className="mt-1 block w-full text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground px-2 py-1.5"
              >
                <option value="">All cuisines</option>
                {availableCuisines.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Kid-friendly toggle */}
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={kidFriendlyOnly}
                onChange={(e) => setKidFriendlyOnly(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              Kid-friendly only
            </label>
          </>
        )}

        {/* Restrooms tab filter */}
        {activeTab === 'restrooms' && (
          <div>
            <label
              htmlFor="restroom-type-filter"
              className="text-xs font-medium text-gray-600 dark:text-gray-400"
            >
              Restroom Type
            </label>
            <select
              id="restroom-type-filter"
              value={restroomType ?? ''}
              onChange={(e) =>
                setRestroomType(
                  e.target.value ? (e.target.value as FacilityType) : undefined
                )
              }
              className="mt-1 block w-full text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground px-2 py-1.5"
            >
              <option value="">All types</option>
              {RESTROOM_TYPES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Common: Max queue filter */}
        <div>
          <label
            htmlFor="max-queue-filter"
            className="text-xs font-medium text-gray-600 dark:text-gray-400"
          >
            Max Queue (min)
          </label>
          <input
            id="max-queue-filter"
            type="number"
            min={0}
            value={maxQueue ?? ''}
            onChange={(e) =>
              setMaxQueue(e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder="No limit"
            className="mt-1 block w-full text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground px-2 py-1.5"
          />
        </div>

        {/* Sort toggle */}
        <div>
          <label
            htmlFor="sort-by"
            className="text-xs font-medium text-gray-600 dark:text-gray-400"
          >
            Sort by
          </label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="mt-1 block w-full text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground px-2 py-1.5"
          >
            <option value="queue">Queue Time</option>
            <option value="proximity">Proximity</option>
          </select>
        </div>
      </div>

      {/* Navigation feedback */}
      {navFeedback && (
        <div className={`px-3 py-2 rounded-md text-sm ${
          navFeedback.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800' :
          navFeedback.type === 'info' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800' :
          'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
        }`} role="alert">
          {navFeedback.message}
        </div>
      )}

      {/* Results */}
      <div
        id={`facility-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`facility-tab-${activeTab}`}
        className="space-y-2"
      >
        {sortedFacilities.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 italic py-4 text-center">
            No facilities match your filters.
          </p>
        ) : (
          <>
            {(() => {
              const totalPages = Math.ceil(sortedFacilities.length / PAGE_SIZE);
              const paginatedFacilities = sortedFacilities.slice(
                currentPage * PAGE_SIZE,
                (currentPage + 1) * PAGE_SIZE
              );
              return (
                <>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Page {currentPage + 1} of {totalPages} ({sortedFacilities.length} results)
                  </p>
                  <ul className="space-y-2" aria-label="Facility results">
                    {paginatedFacilities.map((facility) => (
                      <FacilityCard
                        key={facility.id}
                        facility={facility}
                        allergens={allergens}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </ul>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                        disabled={currentPage === 0}
                        className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ← Prev
                      </button>
                      <span className="text-xs text-gray-600 dark:text-gray-400">{currentPage + 1} / {totalPages}</span>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={currentPage >= totalPages - 1}
                        className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}






