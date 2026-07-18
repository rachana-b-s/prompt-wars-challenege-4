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
import { search, sortFacilities, flagAllergens } from '@/services/facility-registry';
import type { Facility, FacilityType, DietaryFilter } from '@/types/facility';
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
  const PAGE_SIZE = 4;

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
  useEffect(() => {
    if (routeStatus === 'not_found') {
      setNavFeedback({ type: 'error', message: 'No route available. Try adjusting your accessibility or allegiance settings in the Profile tab.' });
    }
  }, [routeStatus]);

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
  useEffect(() => {
    setCurrentPage(0);
  }, [activeTab, selectedDietary, cuisineFilter, kidFriendlyOnly, maxQueue, restroomType, sortBy]);

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
          <CategoryTab
            id="facility-tab-food"
            label="Food"
            isActive={activeTab === 'food'}
            panelId="facility-panel-food"
            onClick={() => setActiveTab('food')}
          />
          <CategoryTab
            id="facility-tab-restrooms"
            label="Restrooms"
            isActive={activeTab === 'restrooms'}
            panelId="facility-panel-restrooms"
            onClick={() => setActiveTab('restrooms')}
          />
          <CategoryTab
            id="facility-tab-medical"
            label="Medical"
            isActive={activeTab === 'medical'}
            panelId="facility-panel-medical"
            onClick={() => setActiveTab('medical')}
          />
          <CategoryTab
            id="facility-tab-comfort"
            label="Comfort"
            isActive={activeTab === 'comfort'}
            panelId="facility-panel-comfort"
            onClick={() => setActiveTab('comfort')}
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
          <p className="text-sm text-gray-500 italic py-4 text-center">
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
                  <p className="text-xs text-gray-500 dark:text-gray-400">
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
                        className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
                      >
                        ← Prev
                      </button>
                      <span className="text-xs text-gray-500">{currentPage + 1} / {totalPages}</span>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={currentPage >= totalPages - 1}
                        className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-foreground hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
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

/**
 * A single facility result card showing name, type, queue, status, and allergen warnings.
 */
function FacilityCard({
  facility,
  allergens,
  onNavigate,
}: {
  facility: Facility;
  allergens: string[];
  onNavigate: (zoneId: string) => void;
}) {
  const matchedAllergens = flagAllergens(facility, allergens);
  const hasAllergenWarning = matchedAllergens.length > 0;

  return (
    <li className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-foreground truncate">
            {facility.name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {formatFacilityType(facility.type)}
            {facility.attributes.cuisineType && ` · ${facility.attributes.cuisineType}`}
          </p>
        </div>

        {/* Status badge */}
        <StatusBadge status={facility.status} />
      </div>

      {/* Queue and info row */}
      <div className="flex items-center gap-3 mt-2 text-xs">
        <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400">
          <ClockIcon />
          {facility.queueEstimate} min queue
        </span>
        <span className="text-gray-400 dark:text-gray-500">
          Zone: {facility.zone}
        </span>
      </div>

      {/* Allergen warning */}
      {hasAllergenWarning && (
        <div
          className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded px-2 py-1"
          role="alert"
          aria-label={`Allergen warning: contains ${matchedAllergens.join(', ')}`}
        >
          <WarningIcon />
          <span>
            Allergen: {matchedAllergens.join(', ')}
          </span>
        </div>
      )}

      {/* Dietary tags */}
      {facility.attributes.dietaryOptions && facility.attributes.dietaryOptions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {facility.attributes.dietaryOptions.map((d) => (
            <span
              key={d}
              className="px-1.5 py-0.5 text-[10px] rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
            >
              {d.replace('_', ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Kid-friendly indicator */}
      {facility.attributes.kidFriendly && (
        <span className="inline-block mt-2 px-1.5 py-0.5 text-[10px] rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">
          Kid-friendly
        </span>
      )}

      {/* Navigate button */}
      <button
        onClick={() => onNavigate(facility.zone)}
        className="mt-2 w-full py-1.5 text-xs font-medium rounded bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800 transition-colors"
        aria-label={`Navigate to ${facility.name}`}
      >
        Navigate to {facility.zone}
      </button>
    </li>
  );
}

/**
 * Accessible category tab button.
 */
function CategoryTab({
  id,
  label,
  isActive,
  panelId,
  onClick,
}: {
  id: string;
  label: string;
  isActive: boolean;
  panelId: string;
  onClick: () => void;
}) {
  return (
    <button
      id={id}
      role="tab"
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus:outline-2 focus:outline-blue-600 focus:outline-offset-[-2px] ${
        isActive
          ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Status badge for facility open/closed/limited.
 */
function StatusBadge({ status }: { status: Facility['status'] }) {
  const styles = {
    open: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400',
    closed: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
    limited: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400',
  };

  return (
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${styles[status]}`}>
      {status}
    </span>
  );
}

/** Format a FacilityType enum to readable text. */
function formatFacilityType(type: FacilityType): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Small clock icon for queue display. */
function ClockIcon() {
  return (
    <svg
      className="w-3 h-3"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <path strokeWidth="2" strokeLinecap="round" d="M12 6v6l4 2" />
    </svg>
  );
}

/** Small warning icon for allergen display. */
function WarningIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 flex-shrink-0"
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}
