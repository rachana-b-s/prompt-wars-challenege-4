'use client';

/**
 * SimpleRouteSteps — Neurodivergent and child-friendly route display.
 *
 * Provides:
 * - Numbered steps with simple, predictable language
 * - Max 3 visible at once with next/previous navigation
 * - Large text, clear icons
 * - No ambiguous directional language
 *
 * Requirements: 3.17, 3.20
 */

import { useState } from 'react';
import type { RouteSegment } from '@/types/route';

export interface SimpleRouteStepsProps {
  segments: RouteSegment[];
  /** Zone name lookup for friendly display */
  zoneNames?: Record<string, string>;
}

/** Maximum number of steps visible at once (Req 3.20) */
const MAX_VISIBLE_STEPS = 3;

/**
 * Converts a segment instruction into simple, predictable language.
 * Avoids ambiguous directional terms like "left/right" in favor of
 * landmark-based "go to" instructions.
 */
function simplifyInstruction(
  segment: RouteSegment,
  stepNumber: number,
  zoneNames?: Record<string, string>
): string {
  const destination = zoneNames?.[segment.toZone] ?? segment.toZone;
  const distance = segment.distance;

  return `${stepNumber}. Go to ${destination} (${distance}m)`;
}

/**
 * SimpleRouteSteps displays route directions in a child-friendly,
 * neurodivergent-accessible format with max 3 steps visible.
 */
export function SimpleRouteSteps({ segments, zoneNames }: SimpleRouteStepsProps) {
  const [startIndex, setStartIndex] = useState(0);

  if (segments.length === 0) {
    return (
      <div className="p-4 text-center" role="status">
        <p className="text-lg text-gray-500 dark:text-gray-400">
          No directions yet. Pick where you want to go!
        </p>
      </div>
    );
  }

  const endIndex = Math.min(startIndex + MAX_VISIBLE_STEPS, segments.length);
  const visibleSegments = segments.slice(startIndex, endIndex);
  const canGoBack = startIndex > 0;
  const canGoForward = endIndex < segments.length;
  const totalSteps = segments.length;

  return (
    <div
      className="p-4 space-y-4"
      aria-label="Simple route steps"
      role="region"
    >
      {/* Progress indicator */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">
          Your Directions
        </h3>
        <span
          className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded"
          aria-label={`Showing steps ${startIndex + 1} to ${endIndex} of ${totalSteps}`}
        >
          {startIndex + 1}–{endIndex} of {totalSteps}
        </span>
      </div>

      {/* Steps list */}
      <ol
        className="space-y-3"
        aria-label={`Steps ${startIndex + 1} through ${endIndex}`}
      >
        {visibleSegments.map((segment, index) => {
          const stepNumber = startIndex + index + 1;
          return (
            <li
              key={segment.edgeId}
              className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800"
            >
              {/* Step number badge */}
              <span
                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-blue-500 text-white text-lg font-bold"
                aria-hidden="true"
              >
                {stepNumber}
              </span>
              {/* Instruction text - large and clear */}
              <span className="text-base font-medium text-gray-800 dark:text-gray-200">
                {simplifyInstruction(segment, stepNumber, zoneNames)}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setStartIndex(Math.max(0, startIndex - MAX_VISIBLE_STEPS))}
          disabled={!canGoBack}
          className={`
            flex-1 py-3 px-4 rounded-xl text-base font-bold transition-colors
            focus:outline-2 focus:outline-offset-2 focus:outline-blue-500
            ${canGoBack
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }
          `}
          aria-label="Show previous steps"
        >
          ← Back
        </button>
        <button
          onClick={() => setStartIndex(Math.min(segments.length - 1, startIndex + MAX_VISIBLE_STEPS))}
          disabled={!canGoForward}
          className={`
            flex-1 py-3 px-4 rounded-xl text-base font-bold transition-colors
            focus:outline-2 focus:outline-offset-2 focus:outline-blue-500
            ${canGoForward
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }
          `}
          aria-label="Show next steps"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
