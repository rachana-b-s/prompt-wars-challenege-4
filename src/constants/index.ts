/**
 * Application-wide constants.
 * Centralizes magic numbers and configuration values for maintainability.
 */

/** Route computation constants */
export const ROUTE_CONSTANTS = {
  /** Walking speed in meters per minute */
  WALKING_SPEED_M_PER_MIN: 80,
  /** Maximum retries for SOS alerts */
  MAX_SOS_RETRIES: 3,
  /** GenAI request timeout in milliseconds */
  GENAI_TIMEOUT_MS: 5000,
  /** Density staleness threshold in milliseconds */
  DENSITY_STALE_THRESHOLD_MS: 60_000,
  /** Maximum recent destinations stored */
  MAX_RECENT_DESTINATIONS: 5,
} as const;

/** UI constants */
export const UI_CONSTANTS = {
  /** Facility results per page */
  FACILITY_PAGE_SIZE: 4,
  /** Map minimum zoom scale */
  MAP_MIN_SCALE: 1,
  /** Map maximum zoom scale */
  MAP_MAX_SCALE: 4,
  /** Drag threshold in pixels */
  DRAG_THRESHOLD_PX: 5,
  /** Search debounce delay in ms */
  SEARCH_DEBOUNCE_MS: 200,
} as const;
