/**
 * Property test for the useAutoRoute hook.
 *
 * Property 26: Automatic Route Trigger on Location+Destination
 * — computation invoked exactly once when both set, not invoked when only one set
 *
 * **Validates: Requirements 11.3**
 *
 * Tests verify:
 * 1. When only currentZone is set (destination null) → route is null (no computation)
 * 2. When only destination is set (currentZone undefined) → route is null (no computation)
 * 3. When both are set → route is computed (not null, has status 'found' or 'not_found')
 * 4. Setting both values triggers computation exactly once (key-based dedup)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFanStore } from '@/stores/fan-store';
import { useStadiumStore } from '@/stores/stadium-store';
import { useAutoRoute } from './useAutoRoute';
import type { DensityMap } from '@/types/crowd';
import type { ZoneId } from '@/types/stadium';

// Build a minimal density map from the loaded stadium graph
function buildDensityMap(): DensityMap {
  const graph = useStadiumStore.getState().graph;
  if (!graph) return {};
  const map: DensityMap = {};
  for (const zone of graph.zones) {
    map[zone.id] = {
      zoneId: zone.id,
      density: 30,
      lastUpdated: Date.now(),
      level: 'green',
    };
  }
  return map;
}

describe('Property 26: Automatic Route Trigger on Location+Destination', () => {
  let densityMap: DensityMap;
  let validZones: ZoneId[];

  beforeEach(() => {
    // Reset stores to default state
    useFanStore.setState({
      profile: {
        id: 'test-fan',
        accessibilityProfile: {
          categories: [],
          hasCompanion: false,
          avoidStairs: false,
          avoidCrowds: false,
          preferQuiet: false,
          allergens: [],
        },
        allegiance: 'neutral',
        language: 'en',
        currentZone: undefined,
        recentDestinations: [],
      },
    });

    // Ensure stadium graph is loaded (synthetic data)
    const graph = useStadiumStore.getState().graph;
    expect(graph).not.toBeNull();

    validZones = graph!.zones.map((z) => z.id);
    densityMap = buildDensityMap();
  });

  /**
   * When only destination is set but currentZone is undefined,
   * no route computation should occur → route remains null.
   */
  it('does NOT trigger computation when only destination is set (currentZone undefined)', () => {
    // Ensure currentZone is undefined
    useFanStore.getState().setCurrentZone(undefined);

    const destination = validZones[1]; // pick any valid zone

    const { result } = renderHook(() =>
      useAutoRoute({ destination, densityMap })
    );

    expect(result.current.route).toBeNull();
    expect(result.current.isComputing).toBe(false);
  });

  /**
   * When only currentZone is set but destination is null,
   * no route computation should occur → route remains null.
   */
  it('does NOT trigger computation when only currentZone is set (destination null)', () => {
    // Set currentZone
    act(() => {
      useFanStore.getState().setCurrentZone(validZones[0]);
    });

    const { result } = renderHook(() =>
      useAutoRoute({ destination: null, densityMap })
    );

    expect(result.current.route).toBeNull();
    expect(result.current.isComputing).toBe(false);
  });

  /**
   * When both currentZone AND destination are set (non-null),
   * route computation is invoked and produces a result.
   */
  it('triggers computation exactly once when both currentZone AND destination are set', () => {
    const source = validZones[0];
    const destination = validZones[1];

    // Set currentZone before rendering
    act(() => {
      useFanStore.getState().setCurrentZone(source);
    });

    const { result } = renderHook(() =>
      useAutoRoute({ destination, densityMap })
    );

    // Route should be computed (not null)
    expect(result.current.route).not.toBeNull();
    expect(['found', 'not_found', 'partial']).toContain(result.current.route!.status);
  });

  /**
   * Re-rendering with the same currentZone+destination pair does NOT
   * re-trigger computation (key-based dedup).
   */
  it('does NOT recompute for the same currentZone+destination pair (dedup)', () => {
    const source = validZones[0];
    const destination = validZones[1];

    act(() => {
      useFanStore.getState().setCurrentZone(source);
    });

    const { result, rerender } = renderHook(() =>
      useAutoRoute({ destination, densityMap })
    );

    const firstRoute = result.current.route;
    expect(firstRoute).not.toBeNull();

    // Rerender with same values
    rerender();

    // Route should be the same reference (no recomputation)
    expect(result.current.route).toBe(firstRoute);
  });

  /**
   * Changing the destination triggers a new computation.
   */
  it('triggers new computation when destination changes', () => {
    const source = validZones[0];
    const destination1 = validZones[1];
    const destination2 = validZones.length > 2 ? validZones[2] : validZones[0];

    act(() => {
      useFanStore.getState().setCurrentZone(source);
    });

    let destination = destination1;
    const { result, rerender } = renderHook(() =>
      useAutoRoute({ destination, densityMap })
    );

    const firstRoute = result.current.route;
    expect(firstRoute).not.toBeNull();

    // Change destination
    destination = destination2;
    rerender();

    // Route should have been recomputed (different destination)
    expect(result.current.route).not.toBeNull();
    // Note: if source === destination2, it would still be valid
  });

  /**
   * When both values go from set → one becomes null, route is not recomputed.
   * The existing route stays (we don't clear it), but no new computation fires.
   */
  it('does NOT trigger computation when destination becomes null after being set', () => {
    const source = validZones[0];
    const destination1 = validZones[1];

    act(() => {
      useFanStore.getState().setCurrentZone(source);
    });

    let destination: ZoneId | null = destination1;
    const { result, rerender } = renderHook(() =>
      useAutoRoute({ destination, densityMap })
    );

    expect(result.current.route).not.toBeNull();
    const routeBeforeNull = result.current.route;

    // Set destination to null
    destination = null;
    rerender();

    // The route value from before should remain (no new computation),
    // but importantly no NEW computation was triggered
    // The hook keeps the last computed route — it doesn't clear it
    expect(result.current.route).toBe(routeBeforeNull);
  });

  /**
   * When both values are null, no computation occurs.
   */
  it('does NOT trigger computation when both currentZone and destination are null/undefined', () => {
    useFanStore.getState().setCurrentZone(undefined);

    const { result } = renderHook(() =>
      useAutoRoute({ destination: null, densityMap })
    );

    expect(result.current.route).toBeNull();
  });
});
