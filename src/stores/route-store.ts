/**
 * Zustand store for sharing route state between components.
 * The MapInteractionWrapper computes routes and stores them here;
 * the RoutePanel reads the current route for display.
 *
 * Requirements: 1.4, 2.1, 11.3
 */

import { create } from 'zustand';
import type { RouteResult } from '@/types/route';

export interface RouteState {
  route: RouteResult | null;
  destination: string | null;
  isComputing: boolean;
  setRoute: (route: RouteResult | null) => void;
  setDestination: (destination: string | null) => void;
  setIsComputing: (isComputing: boolean) => void;
  clear: () => void;
}

export const useRouteStore = create<RouteState>((set) => ({
  route: null,
  destination: null,
  isComputing: false,

  /** Store the computed route result and mark computation as complete. */
  setRoute: (route) => set({ route, isComputing: false }),
  /** Set the target destination zone ID for route computation. */
  setDestination: (destination) => set({ destination }),
  /** Toggle the computing state flag (used for loading indicators). */
  setIsComputing: (isComputing) => set({ isComputing }),
  /** Clear all route state, resetting to initial empty values. */
  clear: () => set({ route: null, destination: null, isComputing: false }),
}));
