/**
 * SOS Service — client-side emergency alert service with exponential backoff retry.
 *
 * Provides:
 * - sendSOSAlert(): POST to /api/sos with retry (1s, 2s, 4s — max 3 retries)
 * - sendLostChildAlert(): POST to /api/sos with retry for lost child protocol
 * - On persistent failure: returns failure result with zone for on-screen display
 * - computeEmergencyRoute(): Computes shortest path to nearest medical center
 *
 * Requirements: 15.2, 15.6, 15.8, 16.2
 */

import type { SOSAlert, LostChildProtocol } from '@/types/emergency';
import type { StadiumGraph, ZoneId } from '@/types/stadium';
import type { DensityMap } from '@/types/crowd';
import type { RouteResult } from '@/types/route';
import { computeSOSRoute } from '@/engine/route-engine';

// --- Types ---

export interface SOSResult {
  success: boolean;
  acknowledged: boolean;
  alertId?: string;
  /** On failure, the zone to display prominently on-screen */
  fallbackZone?: ZoneId;
  /** Error message if failed */
  error?: string;
  /** Number of retries attempted */
  retriesAttempted: number;
}

export interface EmergencyRouteResult {
  route: RouteResult | null;
  nearestMedicalZone?: ZoneId;
}

// --- Constants ---

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s exponential backoff
const SOS_ENDPOINT = '/api/sos';

// --- Helper Functions ---

/**
 * Delay execution for a given number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay for a given attempt.
 * Attempt 0: 1000ms, Attempt 1: 2000ms, Attempt 2: 4000ms
 */
function getBackoffDelay(attempt: number): number {
  return BASE_DELAY_MS * Math.pow(2, attempt);
}

// --- Public API ---

/**
 * Send an SOS alert to the server with exponential backoff retry.
 *
 * Retry strategy: 1s, 2s, 4s — max 3 retries.
 * On persistent failure: returns the current zone for on-screen display
 * so the fan can communicate location verbally to nearby staff.
 *
 * Requirements: 15.2, 15.8
 */
export async function sendSOSAlert(alert: SOSAlert): Promise<SOSResult> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(SOS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          acknowledged: data.acknowledged === true,
          alertId: data.id,
          retriesAttempted: attempt,
        };
      }

      lastError = `Server responded with status ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error';
    }

    // Don't delay after the last attempt
    if (attempt < MAX_RETRIES) {
      await delay(getBackoffDelay(attempt));
    }
  }

  // All retries exhausted — return failure with fallback zone
  return {
    success: false,
    acknowledged: false,
    fallbackZone: alert.zone,
    error: lastError ?? 'Failed to send SOS alert after multiple attempts',
    retriesAttempted: MAX_RETRIES,
  };
}

/**
 * Send a Lost Child Protocol alert to the server with exponential backoff retry.
 *
 * Requirements: 16.2
 */
export async function sendLostChildAlert(report: LostChildProtocol): Promise<SOSResult> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(SOS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          acknowledged: data.acknowledged === true,
          alertId: data.id,
          retriesAttempted: attempt,
        };
      }

      lastError = `Server responded with status ${response.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error';
    }

    // Don't delay after the last attempt
    if (attempt < MAX_RETRIES) {
      await delay(getBackoffDelay(attempt));
    }
  }

  // All retries exhausted
  return {
    success: false,
    acknowledged: false,
    fallbackZone: report.lastKnownZone,
    error: lastError ?? 'Failed to send lost child alert after multiple attempts',
    retriesAttempted: MAX_RETRIES,
  };
}

/**
 * Compute an emergency route to the nearest medical center.
 * Overrides normal crowd avoidance in favor of shortest path (SOS mode).
 *
 * Requirements: 15.6
 */
export function computeEmergencyRoute(
  graph: StadiumGraph,
  currentZone: ZoneId,
  densityMap: DensityMap
): EmergencyRouteResult {
  // Find all zones that are medical areas
  const medicalZones = graph.zones.filter(
    (z) => z.type === 'medical_area'
  );

  if (medicalZones.length === 0) {
    return { route: null };
  }

  // Compute SOS route to each medical zone, pick the shortest
  let bestRoute: RouteResult | null = null;
  let bestDistance = Infinity;
  let nearestMedicalZone: ZoneId | undefined;

  for (const medZone of medicalZones) {
    const route = computeSOSRoute(graph, currentZone, medZone.id, densityMap);
    if (route.status === 'found' && route.distance < bestDistance) {
      bestRoute = route;
      bestDistance = route.distance;
      nearestMedicalZone = medZone.id;
    }
  }

  return {
    route: bestRoute,
    nearestMedicalZone,
  };
}
