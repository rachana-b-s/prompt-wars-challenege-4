'use client';

/**
 * Main landing page — Smart Stadium Fan Navigator.
 * Responsive layout with map as primary content and a navigation side panel.
 *
 * Mobile: Full-screen map with bottom panel (tabs for route, profile, facilities, emergency, group).
 * Desktop: Map takes ~70% width, right sidebar panel takes ~30%.
 *
 * Integrates:
 * - StadiumMap ↔ RoutePanel ↔ FacilityFinder ↔ EmergencyPanel via Zustand stores
 * - LanguageSelector in header
 * - DestinationSelector in the route tab
 * - ErrorBoundary wrapping all content
 * - ScreenReaderRoute (visible when blind/low-vision is active)
 * - SimpleRouteSteps (visible when child_accompanied or neurodivergent is active)
 * - Proactive warnings display
 *
 * Requirements: 3.24, 9.1, 10.4, 11.3, 6.2, 2.5
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { MapInteractionWrapper } from '@/components/MapInteractionWrapper';
import { RoutePanel } from '@/components/RoutePanel';
import { ProfileSetup } from '@/components/ProfileSetup';
import { FacilityFinder } from '@/components/FacilityFinder';
import { EmergencyPanel } from '@/components/EmergencyPanel';
import { GroupManager } from '@/components/GroupManager';
import { LanguageSelector } from '@/components/LanguageSelector';
import { DestinationSelector } from '@/components/DestinationSelector';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ScreenReaderRoute } from '@/components/ScreenReaderRoute';
import { SimpleRouteSteps } from '@/components/SimpleRouteSteps';
import { TabButton } from '@/components/ui';
import { useProactiveWarnings } from '@/hooks/useProactiveWarnings';
import { useFanStore } from '@/stores/fan-store';
import { useStadiumStore } from '@/stores/stadium-store';
import { useCrowdStore } from '@/stores/crowd-store';
import { useRouteStore } from '@/stores/route-store';

type PanelTab = 'route' | 'profile' | 'facilities' | 'emergency' | 'group';

export default function Home() {
  const [activeTab, setActiveTab] = useState<PanelTab>('route');

  const profile = useFanStore((s) => s.profile);
  const graph = useStadiumStore((s) => s.graph);
  const densityMap = useCrowdStore((s) => s.densityMap);
  const route = useRouteStore((s) => s.route);
  const destination = useRouteStore((s) => s.destination);
  const setDestination = useRouteStore((s) => s.setDestination);

  // Determine zone info for proactive warnings
  const currentZone = profile.currentZone;
  const currentZoneData = useMemo(() => {
    if (!currentZone || !graph) return null;
    return graph.zones.find((z) => z.id === currentZone) ?? null;
  }, [currentZone, graph]);

  const currentDensity = currentZone ? (densityMap[currentZone]?.density ?? 0) : 0;

  // Proactive warnings hook
  const { warnings, dismissWarning } = useProactiveWarnings({
    currentZone: currentZone ?? undefined,
    isSunExposed: currentZoneData?.isSunExposed ?? false,
    density: currentDensity,
    temperature: 30, // Default assumed outdoor temperature for demo
    language: profile.language,
    enabled: true,
  });

  // Determine if accessibility-specific views should be shown
  const categories = profile.accessibilityProfile.categories;
  const showScreenReaderRoute = categories.includes('blind') || categories.includes('low_vision');
  const showSimpleSteps = categories.includes('child_accompanied') || categories.includes('neurodivergent');

  // Build zone name lookup for accessible route views
  const zoneNames = useMemo(() => {
    if (!graph) return {};
    const names: Record<string, string> = {};
    for (const zone of graph.zones) {
      names[zone.id] = zone.name;
    }
    return names;
  }, [graph]);

  const handleSelectDestination = (zoneId: string) => {
    setDestination(zoneId);
  };

  return (
    <>
      {/* Skip-to-content link — outside ErrorBoundary to avoid aria-hidden conflicts */}
      <a
        href="#main-content"
        className="fixed top-0 left-0 z-[100] px-4 py-2 bg-white text-black rounded shadow-lg -translate-y-full focus:translate-y-2 focus:outline-2 focus:outline-blue-600 transition-transform"
      >
        Skip to main content
      </a>

      <ErrorBoundary>
      {/* Top header bar with language selector */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <h1 className="text-sm font-semibold text-foreground">Stadium Navigator</h1>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            Staff Dashboard
          </Link>
          <LanguageSelector />
        </div>
      </header>

      {/* Proactive warnings banner */}
      {warnings.length > 0 && (
        <div className="px-4 py-2 space-y-2" role="alert" aria-live="polite">
          {warnings.map((warning) => (
            <div
              key={warning.id}
              className="flex items-start justify-between gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md"
            >
              <div className="flex items-start gap-2">
                <span aria-hidden="true" className="text-amber-500 flex-shrink-0">⚠️</span>
                <p className="text-sm text-amber-800 dark:text-amber-200">{warning.message}</p>
              </div>
              <button
                onClick={() => dismissWarning(warning.id)}
                className="text-amber-600 hover:text-amber-800 text-sm flex-shrink-0 font-medium"
                aria-label="Dismiss warning"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <main
        id="main-content"
        className="flex-1 flex flex-col md:flex-row overflow-hidden"
        aria-label="Smart Stadium Fan Navigator"
        style={{ height: 'calc(100vh - 49px)' }}
      >
        {/* Map area */}
        <section
          className="flex-1 relative min-h-0"
          aria-label="Stadium Map"
        >
          <MapInteractionWrapper />
        </section>

        {/* Side panel — desktop: right sidebar, mobile: bottom sheet */}
        <aside
          className="md:w-[30%] md:min-w-80 md:max-w-md h-72 md:h-full flex flex-col border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden"
          aria-label="Navigation Panel"
        >
          {/* Tab navigation */}
          <nav aria-label="Panel navigation">
            <div role="tablist" className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
              <TabButton
                id="tab-route"
                label="Route"
                isActive={activeTab === 'route'}
                panelId="panel-route"
                onClick={() => setActiveTab('route')}
              />
              <TabButton
                id="tab-profile"
                label="Profile"
                isActive={activeTab === 'profile'}
                panelId="panel-profile"
                onClick={() => setActiveTab('profile')}
              />
              <TabButton
                id="tab-facilities"
                label="Facilities"
                isActive={activeTab === 'facilities'}
                panelId="panel-facilities"
                onClick={() => setActiveTab('facilities')}
              />
              <TabButton
                id="tab-emergency"
                label="Emergency"
                isActive={activeTab === 'emergency'}
                panelId="panel-emergency"
                onClick={() => setActiveTab('emergency')}
              />
              <TabButton
                id="tab-group"
                label="Group"
                isActive={activeTab === 'group'}
                panelId="panel-group"
                onClick={() => setActiveTab('group')}
              />
            </div>
          </nav>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            <div
              id="panel-route"
              role="tabpanel"
              aria-labelledby="tab-route"
              hidden={activeTab !== 'route'}
            >
              {activeTab === 'route' && (
                <div className="space-y-4">
                  <RoutePanel />

                  {/* Destination selector within route tab */}
                  <div className="px-4 pb-4">
                    <DestinationSelector
                      onSelectDestination={handleSelectDestination}
                      selectedDestination={destination ?? undefined}
                    />
                  </div>

                  {/* Screen reader route (visible for blind/low-vision) */}
                  {showScreenReaderRoute && route && (
                    <div className="px-4 pb-4">
                      <ScreenReaderRoute
                        route={route}
                        visibleMode={true}
                        zoneNames={zoneNames}
                      />
                    </div>
                  )}

                  {/* Simple steps (visible for child_accompanied / neurodivergent) */}
                  {showSimpleSteps && route && route.segments.length > 0 && (
                    <SimpleRouteSteps
                      segments={route.segments}
                      zoneNames={zoneNames}
                    />
                  )}
                </div>
              )}
            </div>
            <div
              id="panel-profile"
              role="tabpanel"
              aria-labelledby="tab-profile"
              hidden={activeTab !== 'profile'}
            >
              {activeTab === 'profile' && <ProfileSetup />}
            </div>
            <div
              id="panel-facilities"
              role="tabpanel"
              aria-labelledby="tab-facilities"
              hidden={activeTab !== 'facilities'}
            >
              {activeTab === 'facilities' && <FacilityFinder />}
            </div>
            <div
              id="panel-emergency"
              role="tabpanel"
              aria-labelledby="tab-emergency"
              hidden={activeTab !== 'emergency'}
            >
              {activeTab === 'emergency' && <EmergencyPanel />}
            </div>
            <div
              id="panel-group"
              role="tabpanel"
              aria-labelledby="tab-group"
              hidden={activeTab !== 'group'}
            >
              {activeTab === 'group' && <GroupManager />}
            </div>
          </div>
        </aside>
      </main>
    </ErrorBoundary>
    </>
  );
}


