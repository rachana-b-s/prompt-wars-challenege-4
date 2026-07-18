/**
 * Route request, result, constraint, and warning types
 * for the Smart Stadium Fan Navigator.
 */

import type { ZoneId, ZoneType } from './stadium';
import type { FanProfile, FanGroup } from './fan';

export interface RouteRequest {
  source: ZoneId;
  destination: ZoneId;
  fanProfile: FanProfile;
  avoidZones?: ZoneId[];
}

export interface GroupRouteRequest {
  source: ZoneId;
  destination: ZoneId;
  group: FanGroup;
  avoidZones?: ZoneId[];
}

export interface RouteSegment {
  fromZone: ZoneId;
  toZone: ZoneId;
  edgeId: string;
  distance: number;
  instruction: string;
}

export interface RouteWarning {
  type:
    | 'allegiance_proximity'
    | 'high_density'
    | 'sensory_trigger'
    | 'no_rest_area'
    | 'sun_exposure';
  message: string;
  zone: ZoneId;
}

export interface RouteResult {
  status: 'found' | 'not_found' | 'partial';
  path: ZoneId[];
  segments: RouteSegment[];
  distance: number;
  estimatedTime: number;
  zonesTraversed: number;
  warnings: RouteWarning[];
  alternatives?: RouteResult[];
  nearestReachable?: ZoneId;
}

export interface RouteConstraints {
  stepFreeRequired: boolean;
  maxEdgeDistance: number;
  avoidHighDensity: boolean;
  avoidZoneTypes: ZoneType[];
  excludeAllegiance: ('home' | 'away')[];
  preferQuiet: boolean;
  isSOS: boolean;
}
