import { z } from 'zod';

// === Enum Schemas ===

export const ZoneTypeSchema = z.enum([
  'gate',
  'concourse',
  'seating_section',
  'concession_area',
  'restroom_cluster',
  'medical_area',
  'family_section',
  'accessible_seating',
  'service_corridor',
  'loading_dock',
  'smoking_area',
  'cooling_zone',
  'prayer_area',
]);

export const AllegianceSchema = z.enum(['home', 'away', 'neutral', 'buffer']);

export const NoiseLevelSchema = z.enum(['low', 'medium', 'high']);

export const SensoryTriggerSchema = z.enum([
  'fireworks',
  'dj_booth',
  'large_screen_flash',
  'pyrotechnics',
  'loud_music',
]);

export const EdgeTypeSchema = z.enum([
  'corridor',
  'ramp',
  'stairs',
  'elevator',
  'escalator',
  'outdoor_path',
]);

// === Sub-object Schemas ===

export const ZoneAccessibilitySchema = z.object({
  stepFree: z.boolean(),
  hasRamp: z.boolean(),
  hasElevator: z.boolean(),
  hasTactileIndicators: z.boolean(),
  hasHandrails: z.boolean(),
  hasRestArea: z.boolean(),
  wideCorridors: z.boolean(),
  maxGradient: z.number().min(0),
  hasWallFollowingPath: z.boolean(),
});

export const ZoneShapeSchema = z.object({
  type: z.enum(['polygon', 'rect', 'circle', 'path']),
  data: z.string(),
});

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const EdgeAccessibilitySchema = z.object({
  stepFree: z.boolean(),
  hasStairs: z.boolean(),
  hasEscalator: z.boolean(),
  hasRamp: z.boolean(),
  hasElevator: z.boolean(),
  width: z.number().positive(),
  gradient: z.number().min(0),
  hasTactileIndicators: z.boolean(),
  hasHandrails: z.boolean(),
  maxUninterruptedDistance: z.number().positive(),
});

// === Zone Schema ===

export const ZoneUploadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: ZoneTypeSchema,
  allegiance: AllegianceSchema,
  capacity: z.number().positive(),
  noiseLevel: NoiseLevelSchema,
  sensoryTriggers: z.array(SensoryTriggerSchema).optional().default([]),
  isSunExposed: z.boolean().optional().default(false),
  isIndoor: z.boolean().optional().default(true),
  accessibilityFeatures: ZoneAccessibilitySchema,
  facilities: z.array(z.string()).optional().default([]),
  position: PositionSchema,
  shape: ZoneShapeSchema,
});

// === Edge Schema ===

export const EdgeUploadSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  distance: z.number().positive(),
  bidirectional: z.boolean().optional().default(true),
  type: EdgeTypeSchema,
  accessibility: EdgeAccessibilitySchema,
});

// === Stadium Upload Schema (full) ===

const StadiumUploadBaseSchema = z.object({
  zones: z.array(ZoneUploadSchema).min(2, {
    message: 'Stadium must have at least 2 connected zones for routing to work.',
  }),
  edges: z.array(EdgeUploadSchema).min(1, {
    message: 'Stadium must have at least 1 edge connecting zones.',
  }),
  metadata: z
    .object({
      name: z.string().min(1),
      capacity: z.number().positive(),
    })
    .optional(),
});

/**
 * Full stadium upload schema with structural and referential integrity validations.
 *
 * Validates:
 * - At least 2 zones (minimum for routing)
 * - At least 1 FamilySection zone
 * - At least 1 AccessibleSeatingArea zone
 * - At least 1 BufferZone between home and away sections
 * - All edge source/target references point to existing zone IDs
 * - At least 2 zones are connected via edges
 */
export const StadiumUploadSchema = StadiumUploadBaseSchema.superRefine(
  (data, ctx) => {
    const zoneIds = new Set(data.zones.map((z) => z.id));

    // Check for duplicate zone IDs
    if (zoneIds.size !== data.zones.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Zone IDs must be unique. Duplicate zone IDs found.',
        path: ['zones'],
      });
    }

    // Structural constraint: at least 1 FamilySection
    const hasFamilySection = data.zones.some(
      (zone) => zone.type === 'family_section'
    );
    if (!hasFamilySection) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Stadium must include at least 1 zone of type "family_section".',
        path: ['zones'],
      });
    }

    // Structural constraint: at least 1 AccessibleSeatingArea
    const hasAccessibleSeating = data.zones.some(
      (zone) => zone.type === 'accessible_seating'
    );
    if (!hasAccessibleSeating) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Stadium must include at least 1 zone of type "accessible_seating".',
        path: ['zones'],
      });
    }

    // Structural constraint: at least 1 BufferZone between home and away
    const hasHomeZone = data.zones.some((zone) => zone.allegiance === 'home');
    const hasAwayZone = data.zones.some((zone) => zone.allegiance === 'away');
    const hasBufferZone = data.zones.some(
      (zone) => zone.allegiance === 'buffer'
    );

    if (hasHomeZone && hasAwayZone && !hasBufferZone) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Stadium must include at least 1 buffer zone between home and away sections.',
        path: ['zones'],
      });
    }

    // Edge referential integrity: source and target must reference existing zones
    for (let i = 0; i < data.edges.length; i++) {
      const edge = data.edges[i];
      if (!zoneIds.has(edge.source)) {
        ctx.addIssue({
          code: 'custom',
          message: `Edge "${edge.id}" references non-existent source zone "${edge.source}".`,
          path: ['edges', i, 'source'],
        });
      }
      if (!zoneIds.has(edge.target)) {
        ctx.addIssue({
          code: 'custom',
          message: `Edge "${edge.id}" references non-existent target zone "${edge.target}".`,
          path: ['edges', i, 'target'],
        });
      }
    }

    // Check that at least 2 zones are connected (at least one valid edge exists)
    const connectedZones = new Set<string>();
    for (const edge of data.edges) {
      if (zoneIds.has(edge.source) && zoneIds.has(edge.target)) {
        connectedZones.add(edge.source);
        connectedZones.add(edge.target);
      }
    }
    if (connectedZones.size < 2) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Stadium must have at least 2 zones connected by edges for routing to work.',
        path: ['edges'],
      });
    }
  }
);

export type StadiumUploadData = z.infer<typeof StadiumUploadBaseSchema>;
