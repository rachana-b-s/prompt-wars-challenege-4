/**
 * Emergency, SOS, and medical triage types
 * for the Smart Stadium Fan Navigator.
 */

import type { ZoneId } from './stadium';

export interface SOSAlert {
  id: string;
  zone: ZoneId;
  timestamp: number;
  type: 'medical' | 'security' | 'general';
  description?: string;
}

export interface LostChildProtocol {
  id: string;
  childAge: number;
  childDescription: string;
  lastKnownZone: ZoneId;
  timestamp: number;
  contactInfo: string;
}

export interface TriageResponse {
  recommendation: 'water_station' | 'first_aid' | 'medical_center';
  reasoning: string;
  nearestFacilityId: string;
  urgency: 'low' | 'medium' | 'high';
  disclaimer: string;
}
