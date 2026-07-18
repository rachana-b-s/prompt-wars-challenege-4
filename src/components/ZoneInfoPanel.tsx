'use client';

/**
 * Panel displayed when a zone is tapped/clicked on the stadium map.
 * Shows zone name, type, allegiance, density, facilities, and actions.
 *
 * Requirements: 9.3, 11.1
 */

import { useFacilityStore } from '@/stores/facility-store';
import { useCrowdStore } from '@/stores/crowd-store';
import type { Zone } from '@/types/stadium';
import type { DensityLevel } from '@/types/crowd';

export interface ZoneInfoPanelProps {
  zone: Zone;
  onSetLocation: (zoneId: string) => void;
  onNavigateHere: (zoneId: string) => void;
  onClose: () => void;
}

const DENSITY_LABELS: Record<DensityLevel, { label: string; color: string }> = {
  green: { label: 'Low', color: 'bg-green-500' },
  yellow: { label: 'Moderate', color: 'bg-yellow-500' },
  red: { label: 'High', color: 'bg-red-500' },
};

const ALLEGIANCE_LABELS: Record<string, string> = {
  home: 'Home Team',
  away: 'Away Team',
  neutral: 'Neutral',
  buffer: 'Buffer Zone',
};

const ZONE_TYPE_LABELS: Record<string, string> = {
  gate: 'Gate',
  concourse: 'Concourse',
  seating_section: 'Seating Section',
  concession_area: 'Concession Area',
  restroom_cluster: 'Restroom Area',
  medical_area: 'Medical Area',
  family_section: 'Family Section',
  accessible_seating: 'Accessible Seating',
  service_corridor: 'Service Corridor',
  loading_dock: 'Loading Dock',
  smoking_area: 'Smoking Area',
  cooling_zone: 'Cooling Zone',
  prayer_area: 'Prayer Area',
};

export function ZoneInfoPanel({
  zone,
  onSetLocation,
  onNavigateHere,
  onClose,
}: ZoneInfoPanelProps) {
  const getByZone = useFacilityStore((state) => state.getByZone);
  const getDensity = useCrowdStore((state) => state.getDensity);

  const facilities = getByZone(zone.id);
  const densityEntry = getDensity(zone.id);
  const densityInfo = densityEntry
    ? DENSITY_LABELS[densityEntry.level]
    : { label: 'Unknown', color: 'bg-gray-400' };

  return (
    <div
      className="absolute top-4 left-4 right-4 md:left-auto md:right-4 md:top-4 md:w-80 max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-10"
      role="dialog"
      aria-label={`Zone information: ${zone.name}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {zone.name}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {ZONE_TYPE_LABELS[zone.type] ?? zone.type}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close zone info panel"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Density */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`w-3 h-3 rounded-full ${densityInfo.color}`}
          aria-hidden="true"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Density: {densityInfo.label}
          {densityEntry ? ` (${densityEntry.density}%)` : ''}
        </span>
      </div>

      {/* Allegiance */}
      <div className="mb-3">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          Allegiance: {ALLEGIANCE_LABELS[zone.allegiance] ?? zone.allegiance}
        </span>
      </div>

      {/* Facilities */}
      {facilities.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            Facilities ({facilities.length})
          </h4>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-0.5 max-h-24 overflow-y-auto">
            {facilities.map((facility) => (
              <li key={facility.id} className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    facility.status === 'open'
                      ? 'bg-green-500'
                      : facility.status === 'limited'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  aria-hidden="true"
                />
                <span>{facility.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onSetLocation(zone.id)}
          className="flex-1 px-3 py-2 text-sm font-medium rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 transition-colors"
        >
          Set as my location
        </button>
        <button
          onClick={() => onNavigateHere(zone.id)}
          className="flex-1 px-3 py-2 text-sm font-medium rounded-md bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-200 dark:hover:bg-green-800 transition-colors"
        >
          Navigate here
        </button>
      </div>
    </div>
  );
}
