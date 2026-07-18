/**
 * Core stadium graph types for the Smart Stadium Fan Navigator.
 * These types define the data model for zones, edges, facilities,
 * and the overall stadium graph structure.
 */

export type ZoneId = string;
export type FacilityId = string;

export interface StadiumGraph {
  zones: Zone[];
  edges: GraphEdge[];
  metadata: StadiumMetadata;
}

export interface StadiumMetadata {
  name: string;
  capacity: number;
  zoneCount: number;
  lastUpdated: string; // ISO timestamp
}

export interface Zone {
  id: ZoneId;
  name: string;
  type: ZoneType;
  allegiance: 'home' | 'away' | 'neutral' | 'buffer';
  capacity: number;
  currentDensity: number; // 0-100
  lastDensityUpdate: number; // timestamp ms
  accessibilityFeatures: ZoneAccessibility;
  noiseLevel: 'low' | 'medium' | 'high';
  sensoryTriggers: SensoryTrigger[];
  isSunExposed: boolean;
  isIndoor: boolean;
  facilities: FacilityId[];
  position: { x: number; y: number };
  shape: ZoneShape;
}

export type ZoneType =
  | 'gate'
  | 'concourse'
  | 'seating_section'
  | 'concession_area'
  | 'restroom_cluster'
  | 'medical_area'
  | 'family_section'
  | 'accessible_seating'
  | 'service_corridor'
  | 'loading_dock'
  | 'smoking_area'
  | 'cooling_zone'
  | 'prayer_area';

export type SensoryTrigger =
  | 'fireworks'
  | 'dj_booth'
  | 'large_screen_flash'
  | 'pyrotechnics'
  | 'loud_music';

export interface ZoneAccessibility {
  stepFree: boolean;
  hasRamp: boolean;
  hasElevator: boolean;
  hasTactileIndicators: boolean;
  hasHandrails: boolean;
  hasRestArea: boolean;
  wideCorridors: boolean;
  maxGradient: number; // percentage
  hasWallFollowingPath: boolean;
}

export interface ZoneShape {
  type: 'polygon' | 'rect' | 'circle' | 'path';
  data: string; // SVG path data or coordinate array
}

export interface GraphEdge {
  id: string;
  source: ZoneId;
  target: ZoneId;
  distance: number; // meters
  bidirectional: boolean;
  accessibility: EdgeAccessibility;
  type: EdgeType;
}

export interface EdgeAccessibility {
  stepFree: boolean;
  hasStairs: boolean;
  hasEscalator: boolean;
  hasRamp: boolean;
  hasElevator: boolean;
  width: number; // meters
  gradient: number; // percentage incline
  hasTactileIndicators: boolean;
  hasHandrails: boolean;
  maxUninterruptedDistance: number; // meters without rest area
}

export type EdgeType = 'corridor' | 'ramp' | 'stairs' | 'elevator' | 'escalator' | 'outdoor_path';
