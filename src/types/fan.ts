/**
 * Fan profile, accessibility, group, and allegiance types
 * for the Smart Stadium Fan Navigator.
 */

import type { ZoneId, ZoneType } from './stadium';

export type FanAllegiance = 'home' | 'away' | 'neutral';

export type LanguageCode = 'en' | 'es' | 'fr' | 'ar' | 'pt' | 'de' | 'ja' | 'zh';

export type AccessibilityCategory =
  | 'wheelchair'
  | 'limited_mobility'
  | 'blind'
  | 'low_vision'
  | 'deaf'
  | 'hard_of_hearing'
  | 'neurodivergent'
  | 'pregnant'
  | 'elderly'
  | 'child_accompanied';

export interface AccessibilityProfile {
  categories: AccessibilityCategory[];
  hasCompanion: boolean;
  maxWalkingDistance?: number;
  avoidStairs: boolean;
  avoidCrowds: boolean;
  preferQuiet: boolean;
  allergens: string[];
}

export interface FanProfile {
  id: string;
  accessibilityProfile: AccessibilityProfile;
  allegiance: FanAllegiance;
  language: LanguageCode;
  currentZone?: ZoneId;
  recentDestinations: ZoneId[];
}

export interface FanGroupMember {
  id: string;
  name: string;
  accessibilityProfile: AccessibilityProfile;
}

export interface GroupConstraintSet {
  stepFreeRequired: boolean;
  maxWalkingDistance: number;
  avoidStairs: boolean;
  avoidCrowds: boolean;
  preferQuiet: boolean;
  excludedZoneTypes: ZoneType[];
  excludedAllegiances: ('home' | 'away')[];
  allergens: string[];
  hasChild: boolean;
  hasPregnant: boolean;
}

export interface FanGroup {
  id: string;
  members: FanGroupMember[];
  constraintSet: GroupConstraintSet;
}
