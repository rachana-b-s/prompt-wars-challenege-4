/**
 * GenAI Client Service — client-side service for calling GenAI API routes.
 *
 * Provides async functions that call the server-side API routes with:
 * - 5-second timeout via AbortController
 * - Graceful fallback on failure (timeout, network error, non-200)
 * - Multilingual support via language parameter
 * - Proactive warning generation (heat/dehydration)
 *
 * Requirements: 2.4, 2.5, 12.1, 15.5, 17.1
 */

import type { TriageResponse } from '@/types/emergency';
import type { RouteResult } from '@/types/route';

// --- Public Interfaces ---

export interface GenAIExplanation {
  reasoning: string;
  dataPoints: { label: string; value: string }[];
  language: string;
  isFallback: boolean;
}

export interface GenAIRecommendation {
  recommendation: string;
  topPick: { facilityId: string; reason: string };
  comparison: { label: string; value: string }[];
  language: string;
  isFallback: boolean;
}

export interface RouteExplanationParams {
  route: RouteResult;
  constraints: {
    stepFreeRequired?: boolean;
    avoidHighDensity?: boolean;
    preferQuiet?: boolean;
    excludeAllegiance?: string[];
    avoidZoneTypes?: string[];
  };
  crowdData: Record<string, number>;
  fanProfile: {
    allegiance: string;
    accessibility: string[];
  };
  language: string;
}

export interface FacilityRecommendationParams {
  facilities: {
    id: string;
    name: string;
    type: string;
    queueEstimate: number;
    distance: number;
    dietaryOptions?: string[];
  }[];
  fanPreferences: {
    dietary?: string[];
    allergens?: string[];
    kidFriendly?: boolean;
  };
  language: string;
}

export interface MedicalTriageParams {
  symptoms: string;
  currentZone: string;
  availableFacilities: { id: string; type: string; zone: string; name: string }[];
  language: string;
}

export interface ProactiveWarningParams {
  currentZone: string;
  dwellTime: number; // minutes
  density: number; // 0-100
  temperature: number; // Celsius
  language: string;
}

// --- Constants ---

const TIMEOUT_MS = 5000;
const FALLBACK_MESSAGE = 'AI explanation temporarily unavailable';

// --- Helper Functions ---

/**
 * Executes a fetch with a 5-second timeout using AbortController.
 * Returns the parsed JSON response or throws on failure.
 */
