'use client';

/**
 * AccessibilityAdaptations — Deaf/Hard-of-Hearing UI adaptations.
 *
 * Provides:
 * - VisualAlert: Flashes for route changes and emergency notifications
 * - hapticNotify(pattern): Vibration API utility for time-sensitive alerts
 * - AmbientAudioDisplay: Textual representations of ambient audio info
 *
 * Requirements: 3.5, 3.6, 3.7
 */

import { useState, useEffect, useCallback } from 'react';

// --- Types ---

export type AlertSeverity = 'info' | 'warning' | 'emergency';

export interface VisualAlertProps {
  message: string;
  severity: AlertSeverity;
  visible: boolean;
  onDismiss?: () => void;
}

export interface AmbientAudioInfo {
  zone: string;
  description: string;
  level: 'quiet' | 'moderate' | 'loud';
}

// --- Haptic Notification Utility ---

/**
 * Triggers a haptic vibration pattern using the Vibration API.
 * Falls back silently if Vibration API is not available.
 *
 * @param pattern - Array of durations in ms [vibrate, pause, vibrate, ...]
 *                  or a single duration number.
 * @returns true if vibration was triggered, false if API unavailable.
 */
export function hapticNotify(pattern: number | number[]): boolean {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      return navigator.vibrate(pattern);
    } catch {
      return false;
    }
  }
  return false;
}

/** Predefined haptic patterns for common alert types */
export const HAPTIC_PATTERNS: Record<string, number[]> = {
  /** Short single pulse for route change */
  routeChange: [200, 100, 200],
  /** Urgent repeated pulses for emergency */
  emergency: [300, 100, 300, 100, 300],
  /** Gentle double tap for informational */
  info: [100, 50, 100],
};

// --- VisualAlert Component ---

/**
 * Flashing visual alert for route changes and emergency notifications.
 * Uses color-coded backgrounds and ARIA live regions for accessibility.
 */
export function VisualAlert({ message, severity, visible, onDismiss }: VisualAlertProps) {
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 1000);
      return () => clearTimeout(timer);
    }
    setIsFlashing(false);
  }, [visible, message]);

  if (!visible) return null;

  const severityStyles: Record<AlertSeverity, string> = {
    info: 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 text-blue-800 dark:text-blue-200',
    warning: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400 text-yellow-800 dark:text-yellow-200',
    emergency: 'bg-red-100 dark:bg-red-900/30 border-red-400 text-red-800 dark:text-red-200',
  };

  const flashClass = isFlashing ? 'animate-pulse ring-4 ring-current ring-opacity-50' : '';

  return (
    <div
      role="alert"
      aria-live={severity === 'emergency' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={`
        flex items-center justify-between gap-3 p-3 rounded-lg border-2
        ${severityStyles[severity]} ${flashClass}
        transition-all duration-200
      `}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="text-lg">
          {severity === 'emergency' ? '⚠️' : severity === 'warning' ? '🔔' : 'ℹ️'}
        </span>
        <span className="text-sm font-medium">{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-current opacity-60 hover:opacity-100 transition-opacity focus:outline-2 focus:outline-offset-2 rounded"
          aria-label="Dismiss alert"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// --- AmbientAudioDisplay Component ---

/**
 * Displays textual representations of ambient audio information
 * relevant to navigation for deaf/hard-of-hearing users.
 *
 * Examples: "loud crowd noise ahead", "announcement playing in Zone B"
 */
export function AmbientAudioDisplay({ audioInfo }: { audioInfo: AmbientAudioInfo[] }) {
  if (audioInfo.length === 0) return null;

  const levelIcons: Record<AmbientAudioInfo['level'], string> = {
    quiet: '🔇',
    moderate: '🔉',
    loud: '🔊',
  };

  const levelStyles: Record<AmbientAudioInfo['level'], string> = {
    quiet: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    moderate: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
    loud: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
  };

  return (
    <div aria-label="Ambient audio information" className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        Sound Environment
      </h3>
      <ul className="space-y-1.5" role="list">
        {audioInfo.map((info, index) => (
          <li
            key={`${info.zone}-${index}`}
            className={`flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-md ${levelStyles[info.level]}`}
          >
            <span aria-hidden="true">{levelIcons[info.level]}</span>
            <span>
              <strong className="font-medium">{info.zone}:</strong> {info.description}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- useVisualAlerts Hook ---

/**
 * Hook to manage a queue of visual alerts with auto-dismiss.
 */
export function useVisualAlerts() {
  const [alerts, setAlerts] = useState<
    Array<{ id: string; message: string; severity: AlertSeverity }>
  >([]);

  const showAlert = useCallback((message: string, severity: AlertSeverity) => {
    const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setAlerts((prev) => [...prev, { id, message, severity }]);

    // Trigger haptic feedback for deaf/HoH users
    if (severity === 'emergency') {
      hapticNotify(HAPTIC_PATTERNS.emergency);
    } else if (severity === 'warning') {
      hapticNotify(HAPTIC_PATTERNS.routeChange);
    } else {
      hapticNotify(HAPTIC_PATTERNS.info);
    }

    // Auto-dismiss after 5 seconds (except emergency)
    if (severity !== 'emergency') {
      setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }, 5000);
    }
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { alerts, showAlert, dismissAlert };
}
