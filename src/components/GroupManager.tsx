'use client';

/**
 * GroupManager — Manages a fan group with individual AccessibilityProfiles per member.
 * Displays merged GroupConstraintSet summary and shows which member constraints
 * influenced the group routing.
 *
 * Requirements: 4.1, 4.4, 4.6
 */

import { useState } from 'react';
import { useGroupStore } from '@/stores/group-store';
import type {
  AccessibilityCategory,
  AccessibilityProfile,
  FanGroupMember,
} from '@/types/fan';

const ACCESSIBILITY_CATEGORIES: {
  value: AccessibilityCategory;
  label: string;
}[] = [
  { value: 'wheelchair', label: 'Wheelchair user' },
  { value: 'limited_mobility', label: 'Limited mobility' },
  { value: 'blind', label: 'Blind' },
  { value: 'low_vision', label: 'Low vision' },
  { value: 'deaf', label: 'Deaf' },
  { value: 'hard_of_hearing', label: 'Hard of hearing' },
  { value: 'neurodivergent', label: 'Neurodivergent' },
  { value: 'pregnant', label: 'Pregnant' },
  { value: 'elderly', label: 'Elderly' },
  { value: 'child_accompanied', label: 'With child' },
];

function createEmptyProfile(): AccessibilityProfile {
  return {
    categories: [],
    hasCompanion: false,
    avoidStairs: false,
    avoidCrowds: false,
    preferQuiet: false,
    allergens: [],
  };
}

/**
 * Determines which members contribute to each active constraint
 * for the merged GroupConstraintSet.
 */
function getConstraintInfluencers(members: FanGroupMember[]) {
  const influences: Record<string, string[]> = {};

  for (const member of members) {
    const profile = member.accessibilityProfile;

    if (
      profile.categories.includes('wheelchair') ||
      profile.categories.includes('limited_mobility') ||
      profile.avoidStairs
    ) {
      if (!influences['Step-free required']) {
        influences['Step-free required'] = [];
      }
      influences['Step-free required'].push(member.name);
    }

    if (profile.avoidCrowds) {
      if (!influences['Avoid crowds']) {
        influences['Avoid crowds'] = [];
      }
      influences['Avoid crowds'].push(member.name);
    }

    if (profile.preferQuiet) {
      if (!influences['Prefer quiet routes']) {
        influences['Prefer quiet routes'] = [];
      }
      influences['Prefer quiet routes'].push(member.name);
    }

    if (profile.categories.includes('child_accompanied')) {
      if (!influences['Child safety zones excluded']) {
        influences['Child safety zones excluded'] = [];
      }
      influences['Child safety zones excluded'].push(member.name);
    }

    if (profile.categories.includes('pregnant')) {
      if (!influences['Pregnancy routing']) {
        influences['Pregnancy routing'] = [];
      }
      influences['Pregnancy routing'].push(member.name);
    }

    if (
      profile.categories.includes('neurodivergent') ||
      profile.preferQuiet
    ) {
      if (!influences['Avoid sensory triggers']) {
        influences['Avoid sensory triggers'] = [];
      }
      if (!influences['Avoid sensory triggers'].includes(member.name)) {
        influences['Avoid sensory triggers'].push(member.name);
      }
    }

    if (profile.maxWalkingDistance !== undefined) {
      if (!influences['Max walking distance']) {
        influences['Max walking distance'] = [];
      }
      influences['Max walking distance'].push(member.name);
    }

    if (profile.allergens.length > 0) {
      if (!influences['Allergen restrictions']) {
        influences['Allergen restrictions'] = [];
      }
      influences['Allergen restrictions'].push(member.name);
    }
  }

  return influences;
}

