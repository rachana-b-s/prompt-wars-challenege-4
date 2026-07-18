export type FacilityId = string;
export type ZoneId = string;

export type FacilityType =
  | 'food_stall'
  | 'water_station'
  | 'restroom_standard'
  | 'restroom_accessible'
  | 'restroom_family'
  | 'restroom_gender_neutral'
  | 'first_aid'
  | 'medical_center'
  | 'AED_station'
  | 'nursing_room'
  | 'charging_station'
  | 'prayer_room'
  | 'cooling_zone'
  | 'smoking_area'
  | 'lost_and_found'
  | 'rest_area';

export type DietaryFilter =
  | 'vegetarian'
  | 'vegan'
  | 'gluten_free'
  | 'halal'
  | 'kosher'
  | 'nut_free'
  | 'dairy_free';

export interface FacilityAccessibility {
  wheelchairAccessible: boolean;
  hasSignLanguageSupport: boolean;
  hasBrailleSignage: boolean;
  familyFriendly: boolean;
}

export interface FacilityAttributes {
  // Food stall specific
  dietaryOptions?: DietaryFilter[];
  cuisineType?: string;
  kidFriendly?: boolean;
  allergenInfo?: string[];
  // Restroom specific
  hasDiaperChanging?: boolean;
  hasNursingArea?: boolean;
  // Medical specific
  medicalCapability?: 'basic' | 'advanced' | 'emergency';
  hasAED?: boolean;
  // Prayer room specific
  qiblaDirection?: number; // degrees
  // General
  seatingCapacity?: number;
  isShaded?: boolean;
  hasCharging?: boolean;
}

export interface Facility {
  id: FacilityId;
  name: string;
  type: FacilityType;
  zone: ZoneId;
  status: 'open' | 'closed' | 'limited';
  accessibility: FacilityAccessibility;
  queueEstimate: number; // minutes
  attributes: FacilityAttributes;
}
