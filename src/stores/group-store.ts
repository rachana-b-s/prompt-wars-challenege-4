/**
 * Zustand store for fan group state management.
 * Auto-recomputes GroupConstraintSet via mergeProfiles() whenever members change.
 * When a member has 'child_accompanied' category, merged constraints
 * auto-incorporate child safety.
 * Persists to localStorage.
 *
 * Requirements: 4.1, 4.6, 4.7
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FanGroup, FanGroupMember, GroupConstraintSet } from '@/types/fan';
import { mergeProfiles } from '@/engine/constraint-solver';

export interface GroupState {
  group: FanGroup;
  addMember: (member: FanGroupMember) => void;
  removeMember: (memberId: string) => void;
  updateMember: (memberId: string, updates: Partial<FanGroupMember>) => void;
  clearGroup: () => void;
}

function emptyConstraintSet(): GroupConstraintSet {
  return {
    stepFreeRequired: false,
    maxWalkingDistance: 2000,
    avoidStairs: false,
    avoidCrowds: false,
    preferQuiet: false,
    excludedZoneTypes: [],
    excludedAllegiances: [],
    allergens: [],
    hasChild: false,
    hasPregnant: false,
  };
}

function createDefaultGroup(): FanGroup {
  return {
    id: crypto.randomUUID(),
    members: [],
    constraintSet: emptyConstraintSet(),
  };
}

export const useGroupStore = create<GroupState>()(
  persist(
    (set) => ({
      group: createDefaultGroup(),

      addMember: (member: FanGroupMember) => {
        set((state) => {
          const updatedMembers = [...state.group.members, member];
          return {
            group: {
              ...state.group,
              members: updatedMembers,
              constraintSet: mergeProfiles(updatedMembers),
            },
          };
        });
      },

      removeMember: (memberId: string) => {
        set((state) => {
          const updatedMembers = state.group.members.filter(
            (m) => m.id !== memberId
          );
          return {
            group: {
              ...state.group,
              members: updatedMembers,
              constraintSet:
                updatedMembers.length > 0
                  ? mergeProfiles(updatedMembers)
                  : emptyConstraintSet(),
            },
          };
        });
      },

      updateMember: (memberId: string, updates: Partial<FanGroupMember>) => {
        set((state) => {
          const updatedMembers = state.group.members.map((m) =>
            m.id === memberId ? { ...m, ...updates } : m
          );
          return {
            group: {
              ...state.group,
              members: updatedMembers,
              constraintSet: mergeProfiles(updatedMembers),
            },
          };
        });
      },

      clearGroup: () => {
        set((state) => ({
          group: {
            ...state.group,
            members: [],
            constraintSet: emptyConstraintSet(),
          },
        }));
      },
    }),
    {
      name: 'fan-group',
      partialize: (state) => ({ group: state.group }),
    }
  )
);