export function GroupManager() {
  const { group, addMember, removeMember, clearGroup } = useGroupStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newProfile, setNewProfile] = useState<AccessibilityProfile>(
    createEmptyProfile()
  );

  const handleAddMember = () => {
    if (!newName.trim()) return;

    const member: FanGroupMember = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      accessibilityProfile: { ...newProfile },
    };

    addMember(member);
    setNewName('');
    setNewProfile(createEmptyProfile());
    setShowAddForm(false);
  };

  const handleCategoryToggle = (category: AccessibilityCategory) => {
    setNewProfile((prev) => {
      const categories = prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category];
      return { ...prev, categories };
    });
  };

  const influences = getConstraintInfluencers(group.members);

  return (
    <div className="p-4" role="region" aria-label="Group management">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-foreground">
          Group ({group.members.length})
        </h2>
        {group.members.length > 0 && (
          <button
            onClick={clearGroup}
            className="text-xs text-red-600 hover:text-red-800 underline"
            aria-label="Remove all group members"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Member List */}
      {group.members.length === 0 && !showAddForm && (
        <p className="text-sm text-gray-500 mb-3">
          No group members yet. Add members to enable group navigation.
        </p>
      )}

      <ul className="space-y-2 mb-3" aria-label="Group members">
        {group.members.map((member) => (
          <li
            key={member.id}
            className="flex items-start justify-between border border-gray-200 rounded-md p-2"
          >
            <div className="flex-1 min-w-0">
              <span className="font-medium text-sm text-foreground block truncate">
                {member.name}
              </span>
              {member.accessibilityProfile.categories.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {member.accessibilityProfile.categories.map((cat) => (
                    <span
                      key={cat}
                      className="inline-block bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5 rounded"
                    >
                      {ACCESSIBILITY_CATEGORIES.find((c) => c.value === cat)
                        ?.label ?? cat}
                    </span>
                  ))}
                </div>
              )}
              {member.accessibilityProfile.categories.length === 0 && (
                <span className="text-xs text-gray-400">
                  No accessibility needs
                </span>
              )}
            </div>
            <button
              onClick={() => removeMember(member.id)}
              className="ml-2 text-red-500 hover:text-red-700 text-sm flex-shrink-0"
              aria-label={`Remove ${member.name} from group`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {/* Add Member Form */}
      {showAddForm ? (
        <div
          className="border border-gray-300 rounded-md p-3 mb-3"
          role="form"
          aria-label="Add new group member"
        >
          <label className="block text-sm font-medium text-foreground mb-1">
            Name
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded px-2 py-1 text-sm"
              placeholder="Member name"
              autoFocus
            />
          </label>

          <fieldset className="mt-2">
            <legend className="text-sm font-medium text-foreground mb-1">
              Accessibility needs
            </legend>
            <div className="grid grid-cols-2 gap-1">
              {ACCESSIBILITY_CATEGORIES.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-1.5 text-xs cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={newProfile.categories.includes(value)}
                    onChange={() => handleCategoryToggle(value)}
                    className="rounded border-gray-300"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAddMember}
              disabled={!newName.trim()}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewName('');
                setNewProfile(createEmptyProfile());
              }}
              className="px-3 py-1 border border-gray-300 text-sm rounded hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-1.5 border border-dashed border-gray-400 text-sm text-gray-600 rounded hover:border-gray-600 hover:text-gray-800 mb-3"
        >
          + Add Member
        </button>
      )}

      {/* Merged Constraint Set Summary */}
      {group.members.length > 0 && (
        <div
          className="border-t border-gray-200 pt-3"
          role="region"
          aria-label="Group constraint summary"
        >
          <h3 className="text-sm font-semibold text-foreground mb-2">
            Group Constraints
          </h3>
          <ul className="space-y-1.5 text-xs">
            {group.constraintSet.stepFreeRequired && (
              <li className="flex items-start gap-2">
                <span className="text-green-600 flex-shrink-0">●</span>
                <span>
                  <span className="font-medium">Step-free required</span>
                  {influences['Step-free required'] && (
                    <span className="text-gray-500 ml-1">
                      (due to {influences['Step-free required'].join(', ')})
                    </span>
                  )}
                </span>
              </li>
            )}
            {group.constraintSet.maxWalkingDistance < 2000 && (
              <li className="flex items-start gap-2">
                <span className="text-orange-500 flex-shrink-0">●</span>
                <span>
                  <span className="font-medium">
                    Max distance: {group.constraintSet.maxWalkingDistance}m
                  </span>
                  {influences['Max walking distance'] && (
                    <span className="text-gray-500 ml-1">
                      (due to {influences['Max walking distance'].join(', ')})
                    </span>
                  )}
                </span>
              </li>
            )}
            {group.constraintSet.avoidCrowds && (
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 flex-shrink-0">●</span>
                <span>
                  <span className="font-medium">Avoid crowds</span>
                  {influences['Avoid crowds'] && (
                    <span className="text-gray-500 ml-1">
                      (due to {influences['Avoid crowds'].join(', ')})
                    </span>
                  )}
                </span>
              </li>
            )}
            {group.constraintSet.preferQuiet && (
              <li className="flex items-start gap-2">
                <span className="text-purple-500 flex-shrink-0">●</span>
                <span>
                  <span className="font-medium">Prefer quiet routes</span>
                  {influences['Prefer quiet routes'] && (
                    <span className="text-gray-500 ml-1">
                      (due to {influences['Prefer quiet routes'].join(', ')})
                    </span>
                  )}
                </span>
              </li>
            )}
            {group.constraintSet.hasChild && (
              <li className="flex items-start gap-2">
                <span className="text-pink-500 flex-shrink-0">●</span>
                <span>
                  <span className="font-medium">
                    Child safety zones excluded
                  </span>
                  {influences['Child safety zones excluded'] && (
                    <span className="text-gray-500 ml-1">
                      (due to{' '}
                      {influences['Child safety zones excluded'].join(', ')})
                    </span>
                  )}
                </span>
              </li>
            )}
            {group.constraintSet.hasPregnant && (
              <li className="flex items-start gap-2">
                <span className="text-pink-400 flex-shrink-0">●</span>
                <span>
                  <span className="font-medium">Pregnancy routing</span>
                  {influences['Pregnancy routing'] && (
                    <span className="text-gray-500 ml-1">
                      (due to {influences['Pregnancy routing'].join(', ')})
                    </span>
                  )}
                </span>
              </li>
            )}
            {group.constraintSet.excludedZoneTypes.length > 0 && (
              <li className="flex items-start gap-2">
                <span className="text-red-500 flex-shrink-0">●</span>
                <span>
                  <span className="font-medium">
                    Excluded zones:{' '}
                    {group.constraintSet.excludedZoneTypes.join(', ')}
                  </span>
                  {influences['Avoid sensory triggers'] && (
                    <span className="text-gray-500 ml-1">
                      (due to{' '}
                      {influences['Avoid sensory triggers'].join(', ')})
                    </span>
                  )}
                </span>
              </li>
            )}
            {group.constraintSet.allergens.length > 0 && (
              <li className="flex items-start gap-2">
                <span className="text-amber-600 flex-shrink-0">●</span>
                <span>
                  <span className="font-medium">
                    Allergens: {group.constraintSet.allergens.join(', ')}
                  </span>
                  {influences['Allergen restrictions'] && (
                    <span className="text-gray-500 ml-1">
                      (due to{' '}
                      {influences['Allergen restrictions'].join(', ')})
                    </span>
                  )}
                </span>
              </li>
            )}
            {!group.constraintSet.stepFreeRequired &&
              !group.constraintSet.avoidCrowds &&
              !group.constraintSet.preferQuiet &&
              !group.constraintSet.hasChild &&
              !group.constraintSet.hasPregnant &&
              group.constraintSet.excludedZoneTypes.length === 0 &&
              group.constraintSet.allergens.length === 0 &&
              group.constraintSet.maxWalkingDistance >= 2000 && (
                <li className="text-gray-400">
                  No special constraints — standard routing applies.
                </li>
              )}
          </ul>
        </div>
      )}
    </div>
  );
}
