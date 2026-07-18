import { Facility } from '../types/facility';

/**
 * Synthetic facility data for the FIFA World Cup 2026 stadium demo.
 * Facilities are distributed logically across zones created by the synthetic stadium data.
 * Zone IDs reference the pattern from synthetic-stadium.ts (task 2.1).
 */
export const syntheticFacilities: Facility[] = [
  // ============================================================
  // FOOD STALLS (12 total — varied cuisines and dietary options)
  // ============================================================
  {
    id: 'food-taco-fiesta',
    name: 'Taco Fiesta',
    type: 'food_stall',
    zone: 'concourse-north',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 8,
    attributes: {
      dietaryOptions: ['gluten_free', 'halal'],
      cuisineType: 'Mexican',
      kidFriendly: true,
      allergenInfo: ['dairy', 'soy'],
    },
  },
  {
    id: 'food-noodle-house',
    name: 'Golden Noodle House',
    type: 'food_stall',
    zone: 'concourse-east',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 12,
    attributes: {
      dietaryOptions: ['vegan', 'vegetarian', 'nut_free'],
      cuisineType: 'Asian',
      kidFriendly: true,
      allergenInfo: ['soy', 'sesame', 'gluten'],
    },
  },
  {
    id: 'food-mediterranean-grill',
    name: 'Mediterranean Grill',
    type: 'food_stall',
    zone: 'concourse-south',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: true,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 6,
    attributes: {
      dietaryOptions: ['halal', 'gluten_free', 'dairy_free'],
      cuisineType: 'Mediterranean',
      kidFriendly: true,
      allergenInfo: ['sesame', 'nuts'],
    },
  },
  {
    id: 'food-burger-shack',
    name: 'Classic Burger Shack',
    type: 'food_stall',
    zone: 'concourse-west',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 15,
    attributes: {
      dietaryOptions: [],
      cuisineType: 'American',
      kidFriendly: true,
      allergenInfo: ['gluten', 'dairy', 'soy', 'eggs'],
    },
  },
  {
    id: 'food-vegan-garden',
    name: 'Green Garden Vegan',
    type: 'food_stall',
    zone: 'concourse-north',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 5,
    attributes: {
      dietaryOptions: ['vegan', 'vegetarian', 'gluten_free', 'nut_free', 'dairy_free'],
      cuisineType: 'Plant-Based',
      kidFriendly: true,
      allergenInfo: ['soy'],
    },
  },
  {
    id: 'food-sushi-express',
    name: 'Sushi Express',
    type: 'food_stall',
    zone: 'concourse-east',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: false,
    },
    queueEstimate: 10,
    attributes: {
      dietaryOptions: ['gluten_free', 'dairy_free'],
      cuisineType: 'Japanese',
      kidFriendly: false,
      allergenInfo: ['fish', 'soy', 'sesame'],
    },
  },
  {
    id: 'food-pizza-corner',
    name: 'Pizza Corner',
    type: 'food_stall',
    zone: 'concession-family',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 7,
    attributes: {
      dietaryOptions: ['vegetarian'],
      cuisineType: 'Italian',
      kidFriendly: true,
      allergenInfo: ['gluten', 'dairy'],
    },
  },
  {
    id: 'food-kosher-deli',
    name: 'Kosher Deli',
    type: 'food_stall',
    zone: 'concourse-south',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 4,
    attributes: {
      dietaryOptions: ['kosher', 'nut_free'],
      cuisineType: 'Deli',
      kidFriendly: true,
      allergenInfo: ['gluten', 'eggs'],
    },
  },
  {
    id: 'food-indian-spice',
    name: 'Indian Spice Kitchen',
    type: 'food_stall',
    zone: 'concourse-west',
    status: 'limited',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 9,
    attributes: {
      dietaryOptions: ['vegetarian', 'vegan', 'halal', 'gluten_free'],
      cuisineType: 'Indian',
      kidFriendly: true,
      allergenInfo: ['nuts', 'dairy'],
    },
  },
  {
    id: 'food-bbq-pit',
    name: 'Smoky BBQ Pit',
    type: 'food_stall',
    zone: 'concourse-north',
    status: 'open',
    accessibility: {
      wheelchairAccessible: false,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: false,
    },
    queueEstimate: 18,
    attributes: {
      dietaryOptions: ['gluten_free'],
      cuisineType: 'BBQ',
      kidFriendly: false,
      allergenInfo: ['soy', 'gluten'],
    },
  },
  {
    id: 'food-crepe-stand',
    name: 'French Crêpe Stand',
    type: 'food_stall',
    zone: 'concession-family',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 6,
    attributes: {
      dietaryOptions: ['vegetarian'],
      cuisineType: 'French',
      kidFriendly: true,
      allergenInfo: ['gluten', 'dairy', 'eggs'],
    },
  },
  {
    id: 'food-falafel-wrap',
    name: 'Falafel Wrap Bar',
    type: 'food_stall',
    zone: 'concourse-east',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: true,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 3,
    attributes: {
      dietaryOptions: ['vegan', 'vegetarian', 'halal', 'dairy_free'],
      cuisineType: 'Middle Eastern',
      kidFriendly: true,
      allergenInfo: ['sesame', 'gluten'],
    },
  },

  // ============================================================
  // RESTROOMS (10 total — distributed across zones)
  // ============================================================
  {
    id: 'restroom-standard-north-1',
    name: 'North Concourse Restroom',
    type: 'restroom_standard',
    zone: 'concourse-north',
    status: 'open',
    accessibility: {
      wheelchairAccessible: false,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: false,
    },
    queueEstimate: 5,
    attributes: {},
  },
  {
    id: 'restroom-standard-south-1',
    name: 'South Concourse Restroom',
    type: 'restroom_standard',
    zone: 'concourse-south',
    status: 'open',
    accessibility: {
      wheelchairAccessible: false,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: false,
    },
    queueEstimate: 3,
    attributes: {},
  },
  {
    id: 'restroom-standard-east-1',
    name: 'East Concourse Restroom',
    type: 'restroom_standard',
    zone: 'concourse-east',
    status: 'open',
    accessibility: {
      wheelchairAccessible: false,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: false,
    },
    queueEstimate: 7,
    attributes: {},
  },
  {
    id: 'restroom-standard-west-1',
    name: 'West Concourse Restroom',
    type: 'restroom_standard',
    zone: 'concourse-west',
    status: 'open',
    accessibility: {
      wheelchairAccessible: false,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: false,
    },
    queueEstimate: 4,
    attributes: {},
  },
  {
    id: 'restroom-accessible-north',
    name: 'Accessible Restroom North',
    type: 'restroom_accessible',
    zone: 'seating-accessible-north',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: true,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 2,
    attributes: {
      hasDiaperChanging: true,
    },
  },
  {
    id: 'restroom-accessible-south',
    name: 'Accessible Restroom South',
    type: 'restroom_accessible',
    zone: 'seating-accessible-south',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: true,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 1,
    attributes: {
      hasDiaperChanging: true,
    },
  },
  {
    id: 'restroom-family-north',
    name: 'Family Restroom North',
    type: 'restroom_family',
    zone: 'seating-family',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 4,
    attributes: {
      hasDiaperChanging: true,
      hasNursingArea: true,
    },
  },
  {
    id: 'restroom-family-south',
    name: 'Family Restroom South',
    type: 'restroom_family',
    zone: 'concession-family',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 3,
    attributes: {
      hasDiaperChanging: true,
      hasNursingArea: false,
    },
  },
  {
    id: 'restroom-gender-neutral-east',
    name: 'Gender-Neutral Restroom East',
    type: 'restroom_gender_neutral',
    zone: 'concourse-east',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 2,
    attributes: {
      hasDiaperChanging: true,
    },
  },
  {
    id: 'restroom-gender-neutral-west',
    name: 'Gender-Neutral Restroom West',
    type: 'restroom_gender_neutral',
    zone: 'concourse-west',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 3,
    attributes: {},
  },

  // ============================================================
  // MEDICAL — First Aid (2), Medical Center (1), AED Stations (4)
  // ============================================================
  {
    id: 'first-aid-north',
    name: 'North First Aid Station',
    type: 'first_aid',
    zone: 'concourse-north',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: true,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 0,
    attributes: {
      medicalCapability: 'basic',
      hasAED: true,
    },
  },
  {
    id: 'first-aid-south',
    name: 'South First Aid Station',
    type: 'first_aid',
    zone: 'concourse-south',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: true,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 0,
    attributes: {
      medicalCapability: 'basic',
      hasAED: true,
    },
  },
  {
    id: 'medical-center-main',
    name: 'Stadium Medical Center',
    type: 'medical_center',
    zone: 'medical-center',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: true,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 0,
    attributes: {
      medicalCapability: 'emergency',
      hasAED: true,
      seatingCapacity: 20,
    },
  },
  {
    id: 'aed-gate-north',
    name: 'AED Station - North Gate',
    type: 'AED_station',
    zone: 'gate-north',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: false,
    },
    queueEstimate: 0,
    attributes: {
      hasAED: true,
    },
  },
  {
    id: 'aed-gate-south',
    name: 'AED Station - South Gate',
    type: 'AED_station',
    zone: 'gate-south',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: false,
    },
    queueEstimate: 0,
    attributes: {
      hasAED: true,
    },
  },
  {
    id: 'aed-concourse-east',
    name: 'AED Station - East Concourse',
    type: 'AED_station',
    zone: 'concourse-east',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: false,
    },
    queueEstimate: 0,
    attributes: {
      hasAED: true,
    },
  },
  {
    id: 'aed-concourse-west',
    name: 'AED Station - West Concourse',
    type: 'AED_station',
    zone: 'concourse-west',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: false,
    },
    queueEstimate: 0,
    attributes: {
      hasAED: true,
    },
  },

  // ============================================================
  // NURSING ROOMS (2)
  // ============================================================
  {
    id: 'nursing-room-north',
    name: 'Nursing Room North',
    type: 'nursing_room',
    zone: 'seating-family',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 0,
    attributes: {
      hasNursingArea: true,
      seatingCapacity: 4,
      isShaded: true,
    },
  },
  {
    id: 'nursing-room-south',
    name: 'Nursing Room South',
    type: 'nursing_room',
    zone: 'concession-family',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 0,
    attributes: {
      hasNursingArea: true,
      seatingCapacity: 3,
      isShaded: true,
    },
  },

  // ============================================================
  // CHARGING STATIONS (3)
  // ============================================================
  {
    id: 'charging-north',
    name: 'Charging Station North',
    type: 'charging_station',
    zone: 'concourse-north',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 10,
    attributes: {
      hasCharging: true,
      seatingCapacity: 8,
    },
  },
  {
    id: 'charging-east',
    name: 'Charging Station East',
    type: 'charging_station',
    zone: 'concourse-east',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 5,
    attributes: {
      hasCharging: true,
      seatingCapacity: 6,
    },
  },
  {
    id: 'charging-south',
    name: 'Charging Station South',
    type: 'charging_station',
    zone: 'concourse-south',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 8,
    attributes: {
      hasCharging: true,
      seatingCapacity: 6,
    },
  },

  // ============================================================
  // PRAYER ROOM (1)
  // ============================================================
  {
    id: 'prayer-room-main',
    name: 'Multi-Faith Prayer Room',
    type: 'prayer_room',
    zone: 'prayer-area',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 0,
    attributes: {
      qiblaDirection: 56, // degrees from north (approximate for US East Coast)
      seatingCapacity: 30,
      isShaded: true,
    },
  },

  // ============================================================
  // COOLING ZONES (2)
  // ============================================================
  {
    id: 'cooling-zone-north',
    name: 'North Cooling Zone',
    type: 'cooling_zone',
    zone: 'concourse-north',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 0,
    attributes: {
      isShaded: true,
      seatingCapacity: 40,
      hasCharging: true,
    },
  },
  {
    id: 'cooling-zone-south',
    name: 'South Cooling Zone',
    type: 'cooling_zone',
    zone: 'concourse-south',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 0,
    attributes: {
      isShaded: true,
      seatingCapacity: 35,
      hasCharging: false,
    },
  },

  // ============================================================
  // WATER STATIONS (4 — distributed for hydration access)
  // ============================================================
  {
    id: 'water-station-north',
    name: 'Water Station North',
    type: 'water_station',
    zone: 'concourse-north',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 2,
    attributes: {},
  },
  {
    id: 'water-station-south',
    name: 'Water Station South',
    type: 'water_station',
    zone: 'concourse-south',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 1,
    attributes: {},
  },
  {
    id: 'water-station-east',
    name: 'Water Station East',
    type: 'water_station',
    zone: 'concourse-east',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 3,
    attributes: {},
  },
  {
    id: 'water-station-west',
    name: 'Water Station West',
    type: 'water_station',
    zone: 'concourse-west',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 2,
    attributes: {},
  },

  // ============================================================
  // REST AREAS (2)
  // ============================================================
  {
    id: 'rest-area-east',
    name: 'East Rest Area',
    type: 'rest_area',
    zone: 'concourse-east',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 0,
    attributes: {
      seatingCapacity: 20,
      isShaded: true,
    },
  },
  {
    id: 'rest-area-west',
    name: 'West Rest Area',
    type: 'rest_area',
    zone: 'concourse-west',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 0,
    attributes: {
      seatingCapacity: 15,
      isShaded: true,
    },
  },

  // ============================================================
  // LOST AND FOUND (1)
  // ============================================================
  {
    id: 'lost-and-found-main',
    name: 'Lost and Found Office',
    type: 'lost_and_found',
    zone: 'gate-north',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: true,
      hasBrailleSignage: true,
      familyFriendly: true,
    },
    queueEstimate: 5,
    attributes: {},
  },

  // ============================================================
  // SMOKING AREA (1)
  // ============================================================
  {
    id: 'smoking-area-west',
    name: 'Designated Smoking Area',
    type: 'smoking_area',
    zone: 'smoking-area-west',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: false,
    },
    queueEstimate: 0,
    attributes: {
      isShaded: false,
    },
  },
];
