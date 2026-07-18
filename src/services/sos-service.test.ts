/**
 * Unit tests for the SOS service.
 * Tests exponential backoff retry, failure handling, and emergency route computation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendSOSAlert, sendLostChildAlert, computeEmergencyRoute } from './sos-service';
import { syntheticStadium } from '@/data/synthetic-stadium';
import type { SOSAlert, LostChildProtocol } from '@/types/emergency';
import type { DensityMap } from '@/types/crowd';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function makeSOSAlert(): SOSAlert {
  return {
    id: 'sos-test-1',
    zone: 'concourse-north',
    timestamp: Date.now(),
    type: 'medical',
    description: 'Test alert',
  };
}

function makeLostChild(): LostChildProtocol {
  return {
    id: 'lc-test-1',
    childAge: 5,
    childDescription: 'Blue shirt, white shorts',
    lastKnownZone: 'gate-north',
    timestamp: Date.now(),
    contactInfo: '555-1234',
  };
}

describe('sendSOSAlert', () => {
  it('returns success on first attempt when server responds ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ acknowledged: true, id: 'sos-test-1' }),
    });

    const result = await sendSOSAlert(makeSOSAlert());
    expect(result.success).toBe(true);
    expect(result.acknowledged).toBe(true);
    expect(result.retriesAttempted).toBe(0);
  });

  it('retries on failure and returns fallbackZone after max retries', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const promise = sendSOSAlert(makeSOSAlert());

    // Advance through retries (1s, 2s, 4s delays)
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.fallbackZone).toBe('concourse-north');
    expect(result.retriesAttempted).toBe(3);
  });

  it('retries on non-ok response and succeeds on second attempt', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ acknowledged: true, id: 'sos-test-1' }) });

    const promise = sendSOSAlert(makeSOSAlert());
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.retriesAttempted).toBe(1);
  });
});

describe('sendLostChildAlert', () => {
  it('returns success when server acknowledges', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ acknowledged: true, id: 'lc-test-1' }),
    });

    const result = await sendLostChildAlert(makeLostChild());
    expect(result.success).toBe(true);
    expect(result.acknowledged).toBe(true);
  });

  it('returns fallbackZone as lastKnownZone on failure', async () => {
    mockFetch.mockRejectedValue(new Error('fail'));

    const promise = sendLostChildAlert(makeLostChild());
    await vi.advanceTimersByTimeAsync(7000);
    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.fallbackZone).toBe('gate-north');
  });
});

describe('computeEmergencyRoute', () => {
  const emptyDensityMap: DensityMap = {};

  it('finds route to medical center from a connected zone', () => {
    const result = computeEmergencyRoute(syntheticStadium, 'concourse-north', emptyDensityMap);
    expect(result.route).not.toBeNull();
    expect(result.route?.status).toBe('found');
    expect(result.nearestMedicalZone).toBe('medical-center');
  });

  it('returns null route when no medical zones exist', () => {
    const graphNoMedical = {
      ...syntheticStadium,
      zones: syntheticStadium.zones.filter((z) => z.type !== 'medical_area'),
    };
    const result = computeEmergencyRoute(graphNoMedical, 'concourse-north', emptyDensityMap);
    expect(result.route).toBeNull();
  });
});
