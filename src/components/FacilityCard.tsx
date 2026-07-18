/**
 * FacilityCard — A single facility result card showing name, type, queue, status, and allergen warnings.
 * Extracted from FacilityFinder for modularity and reusability.
 *
 * Requirements: 13.1–13.8, 14.1–14.8
 */

import type { Facility, FacilityType } from '@/types/facility';
import { flagAllergens } from '@/services/facility-registry';

export interface FacilityCardProps {
  facility: Facility;
  allergens: string[];
  onNavigate: (zoneId: string) => void;
}

/**
 * Renders a single facility result with queue info, status, dietary tags,
 * allergen warnings, and a navigate button.
 */
export function FacilityCard({
  facility,
  allergens,
  onNavigate,
}: FacilityCardProps) {
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
 * Status badge for facility open/closed/limited state.
 */
export function StatusBadge({ status }: { status: Facility['status'] }) {
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
export function formatFacilityType(type: FacilityType): string {
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
