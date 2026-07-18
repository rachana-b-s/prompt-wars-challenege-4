/**
 * React hook that triggers route computation exactly once when both
 * currentZone AND destination are set (non-null).
 * Setting only one value must NOT trigger computation.
 *
 * Uses a key-based deduplication strategy: computation is tracked by a
 * composite key of `${currentZone}:${destination}`. A new computation is
 * triggered only when the key changes and both values are non-null.
 *
 * Requirements: 11.3
 */

import { useEffect, useRef, useState } from 'react';
import { useFanStore } from '@/stores/fan-store';
import { useStadiumStore } from '@/stores/stadium-store';
import { computeRoute } from '@/engine/route-engine';
import type { RouteResult } from '@/types/route';
import type { ZoneId } from '@/types/stadium';
import type { DensityMap } from '@/types/crowd';

export interface UseAutoRouteOptions {
  destination: ZoneId | null;
  densityMap: DensityMap;
}

export interface UseAutoRouteResult {
  route: RouteResult | null;
  isComputing: boolean;
}

/**
 * Hook that auto-triggers route computation when both currentZone and destination are set.
 * Uses a key-based dedup to ensure computation fires exactly once per unique pair.
 */
export function useAutoRoute({ destination, densityMap }: UseAutoRouteOptions): UseAutoRouteResult {
  const profile = useFanStore((state) => state.profile);
  const graph = useStadiumStore((state) => state.graph);

  const [route, setRoute] = useState<RouteResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);

  // Track the last computed key to prevent duplicate computations
  const lastComputedKeyRef = useRef<string | null>(null);

  const currentZone = profile.currentZone ?? null;

  useEffect(() => {
    // Both must be non-null to trigger computation
    if (currentZone === null || destination === null) {
      return;
    }

    if (!graph) {
      return;
    }

    const key = `${currentZone}:${destination}`;

    // Only compute if key has changed (dedup)
    if (key === lastComputedKeyRef.current) {
      return;
    }

    lastComputedKeyRef.current = key;
    setIsComputing(true);

    const result = computeRoute(graph, {
      source: currentZone,
      destination,
      fanProfile: profile,
    }, densityMap);

    setRoute(result);
    setIsComputing(false);
  }, [currentZone, destination, graph, profile, densityMap]);

  return { route, isComputing };
}
