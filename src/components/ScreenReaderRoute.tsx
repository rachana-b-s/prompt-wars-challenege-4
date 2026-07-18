'use client';

/**
 * ScreenReaderRoute — Blind/Low-Vision accessible route display.
 *
 * Provides:
 * - Text-only route display using <ol> with numbered steps
 * - Each step describes the segment with landmark references
 * - ARIA landmarks and sequential step descriptions
 * - Hidden visually by default, visible when blind/low-vision profile is active
 *
 * Requirements: 3.8, 3.9
 */

import type { RouteResult, RouteSegment } from '@/types/route';

export interface ScreenReaderRouteProps {
  route: RouteResult;
  /** When true, display is visible (not just screen-reader-only) */
  visibleMode?: boolean;
  /** Zone names lookup */
  zoneNames?: Record<string, string>;
}

/**
 * Generates a human-readable step description with landmark references.
 */
function describeStep(
  segment: RouteSegment,
  stepNumber: number,
  zoneNames?: Record<string, string>
): string {
  const toName = zoneNames?.[segment.toZone] ?? segment.toZone;
  const distance = segment.distance;

  // Extract edge type from instruction if available
  const viaMatch = segment.instruction.match(/via\s+(\w+)/);
  const via = viaMatch ? viaMatch[1] : 'path';

  return `Step ${stepNumber}: Walk ${distance} meters via ${via} to ${toName}`;
}

/**
 * Screen-reader optimized route output that does not rely on the visual map.
 * Uses ordered list with ARIA landmarks for sequential navigation.
 */
export function ScreenReaderRoute({ route, visibleMode, zoneNames }: ScreenReaderRouteProps) {
  if (route.status !== 'found' || route.segments.length === 0) {
    return (
      <div
        role="status"
        aria-label="Route status"
        className={visibleMode ? '' : 'sr-only'}
      >
        <p>No route is currently available. Please set a destination to compute a route.</p>
      </div>
    );
  }

  const containerClass = visibleMode
    ? 'p-4 space-y-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700'
    : 'sr-only';

  const timeMinutes = Math.ceil(route.estimatedTime / 60);
  const fromName = zoneNames?.[route.path[0]] ?? route.path[0];
  const toName = zoneNames?.[route.path[route.path.length - 1]] ?? route.path[route.path.length - 1];

  return (
    <nav
      aria-label="Turn-by-turn route directions"
      className={containerClass}
    >
      {/* Route overview */}
      <div aria-label="Route overview">
        <h2 className="text-lg font-semibold text-foreground">
          Route Directions
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          From {fromName} to {toName}. Total distance: {route.distance} meters.
          Estimated time: {timeMinutes} minute{timeMinutes !== 1 ? 's' : ''}.
          Passing through {route.zonesTraversed} zones.
        </p>
      </div>

      {/* Warnings summary for screen reader */}
      {route.warnings.length > 0 && (
        <div aria-label="Route warnings" role="alert">
          <h3 className="text-sm font-medium text-foreground">Warnings:</h3>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
            {route.warnings.map((warning, index) => (
              <li key={index}>{warning.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Step-by-step directions */}
      <div aria-label="Step-by-step directions">
        <h3 className="text-sm font-medium text-foreground mb-2">
          Directions ({route.segments.length} steps):
        </h3>
        <ol
          className="space-y-2 list-decimal list-inside"
          aria-label="Navigation steps"
        >
          {route.segments.map((segment, index) => (
            <li
              key={segment.edgeId}
              className="text-sm text-gray-700 dark:text-gray-300 p-2 rounded bg-gray-50 dark:bg-gray-800"
              aria-label={describeStep(segment, index + 1, zoneNames)}
            >
              {describeStep(segment, index + 1, zoneNames)}
            </li>
          ))}
        </ol>
      </div>

      {/* Arrival announcement */}
      <div aria-live="polite" className="text-sm font-medium text-green-700 dark:text-green-400">
        You will arrive at {toName}.
      </div>
    </nav>
  );
}