async function fetchWithTimeout(url: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Public API ---

/**
 * Get a GenAI-powered explanation for a computed route.
 *
 * On success: returns parsed explanation with isFallback=false.
 * On failure (timeout, network error, non-200): returns fallback with basic route data.
 */
export async function getRouteExplanation(
  params: RouteExplanationParams
): Promise<GenAIExplanation> {
  try {
    const response = await fetchWithTimeout('/api/genai/reason', {
      route: {
        path: params.route.path,
        distance: params.route.distance,
        estimatedTime: params.route.estimatedTime,
        warnings: params.route.warnings.map((w) => ({
          type: w.type,
          message: w.message,
          zone: w.zone,
        })),
      },
      constraints: {
        stepFreeRequired: params.constraints.stepFreeRequired ?? false,
        avoidHighDensity: params.constraints.avoidHighDensity ?? false,
        preferQuiet: params.constraints.preferQuiet ?? false,
        excludeAllegiance: params.constraints.excludeAllegiance ?? [],
        avoidZoneTypes: params.constraints.avoidZoneTypes ?? [],
      },
      crowdData: params.crowdData,
      fanProfile: params.fanProfile,
      language: params.language,
    });

    if (!response.ok) {
      return buildFallbackExplanation(params);
    }

    const data = await response.json();

    if (data.error) {
      return buildFallbackExplanation(params);
    }

    return {
      reasoning: data.reasoning || FALLBACK_MESSAGE,
      dataPoints: Array.isArray(data.dataPoints) ? data.dataPoints : [],
      language: data.language || params.language,
      isFallback: false,
    };
  } catch {
    return buildFallbackExplanation(params);
  }
}

/**
 * Get a GenAI-powered facility recommendation.
 *
 * On success: returns parsed recommendation with isFallback=false.
 * On failure: returns fallback with basic comparison data.
 */
export async function getFacilityRecommendation(
  params: FacilityRecommendationParams
): Promise<GenAIRecommendation> {
  try {
    const response = await fetchWithTimeout('/api/genai/recommend', {
      facilities: params.facilities,
      fanPreferences: params.fanPreferences,
      language: params.language,
    });

    if (!response.ok) {
      return buildFallbackRecommendation(params);
    }

    const data = await response.json();

    if (data.error) {
      return buildFallbackRecommendation(params);
    }

    return {
      recommendation: data.recommendation || FALLBACK_MESSAGE,
      topPick: data.topPick || { facilityId: params.facilities[0]?.id ?? '', reason: 'Nearest option' },
      comparison: Array.isArray(data.comparison) ? data.comparison : [],
      language: data.language || params.language,
      isFallback: false,
    };
  } catch {
    return buildFallbackRecommendation(params);
  }
}

/**
 * Get medical triage guidance from GenAI.
 *
 * On success: returns TriageResponse from the API.
 * On failure: returns a safe fallback recommending first_aid with medium urgency.
 */
export async function getMedicalTriage(
  params: MedicalTriageParams
): Promise<TriageResponse> {
  try {
    const response = await fetchWithTimeout('/api/genai/triage', {
      symptoms: params.symptoms,
      currentZone: params.currentZone,
      availableFacilities: params.availableFacilities,
      language: params.language,
    });

    if (!response.ok) {
      return buildFallbackTriage(params);
    }

    const data = await response.json();

    if (data.error) {
      return buildFallbackTriage(params);
    }

    return {
      recommendation: data.recommendation,
      reasoning: data.reasoning,
      nearestFacilityId: data.nearestFacilityId,
      urgency: data.urgency,
      disclaimer: data.disclaimer || 'This is not medical advice. Please seek professional help if symptoms are severe.',
    };
  } catch {
    return buildFallbackTriage(params);
  }
}

/**
 * Get a proactive warning about heat/dehydration based on zone conditions.
 *
 * Returns a warning message string if conditions warrant a warning, or null if no warning needed.
 *
 * Conditions for triggering a warning:
 * - Sun-exposed zone with density > 60 and dwell time > 30 minutes (Req 15.5)
 * - Temperature above 28°C (Req 17.1)
 * - Dwell time > 45 minutes in sun-exposed conditions (Req 17.6)
 *
 * On API failure: generates a local fallback warning message.
 */
export async function getProactiveWarning(
  params: ProactiveWarningParams
): Promise<string | null> {
  // Determine if warning conditions are met
  const highDensityHeatRisk = params.density > 60 && params.dwellTime > 30;
  const prolongedExposure = params.dwellTime > 45;
  const highTemperature = params.temperature > 28;

  // Only call GenAI if conditions warrant a warning
  if (!highDensityHeatRisk && !prolongedExposure && !highTemperature) {
    return null;
  }

  try {
    const response = await fetchWithTimeout('/api/genai/reason', {
      route: {
        path: [params.currentZone],
        distance: 0,
        estimatedTime: 0,
        warnings: [
          {
            type: 'sun_exposure',
            message: `Fan in zone ${params.currentZone} for ${params.dwellTime} minutes. Temperature: ${params.temperature}°C. Density: ${params.density}%.`,
            zone: params.currentZone,
          },
        ],
      },
      constraints: {
        stepFreeRequired: false,
        avoidHighDensity: false,
        preferQuiet: false,
      },
      crowdData: { [params.currentZone]: params.density },
      fanProfile: {
        allegiance: 'neutral',
        accessibility: [],
      },
      language: params.language,
    });

    if (!response.ok) {
      return buildFallbackWarning(params);
    }

    const data = await response.json();

    if (data.error || !data.reasoning) {
      return buildFallbackWarning(params);
    }

    return data.reasoning;
  } catch {
    return buildFallbackWarning(params);
  }
}

// --- Fallback Builders ---

function buildFallbackExplanation(params: RouteExplanationParams): GenAIExplanation {
  const dataPoints: { label: string; value: string }[] = [];

  if (params.route.distance > 0) {
    dataPoints.push({ label: 'Distance', value: `${params.route.distance}m` });
  }
  if (params.route.estimatedTime > 0) {
    const minutes = Math.round(params.route.estimatedTime / 60);
    dataPoints.push({ label: 'Estimated time', value: `${minutes} min` });
  }
  if (params.route.zonesTraversed > 0) {
    dataPoints.push({ label: 'Zones traversed', value: `${params.route.zonesTraversed}` });
  }

  return {
    reasoning: FALLBACK_MESSAGE,
    dataPoints,
    language: params.language,
    isFallback: true,
  };
}

function buildFallbackRecommendation(params: FacilityRecommendationParams): GenAIRecommendation {
  // Pick the facility with the shortest combined time (queue + walk)
  const sorted = [...params.facilities].sort((a, b) => {
    const totalA = a.queueEstimate + Math.ceil(a.distance / 80);
    const totalB = b.queueEstimate + Math.ceil(b.distance / 80);
    return totalA - totalB;
  });

  const best = sorted[0];

  return {
    recommendation: FALLBACK_MESSAGE,
    topPick: best
      ? { facilityId: best.id, reason: 'Shortest total wait + walk time' }
      : { facilityId: '', reason: 'No facilities available' },
    comparison: best
      ? [
          { label: 'Queue time', value: `${best.queueEstimate} min` },
          { label: 'Walking distance', value: `${best.distance}m` },
        ]
      : [],
    language: params.language,
    isFallback: true,
  };
}

function buildFallbackTriage(params: MedicalTriageParams): TriageResponse {
  // Default to first_aid with medium urgency as a safe conservative fallback
  const nearestMedical = params.availableFacilities.find(
    (f) => f.type === 'first_aid' || f.type === 'medical_center'
  );

  return {
    recommendation: 'first_aid',
    reasoning: FALLBACK_MESSAGE,
    nearestFacilityId: nearestMedical?.id ?? params.availableFacilities[0]?.id ?? 'unknown',
    urgency: 'medium',
    disclaimer: 'This is not medical advice. Please seek professional help if symptoms are severe.',
  };
}

function buildFallbackWarning(params: ProactiveWarningParams): string {
  if (params.dwellTime > 45) {
    return `You've been in a sun-exposed zone for ${params.dwellTime} minutes. Consider moving to a nearby cooling zone or shaded rest area to stay comfortable.`;
  }
  if (params.temperature > 28) {
    return `Temperature is ${params.temperature}°C. Stay hydrated — find the nearest water station or cooling zone.`;
  }
  return `High crowd density detected in your area. Consider visiting a nearby water station to stay hydrated.`;
}
