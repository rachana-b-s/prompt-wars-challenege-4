'use client';

/**
 * ErrorBoundary — React error boundary with user-friendly messages and retry.
 *
 * Also provides utility components for:
 * - Crowd data unavailable fallback (distance-only routing notification)
 * - Zone closed handling (suggest nearest open alternative)
 * - Group constraint conflict resolution (identify conflicts, suggest split or alternative)
 *
 * Requirements: 12.1–12.6
 */

import { Component, type ReactNode } from 'react';

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary that catches runtime errors and displays
 * a user-friendly error message with a retry action.
 *
 * Requirement: 12.4
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center p-6 space-y-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-red-800 dark:text-red-200">
              Something went wrong
            </p>
            <p className="text-sm text-red-600 dark:text-red-400">
              An unexpected error occurred. Please try again.
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-red-600"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Crowd Data Unavailable Fallback ---

export interface CrowdUnavailableNoticeProps {
  /** Whether crowd data is currently unavailable */
  isUnavailable: boolean;
}

/**
 * Notification displayed when crowd data is unavailable.
 * Routes will use distance-only optimization.
 *
 * Requirement: 12.2
 */
export function CrowdUnavailableNotice({ isUnavailable }: CrowdUnavailableNoticeProps) {
  if (!isUnavailable) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md"
    >
      <span aria-hidden="true" className="text-yellow-600 dark:text-yellow-400">
        ⚠️
      </span>
      <p className="text-sm text-yellow-700 dark:text-yellow-300">
        Crowd data is currently unavailable. Routes are using distance-only optimization.
      </p>
    </div>
  );
}

// --- Zone Closed Handling ---

export interface ZoneClosedNoticeProps {
  /** The closed zone name */
  closedZoneName: string;
  /** Suggested nearest open alternative zone name */
  alternativeZoneName?: string;
  /** Callback when user selects the alternative */
  onSelectAlternative?: () => void;
}

/**
 * Notice shown when a requested destination zone is closed.
 * Suggests the nearest open alternative.
 *
 * Requirement: 12.3
 */
export function ZoneClosedNotice({
  closedZoneName,
  alternativeZoneName,
  onSelectAlternative,
}: ZoneClosedNoticeProps) {
  return (
    <div
      role="alert"
      className="p-3 space-y-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg"
    >
      <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
        {closedZoneName} is currently closed
      </p>
      {alternativeZoneName && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-orange-600 dark:text-orange-400">
            Nearest open alternative: <strong>{alternativeZoneName}</strong>
          </p>
          {onSelectAlternative && (
            <button
              onClick={onSelectAlternative}
              className="text-sm font-medium text-orange-700 dark:text-orange-300 underline hover:no-underline focus:outline-2 focus:outline-offset-2 focus:outline-orange-600 rounded"
            >
              Route there
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Group Constraint Conflict Resolution ---

export interface ConstraintConflict {
  /** Description of the conflict */
  description: string;
  /** Which members' constraints conflict */
  memberNames: string[];
  /** Specific conflicting constraint types */
  conflictingConstraints: string[];
}

export interface GroupConflictResolutionProps {
  /** List of detected conflicts */
  conflicts: ConstraintConflict[];
  /** Callback when user chooses to split the group */
  onSplitGroup?: () => void;
  /** Callback when user chooses an alternative destination */
  onChooseAlternative?: () => void;
}

/**
 * Displays group constraint conflicts with suggestions to split
 * the group or choose an alternative destination.
 *
 * Requirement: 12.6
 */
export function GroupConflictResolution({
  conflicts,
  onSplitGroup,
  onChooseAlternative,
}: GroupConflictResolutionProps) {
  if (conflicts.length === 0) return null;

  return (
    <div
      role="alert"
      className="p-4 space-y-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg"
    >
      <div>
        <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">
          Group routing conflict
        </p>
        <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
          No single route satisfies all group members&apos; needs.
        </p>
      </div>

      {/* Conflict details */}
      <ul className="space-y-1.5" role="list">
        {conflicts.map((conflict, index) => (
          <li
            key={index}
            className="text-sm text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30 px-2 py-1.5 rounded"
          >
            <strong>{conflict.memberNames.join(', ')}:</strong>{' '}
            {conflict.description}
          </li>
        ))}
      </ul>

      {/* Suggested actions */}
      <div className="flex gap-2 pt-1">
        {onSplitGroup && (
          <button
            onClick={onSplitGroup}
            className="flex-1 px-3 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-purple-600"
          >
            Split Group
          </button>
        )}
        {onChooseAlternative && (
          <button
            onClick={onChooseAlternative}
            className="flex-1 px-3 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 rounded-lg hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors focus:outline-2 focus:outline-offset-2 focus:outline-purple-600"
          >
            Choose Alternative
          </button>
        )}
      </div>
    </div>
  );
}

// --- GenAI Unavailable Notice ---

/**
 * Fallback notice when GenAI reasoner is unreachable.
 *
 * Requirement: 12.1
 */
export function GenAIUnavailableNotice() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md"
    >
      <span className="text-sm text-gray-500 dark:text-gray-400 italic">
        AI explanation temporarily unavailable
      </span>
    </div>
  );
}
