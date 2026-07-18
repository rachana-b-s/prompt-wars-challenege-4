/**
 * Tests for GenAI Client Service.
 *
 * Tests verify:
 * - Successful API calls return parsed responses with isFallback=false
 * - Timeout/network errors return fallback responses with isFallback=true
 * - Non-200 responses trigger fallback
 * - Language parameter is passed through
 * - Proactive warnings only fire when conditions are met
 *
 * Requirements: 2.4, 2.5, 12.1, 15.5, 17.1
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getRouteExplanation,
  getFacilityRecommendation,
  getMedicalTriage,
  getProactiveWarning,
} from './genai-client';
import type { RouteResult } from '@/types/route';

// Mock fetch globally
const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Test Helpers ---

function makeRouteResult(overrides?: Partial<RouteResult>): RouteResult {
  return {
    status: 'found',
    path: ['zone-a', 'zone-b', 'zone-c'],
    segments: [],
    distance: 250,
    estimatedTime: 180,
    zonesTraversed: 3,
    warnings: [],
    ...overrides,
  };
}

function makeSuccessResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as unknown as Response;
}

function makeErrorResponse(status: number, data: unknown): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(data),
  } as unknown as Response;
}

// --- getRouteExplanation ---

describe('getRouteExplanation', () => {
  const baseParams = {
    route: makeRouteResult(),
    constraints: { stepFreeRequired: true, avoidHighDensity: true },
    crowdData: { 'zone-a': 30, 'zone-b': 55, 'zone-c': 20 },
    fanProfile: { allegiance: 'home', accessibility: ['wheelchair'] },
    language: 'en',
  };

  it('returns parsed response on successful API call', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse({
        reasoning: 'This route avoids the crowded concourse.',
        dataPoints: [{ label: 'Crowd density', value: '55% at zone-b' }],
        language: 'en',
      })
    );

    const result = await getRouteExplanation(baseParams);

    expect(result.isFallback).toBe(false);
    expect(result.reasoning).toBe('This route avoids the crowded concourse.');
    expect(result.dataPoints).toHaveLength(1);
    expect(result.language).toBe('en');
  });

  it('returns fallback on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, { error: 'Server error' }));

    const result = await getRouteExplanation(baseParams);

    expect(result.isFallback).toBe(true);
    expect(result.reasoning).toBe('AI explanation temporarily unavailable');
    expect(result.dataPoints.length).toBeGreaterThan(0);
  });

  it('returns fallback on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await getRouteExplanation(baseParams);

    expect(result.isFallback).toBe(true);
    expect(result.reasoning).toBe('AI explanation temporarily unavailable');
  });

  it('returns fallback on timeout (AbortError)', async () => {
    mockFetch.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));

    const result = await getRouteExplanation(baseParams);

    expect(result.isFallback).toBe(true);
    expect(result.reasoning).toBe('AI explanation temporarily unavailable');
    expect(result.dataPoints).toContainEqual({ label: 'Distance', value: '250m' });
  });

  it('returns fallback when response contains error field', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse({ error: 'API key invalid' })
    );

    const result = await getRouteExplanation(baseParams);

    expect(result.isFallback).toBe(true);
  });

  it('includes route data in fallback data points', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'));

    const result = await getRouteExplanation(baseParams);

    expect(result.dataPoints).toContainEqual({ label: 'Distance', value: '250m' });
    expect(result.dataPoints).toContainEqual({ label: 'Estimated time', value: '3 min' });
    expect(result.dataPoints).toContainEqual({ label: 'Zones traversed', value: '3' });
  });

  it('passes language parameter to API', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse({
        reasoning: 'Ruta seleccionada por baja densidad.',
        dataPoints: [{ label: 'Densidad', value: '30%' }],
        language: 'es',
      })
    );

    const result = await getRouteExplanation({ ...baseParams, language: 'es' });

    expect(result.language).toBe('es');
    expect(result.isFallback).toBe(false);

    // Verify fetch was called with 'es' in the body
    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(fetchBody.language).toBe('es');
  });

  it('calls the correct API endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse({
        reasoning: 'test',
        dataPoints: [],
        language: 'en',
      })
    );

    await getRouteExplanation(baseParams);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/genai/reason',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });
});

// --- getFacilityRecommendation ---

describe('getFacilityRecommendation', () => {
  const baseParams = {
    facilities: [
      { id: 'f1', name: 'Stall A', type: 'food_stall', queueEstimate: 5, distance: 100, dietaryOptions: ['halal'] },
      { id: 'f2', name: 'Stall B', type: 'food_stall', queueEstimate: 2, distance: 200, dietaryOptions: ['vegan'] },
    ],
    fanPreferences: { dietary: ['halal'] },
    language: 'en',
  };

  it('returns parsed recommendation on success', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse({
        recommendation: 'Stall A is closer and has halal options.',
        topPick: { facilityId: 'f1', reason: 'Matches dietary preference' },
        comparison: [{ label: 'Time saved', value: '3 min' }],
        language: 'en',
      })
    );

    const result = await getFacilityRecommendation(baseParams);

    expect(result.isFallback).toBe(false);
    expect(result.topPick.facilityId).toBe('f1');
    expect(result.recommendation).toContain('halal');
  });

  it('returns fallback on failure with best option by total time', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await getFacilityRecommendation(baseParams);

    expect(result.isFallback).toBe(true);
    expect(result.recommendation).toBe('AI explanation temporarily unavailable');
    // Stall B: queue 2 + walk ~3 = 5 total; Stall A: queue 5 + walk ~2 = 7 total
    expect(result.topPick.facilityId).toBe('f2');
  });

  it('returns fallback on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(504, { error: 'Timeout' }));

    const result = await getFacilityRecommendation(baseParams);

    expect(result.isFallback).toBe(true);
  });

  it('handles empty facilities array in fallback', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'));

    const result = await getFacilityRecommendation({
      ...baseParams,
      facilities: [],
    });

    expect(result.isFallback).toBe(true);
    expect(result.topPick.facilityId).toBe('');
  });
});

// --- getMedicalTriage ---

describe('getMedicalTriage', () => {
  const baseParams = {
    symptoms: 'Feeling dizzy and nauseous',
    currentZone: 'zone-d',
    availableFacilities: [
      { id: 'med-1', type: 'first_aid', zone: 'zone-e', name: 'First Aid Station 1' },
      { id: 'med-2', type: 'medical_center', zone: 'zone-f', name: 'Medical Center' },
    ],
    language: 'en',
  };

  it('returns parsed triage response on success', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse({
        recommendation: 'first_aid',
        reasoning: 'Dizziness and nausea suggest a need for basic medical assessment.',
        nearestFacilityId: 'med-1',
        urgency: 'medium',
        disclaimer: 'This is not medical advice.',
      })
    );

    const result = await getMedicalTriage(baseParams);

    expect(result.recommendation).toBe('first_aid');
    expect(result.urgency).toBe('medium');
    expect(result.nearestFacilityId).toBe('med-1');
    expect(result.disclaimer).toBeTruthy();
  });

  it('returns safe fallback (first_aid, medium urgency) on failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'));

    const result = await getMedicalTriage(baseParams);

    expect(result.recommendation).toBe('first_aid');
    expect(result.urgency).toBe('medium');
    expect(result.nearestFacilityId).toBe('med-1');
    expect(result.disclaimer).toBeTruthy();
  });

  it('returns fallback on non-200 response', async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, { error: 'Internal error' }));

    const result = await getMedicalTriage(baseParams);

    expect(result.recommendation).toBe('first_aid');
    expect(result.urgency).toBe('medium');
  });

  it('handles empty available facilities in fallback', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'));

    const result = await getMedicalTriage({
      ...baseParams,
      availableFacilities: [],
    });

    expect(result.recommendation).toBe('first_aid');
    expect(result.nearestFacilityId).toBe('unknown');
  });
});

// --- getProactiveWarning ---

describe('getProactiveWarning', () => {
  it('returns null when no warning conditions are met', async () => {
    const result = await getProactiveWarning({
      currentZone: 'zone-a',
      dwellTime: 10,
      density: 30,
      temperature: 22,
      language: 'en',
    });

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('triggers warning for high density + dwell time > 30 min', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse({
        reasoning: 'You have been in a crowded, sun-exposed area for 35 minutes. Visit the nearest cooling zone.',
        dataPoints: [],
        language: 'en',
      })
    );

    const result = await getProactiveWarning({
      currentZone: 'zone-a',
      dwellTime: 35,
      density: 65,
      temperature: 32,
      language: 'en',
    });

    expect(result).toBeTruthy();
    expect(mockFetch).toHaveBeenCalled();
  });

  it('triggers warning for dwell time > 45 min', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse({
        reasoning: 'Extended sun exposure detected.',
        dataPoints: [],
        language: 'en',
      })
    );

    const result = await getProactiveWarning({
      currentZone: 'zone-b',
      dwellTime: 50,
      density: 30,
      temperature: 25,
      language: 'en',
    });

    expect(result).toBeTruthy();
  });

  it('triggers warning for temperature > 28°C', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse({
        reasoning: 'High temperature detected. Stay hydrated.',
        dataPoints: [],
        language: 'en',
      })
    );

    const result = await getProactiveWarning({
      currentZone: 'zone-c',
      dwellTime: 10,
      density: 20,
      temperature: 35,
      language: 'en',
    });

    expect(result).toBeTruthy();
  });

  it('returns fallback warning on API failure with dwell > 45 min', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await getProactiveWarning({
      currentZone: 'zone-a',
      dwellTime: 50,
      density: 30,
      temperature: 25,
      language: 'en',
    });

    expect(result).toContain('sun-exposed zone');
    expect(result).toContain('50 minutes');
  });

  it('returns fallback warning on API failure with high temperature', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'));

    const result = await getProactiveWarning({
      currentZone: 'zone-a',
      dwellTime: 10,
      density: 20,
      temperature: 33,
      language: 'en',
    });

    expect(result).toContain('33°C');
    expect(result).toContain('hydrated');
  });

  it('returns fallback warning on API failure with high density + dwell', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'));

    const result = await getProactiveWarning({
      currentZone: 'zone-a',
      dwellTime: 35,
      density: 70,
      temperature: 25,
      language: 'en',
    });

    expect(result).toContain('water station');
  });

  it('passes language parameter to API', async () => {
    mockFetch.mockResolvedValueOnce(
      makeSuccessResponse({
        reasoning: 'Hydratez-vous.',
        dataPoints: [],
        language: 'fr',
      })
    );

    await getProactiveWarning({
      currentZone: 'zone-a',
      dwellTime: 50,
      density: 30,
      temperature: 25,
      language: 'fr',
    });

    const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(fetchBody.language).toBe('fr');
  });
});
