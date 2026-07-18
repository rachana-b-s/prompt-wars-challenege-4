'use client';

/**
 * RoutePanel — displays computed route information with GenAI reasoning.
 *
 * Sections:
 * 1. Route summary: distance, estimated time, zones traversed
 * 2. Route warnings with color-coded badges
 * 3. GenAI explanation (async load with spinner, fallback on error)
 * 4. Alternative routes (expandable list with trade-off explanations)
 *
 * Requirements: 1.4, 2.1, 2.2, 2.3, 2.6, 12.1
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouteStore } from '@/stores/route-store';
import { useFanStore } from '@/stores/fan-store';
import { useCrowdStore } from '@/stores/crowd-store';
import {
  getRouteExplanation,
  type GenAIExplanation,
  type RouteExplanationParams,
} from '@/services/genai-client';
import type { RouteResult, RouteWarning } from '@/types/route';

export function RoutePanel() {
  const route = useRouteStore((state) => state.route);
  const isComputing = useRouteStore((state) => state.isComputing);

  if (isComputing) {
    return <RoutePanelSkeleton />;
  }

  if (!route) {
    return <RoutePanelEmpty />;
  }

  if (route.status === 'not_found') {
    return <RoutePanelNoRoute nearestReachable={route.nearestReachable} />;
  }

  return <RoutePanelContent route={route} />;
}

// --- Empty state ---

function RoutePanelEmpty() {
  return (
    <div className="p-4" role="status" aria-label="No route computed">
      <h2 className="text-lg font-semibold text-foreground mb-2">Route</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Set your location and destination on the map to compute a route.
      </p>
    </div>
  );
}

// --- Loading skeleton ---

function RoutePanelSkeleton() {
  return (
    <div className="p-4" role="status" aria-label="Computing route" aria-live="polite">
      <h2 className="text-lg font-semibold text-foreground mb-3">Route</h2>
      <div className="space-y-3 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      </div>
    </div>
  );
}

// --- No route found ---

function RoutePanelNoRoute({ nearestReachable }: { nearestReachable?: string }) {
  return (
    <div className="p-4" role="alert">
      <h2 className="text-lg font-semibold text-foreground mb-2">Route</h2>
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
        <p className="text-sm text-red-700 dark:text-red-300 font-medium">
          Route unavailable
        </p>
        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
          No valid route exists to the selected destination.
        </p>
        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
          This may be due to your accessibility or allegiance settings. Try adjusting in the Profile tab.
        </p>
        {nearestReachable && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
            Nearest reachable alternative: <strong>{nearestReachable}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

// --- Main route content ---

function RoutePanelContent({ route }: { route: RouteResult }) {
  const [showAlternatives, setShowAlternatives] = useState(false);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Route</h2>

      {/* Route summary */}
      <RouteSummary route={route} />

      {/* Route warnings */}
      {route.warnings.length > 0 && <RouteWarnings warnings={route.warnings} />}

      {/* GenAI explanation */}
      <GenAISection route={route} />

      {/* Alternative routes */}
      {route.alternatives && route.alternatives.length > 0 && (
        <div>
          <button
            onClick={() => setShowAlternatives(!showAlternatives)}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors focus:outline-2 focus:outline-blue-600 focus:outline-offset-2 rounded"
            aria-expanded={showAlternatives}
            aria-controls="alternative-routes"
          >
            <span
              className="inline-block transition-transform"
              aria-hidden="true"
              style={{ transform: showAlternatives ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
              &#9654;
            </span>
            {route.alternatives.length} alternative route{route.alternatives.length > 1 ? 's' : ''}
          </button>

          {showAlternatives && (
            <div id="alternative-routes" className="mt-2 space-y-3">
              {route.alternatives.map((alt, index) => (
                <AlternativeRouteCard key={index} route={alt} index={index + 1} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Route summary ---

function RouteSummary({ route }: { route: RouteResult }) {
  const timeMinutes = Math.ceil(route.estimatedTime / 60);
  const distanceDisplay =
    route.distance >= 1000
      ? `${(route.distance / 1000).toFixed(1)} km`
      : `${route.distance} m`;

  return (
    <div
      className="grid grid-cols-3 gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3"
      aria-label="Route summary"
    >
      <SummaryItem
        label="Time"
        value={`${timeMinutes} min`}
        icon="&#128337;"
      />
      <SummaryItem
        label="Distance"
        value={distanceDisplay}
        icon="&#128099;"
      />
      <SummaryItem
        label="Zones"
        value={`${route.zonesTraversed}`}
        icon="&#128506;"
      />
    </div>
  );
}

function SummaryItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="text-center">
      <span className="text-lg" aria-hidden="true">
        {icon}
      </span>
      <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

// --- Route warnings ---

function RouteWarnings({ warnings }: { warnings: RouteWarning[] }) {
  return (
    <div aria-label="Route warnings" role="list">
      <h3 className="text-sm font-medium text-foreground mb-2">Warnings</h3>
      <div className="space-y-1.5">
        {warnings.map((warning, index) => (
          <WarningBadge key={index} warning={warning} />
        ))}
      </div>
    </div>
  );
}

function WarningBadge({ warning }: { warning: RouteWarning }) {
  const config = getWarningConfig(warning.type);

  return (
    <div
      role="listitem"
      className={`flex items-start gap-2 text-xs px-2.5 py-1.5 rounded-md ${config.bgClass}`}
    >
      <span className={`font-medium whitespace-nowrap ${config.labelClass}`}>
        {config.label}
      </span>
      <span className={config.textClass}>{warning.message}</span>
    </div>
  );
}

function getWarningConfig(type: RouteWarning['type']): {
  label: string;
  bgClass: string;
  labelClass: string;
  textClass: string;
} {
  switch (type) {
    case 'allegiance_proximity':
      return {
        label: 'Safety',
        bgClass: 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800',
        labelClass: 'text-orange-700 dark:text-orange-300',
        textClass: 'text-orange-600 dark:text-orange-400',
      };
    case 'high_density':
      return {
        label: 'Crowded',
        bgClass: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800',
        labelClass: 'text-red-700 dark:text-red-300',
        textClass: 'text-red-600 dark:text-red-400',
      };
    case 'sensory_trigger':
      return {
        label: 'Sensory',
        bgClass: 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800',
        labelClass: 'text-purple-700 dark:text-purple-300',
        textClass: 'text-purple-600 dark:text-purple-400',
      };
    case 'no_rest_area':
      return {
        label: 'No rest',
        bgClass: 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800',
        labelClass: 'text-yellow-700 dark:text-yellow-300',
        textClass: 'text-yellow-600 dark:text-yellow-400',
      };
    case 'sun_exposure':
      return {
        label: 'Sun',
        bgClass: 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800',
        labelClass: 'text-amber-700 dark:text-amber-300',
        textClass: 'text-amber-600 dark:text-amber-400',
      };
    default:
      return {
        label: 'Info',
        bgClass: 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
        labelClass: 'text-gray-700 dark:text-gray-300',
        textClass: 'text-gray-600 dark:text-gray-400',
      };
  }
}

// --- GenAI explanation section ---

function GenAISection({ route }: { route: RouteResult }) {
  const profile = useFanStore((state) => state.profile);
  const densityMap = useCrowdStore((state) => state.densityMap);

  const [explanation, setExplanation] = useState<GenAIExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);

  const fetchExplanation = useCallback(async () => {
    setIsLoading(true);
    setHasAttempted(true);

    // Build crowd data as record of zoneId -> density value
    const crowdData: Record<string, number> = {};
    for (const [zoneId, entry] of Object.entries(densityMap)) {
      if (entry) {
        crowdData[zoneId] = entry.density;
      }
    }

    const params: RouteExplanationParams = {
      route,
      constraints: {
        stepFreeRequired: profile.accessibilityProfile.avoidStairs,
        avoidHighDensity: profile.accessibilityProfile.avoidCrowds,
        preferQuiet: profile.accessibilityProfile.preferQuiet,
        excludeAllegiance:
          profile.allegiance === 'home'
            ? ['away']
            : profile.allegiance === 'away'
              ? ['home']
              : [],
        avoidZoneTypes: [],
      },
      crowdData,
      fanProfile: {
        allegiance: profile.allegiance,
        accessibility: profile.accessibilityProfile.categories,
      },
      language: profile.language,
    };

    const result = await getRouteExplanation(params);
    setExplanation(result);
    setIsLoading(false);
  }, [route, profile, densityMap]);

  // Fetch explanation when route changes
  useEffect(() => {
    if (route.status === 'found') {
      setExplanation(null);
      setHasAttempted(false);
      fetchExplanation();
    }
  }, [route.path.join(','), fetchExplanation]);

  return (
    <div aria-label="AI route explanation">
      <h3 className="text-sm font-medium text-foreground mb-2">AI Reasoning</h3>

      {isLoading && <GenAILoadingSkeleton />}

      {!isLoading && explanation && (
        <GenAIExplanationDisplay explanation={explanation} />
      )}

      {!isLoading && !explanation && hasAttempted && (
        <GenAIFallbackMessage />
      )}
    </div>
  );
}

function GenAILoadingSkeleton() {
  return (
    <div
      className="space-y-2 animate-pulse"
      role="status"
      aria-label="Loading AI explanation"
    >
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/6" />
      <span className="sr-only">Loading AI explanation...</span>
    </div>
  );
}

function GenAIExplanationDisplay({ explanation }: { explanation: GenAIExplanation }) {
  if (explanation.isFallback) {
    return <GenAIFallbackMessage dataPoints={explanation.dataPoints} />;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        {explanation.reasoning}
      </p>
      {explanation.dataPoints.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {explanation.dataPoints.map((dp, idx) => (
            <span
              key={idx}
              className="inline-flex items-center text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full"
            >
              {dp.label}: {dp.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function GenAIFallbackMessage({
  dataPoints,
}: {
  dataPoints?: { label: string; value: string }[];
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-3">
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
        AI explanation temporarily unavailable
      </p>
      {dataPoints && dataPoints.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {dataPoints.map((dp, idx) => (
            <span
              key={idx}
              className="inline-flex items-center text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full"
            >
              {dp.label}: {dp.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Alternative routes ---

function AlternativeRouteCard({ route, index }: { route: RouteResult; index: number }) {
  const timeMinutes = Math.ceil(route.estimatedTime / 60);
  const distanceDisplay =
    route.distance >= 1000
      ? `${(route.distance / 1000).toFixed(1)} km`
      : `${route.distance} m`;

  return (
    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Alternative {index}
        </span>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {route.zonesTraversed} zones
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-foreground font-medium">{timeMinutes} min</span>
        <span className="text-gray-400 dark:text-gray-500">|</span>
        <span className="text-gray-600 dark:text-gray-300">{distanceDisplay}</span>
      </div>
      {route.warnings.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {route.warnings.map((w, i) => {
            const config = getWarningConfig(w.type);
            return (
              <span
                key={i}
                className={`text-xs px-1.5 py-0.5 rounded ${config.bgClass} ${config.labelClass}`}
              >
                {config.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
