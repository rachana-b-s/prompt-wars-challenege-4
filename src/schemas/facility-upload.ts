import { z } from 'zod';

// === Enum Schemas ===

export const FacilityTypeSchema = z.enum([
  'food_stall',
  'water_station',
  'restroom_standard',
  'restroom_accessible',
  'restroom_family',
  'restroom_gender_neutral',
  'first_aid',
  'medical_center',
  'AED_station',
  'nursing_room',
  'charging_station',
  'prayer_room',
  'cooling_zone',
  'smoking_area',
  'lost_and_found',
  'rest_area',
]);

export const DietaryFilterSchema = z.enum([
  'vegetarian',
  'vegan',
  'gluten_free',
  'halal',
  'kosher',
  'nut_free',
  'dairy_free',
]);

export const FacilityStatusSchema = z.enum(['open', 'closed', 'limited']);

export const MedicalCapabilitySchema = z.enum(['basic', 'advanced', 'emergency']);

// === Sub-object Schemas ===

export const FacilityAccessibilitySchema = z.object({
  wheelchairAccessible: z.boolean(),
  hasSignLanguageSupport: z.boolean().optional().default(false),
  hasBrailleSignage: z.boolean().optional().default(false),
  familyFriendly: z.boolean().optional().default(false),
});

export const FacilityAttributesSchema = z.object({
  // Food stall specific
  dietaryOptions: z.array(DietaryFilterSchema).optional(),
  cuisineType: z.string().optional(),
  kidFriendly: z.boolean().optional(),
  allergenInfo: z.array(z.string()).optional(),
  // Restroom specific
  hasDiaperChanging: z.boolean().optional(),
  hasNursingArea: z.boolean().optional(),
  // Medical specific
  medicalCapability: MedicalCapabilitySchema.optional(),
  hasAED: z.boolean().optional(),
  // Prayer room specific
  qiblaDirection: z.number().min(0).max(360).optional(),
  // General
  seatingCapacity: z.number().positive().optional(),
  isShaded: z.boolean().optional(),
  hasCharging: z.boolean().optional(),
});

// === Facility Upload Item Schema ===

export const FacilityUploadItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: FacilityTypeSchema,
  zone: z.string().min(1),
  status: FacilityStatusSchema.optional().default('open'),
  accessibility: FacilityAccessibilitySchema,
  queueEstimate: z.number().min(0).optional().default(0),
  attributes: FacilityAttributesSchema.optional().default({}),
});

// === Facility Upload Schema ===

/**
 * Schema for facility data uploads.
 *
 * Validates:
 * - Each facility has required fields (id, name, type, zone, accessibility)
 * - Facility types match the FacilityType enum
 * - At least 1 facility is provided
 */
export const FacilityUploadSchema = z.object({
  facilities: z
    .array(FacilityUploadItemSchema)
    .min(1, { message: 'Facility data must include at least 1 facility.' }),
});

/**
 * Schema for facility upload with referential integrity.
 * Accepts a list of known zone IDs to validate that all facility zone
 * references point to existing zones.
 */
export function createFacilityUploadSchemaWithZones(validZoneIds: Set<string>) {
  return FacilityUploadSchema.superRefine((data, ctx) => {
    for (let i = 0; i < data.facilities.length; i++) {
      const facility = data.facilities[i];
      if (!validZoneIds.has(facility.zone)) {
        ctx.addIssue({
          code: 'custom',
          message: `Facility "${facility.id}" references non-existent zone "${facility.zone}".`,
          path: ['facilities', i, 'zone'],
        });
      }
    }

    // Check for duplicate facility IDs
    const facilityIds = new Set<string>();
    for (let i = 0; i < data.facilities.length; i++) {
      const facility = data.facilities[i];
      if (facilityIds.has(facility.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate facility ID "${facility.id}" found.`,
          path: ['facilities', i, 'id'],
        });
      }
      facilityIds.add(facility.id);
    }
  });
}

export type FacilityUploadData = z.infer<typeof FacilityUploadSchema>;
