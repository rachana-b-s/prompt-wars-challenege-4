'use client';

/**
 * Wrapper component that wires together StadiumMap, ZoneInfoPanel, and route display.
 * Handles zone click interactions for setting location, destination, and showing info.
 *
 * Requirements: 9.2, 9.3, 9.4, 11.1
 */

import { useState, useCallback, useEffect } from 'react';
import { StadiumMap } from '@/components/StadiumMap';
import { ZoneInfoPanel } from '@/components/ZoneInfoPanel';
import { useStadiumStore } from '@/stores/stadium-store';
import { useFanStore } from '@/stores/fan-store';
import { useCrowdStore } from '@/stores/crowd-store';
import { useRouteStore } from '@/stores/route-store';
import { useAutoRoute } from '@/hooks/useAutoRoute';
import type { Zone } from '@/types/stadium';

export function MapInteractionWrapper() {
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);

  const getZone = useStadiumStore((state) => state.getZone);
  const setCurrentZone = useFanStore((state) => state.setCurrentZone);
  const addRecentDestination = useFanStore((state) => state.addRecentDestination);
  const densityMap = useCrowdStore((state) => state.densityMap);

  const destination = useRouteStore((state) => state.destination);
  const setDestination = useRouteStore((state) => state.setDestination);
  const setRouteInStore = useRouteStore((state) => state.setRoute);

  const { route } = useAutoRoute({ destination, densityMap });
  const highlightedPath = route?.status === 'found' ? route.path : [];

  // Sync route state to the shared store for RoutePanel consumption
  useEffect(() => {
    setRouteInStore(route);
  }, [route, setRouteInStore]);

  const handleZoneClick = useCallback(
    (zoneId: string) => {
      const zone = getZone(zoneId);
      if (zone) {
        setSelectedZone(zone);
      }
    },
    [getZone]
  );

  const handleSetLocation = useCallback(
    (zoneId: string) => {
      setCurrentZone(zoneId);
      setSelectedZone(null);
    },
    [setCurrentZone]
  );

  const handleNavigateHere = useCallback(
    (zoneId: string) => {
      setDestination(zoneId);
      addRecentDestination(zoneId);
      setSelectedZone(null);
    },
    [setDestination, addRecentDestination]
  );

  const handleClosePanel = useCallback(() => {
    setSelectedZone(null);
  }, []);

  return (
    <div className="relative w-full h-full">
      <StadiumMap
        onZoneClick={handleZoneClick}
        highlightedPath={highlightedPath}
      />
      {selectedZone && (
        <ZoneInfoPanel
          zone={selectedZone}
          onSetLocation={handleSetLocation}
          onNavigateHere={handleNavigateHere}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}
