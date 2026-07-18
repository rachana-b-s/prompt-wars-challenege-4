'use client';

/**
 * useProactiveWarnings — monitors fan's zone dwell time and conditions
 * to trigger proactive GenAI warnings about heat/dehydration.
 *
 * Triggers:
 * - Sun-exposed zone with density > 60 for > 30 minutes (Req 15.5)
 * - Sun-exposed zone for > 45 minutes regardless of density (Req 17.6)
 * - Temperature above 28°C with sun exposure (Req 17.1)
 *
 * Recommends nearest water station or cooling zone with estimated walking time.
 *
 * Requirements: 15.5, 17.1, 17.6
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getProactiveWarning } from '@/services/genai-client';

// --- Types ---

export interface ProactiveWarning {
  id: string;
  message: string;
  type: 'heat' | 'dehydration' | 'sun_exposure';
  timestamp: number;
  dismissed: boolean;
}

export interface UseProactiveWarningsOptions {
  /** Fan's current zone ID */
  currentZone: string | undefined;
  /** Whether current zone is sun-exposed */
  isSunExposed: boolean;
  /** Current zone density (0-100) */
  density: number;
  /** Current temperature in Celsius */
  temperature: number;
  /** Fan's language preference */
  language: string;
  /** Check interval in ms (default: 60000 = 1 minute) */
  checkIntervalMs?: number;
  /** Whether warnings are enabled */
  enabled?: boolean;
}

export interface UseProactiveWarningsResult {
  warnings: ProactiveWarning[];
  dismissWarning: (id: string) => void;
  clearAllWarnings: () => void;
}

// --- Constants ---

/** Threshold: high density + sun for > 30 min triggers warning (Req 15.5) */
const HIGH_DENSITY_SUN_THRESHOLD_MIN = 30;
/** Threshold: sun exposure for > 45 min triggers warning regardless (Req 17.6) */
const PROLONGED_SUN_THRESHOLD_MIN = 45;
/** Density threshold for high density warning (Req 15.5) */
const HIGH_DENSITY_THRESHOLD = 60;
/** Temperature threshold for heat warning (Req 17.1) */
const TEMPERATURE_THRESHOLD = 28;
/** Minimum time between warnings to avoid spam (ms) */
const WARNING_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

// --- Hook ---

export function useProactiveWarnings(
  options: UseProactiveWarningsOptions
): UseProactiveWarningsResult {
  const {
    currentZone,
    isSunExposed,
    density,
    temperature,
    language,
    checkIntervalMs = 60_000,
    enabled = true,
  } = options;

  const [warnings, setWarnings] = useState<ProactiveWarning[]>([]);
  const dwellStartRef = useRef<number>(0);
  const lastZoneRef = useRef<string | undefined>(currentZone);
  const lastWarningTimeRef = useRef<number>(0);

  // Reset dwell timer when zone changes (or initialize on first render)
  useEffect(() => {
    if (dwellStartRef.current === 0 || currentZone !== lastZoneRef.current) {
      dwellStartRef.current = Date.now();
      lastZoneRef.current = currentZone;
    }
  }, [currentZone]);

  // Periodic check for warning conditions
  useEffect(() => {
    if (!enabled || !currentZone) return;

    const interval = setInterval(async () => {
      const dwellTimeMin = (Date.now() - dwellStartRef.current) / 60_000;
      const now = Date.now();

      // Check cooldown
      if (now - lastWarningTimeRef.current < WARNING_COOLDOWN_MS) return;

      // Determine if warning conditions are met
      let shouldWarn = false;

      // Req 15.5: sun-exposed + density > 60 + dwell > 30 min
      if (isSunExposed && density > HIGH_DENSITY_THRESHOLD && dwellTimeMin > HIGH_DENSITY_SUN_THRESHOLD_MIN) {
        shouldWarn = true;
      }

      // Req 17.6: sun-exposed + dwell > 45 min (any density)
      if (isSunExposed && dwellTimeMin > PROLONGED_SUN_THRESHOLD_MIN) {
        shouldWarn = true;
      }

      // Req 17.1: temperature > 28°C with sun exposure
      if (isSunExposed && temperature > TEMPERATURE_THRESHOLD && dwellTimeMin > HIGH_DENSITY_SUN_THRESHOLD_MIN) {
        shouldWarn = true;
      }

      if (!shouldWarn) return;

      // Generate warning message via GenAI (or fallback)
      const warningMessage = await getProactiveWarning({
        currentZone,
        dwellTime: Math.round(dwellTimeMin),
        density,
        temperature,
        language,
      });

      if (warningMessage) {
        const warningType: ProactiveWarning['type'] =
          temperature > TEMPERATURE_THRESHOLD ? 'heat' :
          dwellTimeMin > PROLONGED_SUN_THRESHOLD_MIN ? 'sun_exposure' :
          'dehydration';

        const newWarning: ProactiveWarning = {
          id: `warning-${now}`,
          message: warningMessage,
          type: warningType,
          timestamp: now,
          dismissed: false,
        };

        setWarnings((prev) => [...prev, newWarning]);
        lastWarningTimeRef.current = now;
      }
    }, checkIntervalMs);

    return () => clearInterval(interval);
  }, [currentZone, isSunExposed, density, temperature, language, checkIntervalMs, enabled]);

  const dismissWarning = useCallback((id: string) => {
    setWarnings((prev) =>
      prev.map((w) => (w.id === id ? { ...w, dismissed: true } : w))
    );
  }, []);

  const clearAllWarnings = useCallback(() => {
    setWarnings([]);
  }, []);

  return {
    warnings: warnings.filter((w) => !w.dismissed),
    dismissWarning,
    clearAllWarnings,
  };
}
