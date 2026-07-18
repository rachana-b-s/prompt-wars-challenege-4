/**
 * Zustand store for stadium graph state management.
 * Auto-loads synthetic stadium data on first access.
 * Persists to localStorage for session continuity.
 *
 * Requirements: 6.1, 7.5, 10.5
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StadiumGraph, Zone, ZoneId, GraphEdge } from '@/types/stadium';
import { syntheticStadium } from '@/data/synthetic-stadium';

export interface StadiumState {
  graph: StadiumGraph | null;
  loadGraph: (graph: StadiumGraph) => void;
  replaceGraph: (graph: StadiumGraph) => void;
  getZone: (id: ZoneId) => Zone | undefined;
  getEdgesFrom: (id: ZoneId) => GraphEdge[];
  getNeighbors: (id: ZoneId) => ZoneId[];
}

export const useStadiumStore = create<StadiumState>()(
  persist(
    (set, get) => ({
      graph: syntheticStadium,

      loadGraph: (graph: StadiumGraph) => {
        const state = get();
        if (!state.graph) {
          set({ graph });
        }
      },

      replaceGraph: (graph: StadiumGraph) => {
        set({ graph });
      },

      getZone: (id: ZoneId): Zone | undefined => {
        const { graph } = get();
        if (!graph) return undefined;
        return graph.zones.find((z) => z.id === id);
      },

      getEdgesFrom: (id: ZoneId): GraphEdge[] => {
        const { graph } = get();
        if (!graph) return [];
        return graph.edges.filter(
          (e) =>
            e.source === id || (e.bidirectional && e.target === id)
        );
      },

      getNeighbors: (id: ZoneId): ZoneId[] => {
        const { graph } = get();
        if (!graph) return [];
        const neighbors: ZoneId[] = [];
        for (const edge of graph.edges) {
          if (edge.source === id) {
            neighbors.push(edge.target);
          } else if (edge.bidirectional && edge.target === id) {
            neighbors.push(edge.source);
          }
        }
        return neighbors;
      },
    }),
    {
      name: 'stadium-graph',
      partialize: (state) => ({ graph: state.graph }),
    }
  )
);
