import { z } from 'zod';

// === Density Update Schema ===

export const DensityUpdateSchema = z.object({
  zoneId: z.string().min(1),
  density: z.number().min(0).max(100),
  timestamp: z.number().positive().optional(),
});

// === Crowd Upload Schema ===

/**
 * Schema for crowd density data uploads.
 *
 * Validates:
 * - Each entry has a valid zone ID reference
 * - Density values are between 0 and 100
 * - At least 1 density entry is provided
 */
export const CrowdUploadSchema = z.object({
  densities: z
    .array(DensityUpdateSchema)
    .min(1, { message: 'Crowd data must include at least 1 density entry.' }),
});

/**
 * Schema for crowd density upload with referential integrity.
 * Accepts a list of known zone IDs to validate against.
 */
export function createCrowdUploadSchemaWithZones(validZoneIds: Set<string>) {
  return CrowdUploadSchema.superRefine((data, ctx) => {
    for (let i = 0; i < data.densities.length; i++) {
      const entry = data.densities[i];
      if (!validZoneIds.has(entry.zoneId)) {
        ctx.addIssue({
          code: 'custom',
          message: `Density entry references non-existent zone "${entry.zoneId}".`,
          path: ['densities', i, 'zoneId'],
        });
      }
    }
  });
}

export type CrowdUploadData = z.infer<typeof CrowdUploadSchema>;
