import { describe, it, expect } from 'vitest';
import { StadiumUploadSchema } from './stadium-upload';
import { CrowdUploadSchema, createCrowdUploadSchemaWithZones } from './crowd-upload';
import {
  FacilityUploadSchema,
  createFacilityUploadSchemaWithZones,
} from './facility-upload';

// === Test Helpers ===

function makeValidZone(overrides: Record<string, unknown> = {}) {
  return {
    id: 'zone-1',
    name: 'Gate A',
    type: 'gate',
    allegiance: 'home',
    capacity: 500,
    noiseLevel: 'medium',
    sensoryTriggers: [],
    isSunExposed: false,
    isIndoor: true,
    accessibilityFeatures: {
      stepFree: true,
      hasRamp: true,
      hasElevator: false,
      hasTactileIndicators: true,
      hasHandrails: true,
      hasRestArea: false,
      wideCorridors: true,
      maxGradient: 5,
      hasWallFollowingPath: false,
    },
    facilities: [],
    position: { x: 100, y: 200 },
    shape: { type: 'rect', data: '0,0,100,50' },
    ...overrides,
  };
}

function makeValidEdge(overrides: Record<string, unknown> = {}) {
  return {
    id: 'edge-1',
    source: 'zone-1',
    target: 'zone-2',
    distance: 50,
    bidirectional: true,
    type: 'corridor',
    accessibility: {
      stepFree: true,
      hasStairs: false,
      hasEscalator: false,
      hasRamp: true,
      hasElevator: false,
      width: 3,
      gradient: 2,
      hasTactileIndicators: true,
      hasHandrails: true,
      maxUninterruptedDistance: 100,
    },
    ...overrides,
  };
}

function makeMinimalValidStadium() {
  return {
    zones: [
      makeValidZone({ id: 'zone-1', type: 'family_section', allegiance: 'home' }),
      makeValidZone({ id: 'zone-2', type: 'accessible_seating', allegiance: 'away' }),
      makeValidZone({ id: 'zone-3', type: 'gate', allegiance: 'buffer' }),
    ],
    edges: [
      makeValidEdge({ id: 'edge-1', source: 'zone-1', target: 'zone-2' }),
      makeValidEdge({ id: 'edge-2', source: 'zone-2', target: 'zone-3' }),
    ],
  };
}

// === Stadium Upload Schema Tests ===

describe('StadiumUploadSchema', () => {
  it('accepts a valid stadium with all required zone types', () => {
    const data = makeMinimalValidStadium();
    const result = StadiumUploadSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects stadium with fewer than 2 zones', () => {
    const data = {
      zones: [makeValidZone({ id: 'zone-1', type: 'family_section' })],
      edges: [],
    };
    const result = StadiumUploadSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('at least 2'))).toBe(true);
    }
  });

  it('rejects stadium without a family_section zone', () => {
    const data = {
      zones: [
        makeValidZone({ id: 'zone-1', type: 'gate', allegiance: 'home' }),
        makeValidZone({ id: 'zone-2', type: 'accessible_seating', allegiance: 'away' }),
        makeValidZone({ id: 'zone-3', type: 'concourse', allegiance: 'buffer' }),
      ],
      edges: [makeValidEdge({ id: 'edge-1', source: 'zone-1', target: 'zone-2' })],
    };
    const result = StadiumUploadSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('family_section'))).toBe(true);
    }
  });

  it('rejects stadium without an accessible_seating zone', () => {
    const data = {
      zones: [
        makeValidZone({ id: 'zone-1', type: 'family_section', allegiance: 'home' }),
        makeValidZone({ id: 'zone-2', type: 'gate', allegiance: 'away' }),
        makeValidZone({ id: 'zone-3', type: 'concourse', allegiance: 'buffer' }),
      ],
      edges: [makeValidEdge({ id: 'edge-1', source: 'zone-1', target: 'zone-2' })],
    };
    const result = StadiumUploadSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('accessible_seating'))).toBe(true);
    }
  });

  it('rejects stadium with home and away zones but no buffer zone', () => {
    const data = {
      zones: [
        makeValidZone({ id: 'zone-1', type: 'family_section', allegiance: 'home' }),
        makeValidZone({ id: 'zone-2', type: 'accessible_seating', allegiance: 'away' }),
      ],
      edges: [makeValidEdge({ id: 'edge-1', source: 'zone-1', target: 'zone-2' })],
    };
    const result = StadiumUploadSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('buffer zone'))).toBe(true);
    }
  });

  it('rejects edges referencing non-existent source zone', () => {
    const data = {
      zones: [
        makeValidZone({ id: 'zone-1', type: 'family_section', allegiance: 'home' }),
        makeValidZone({ id: 'zone-2', type: 'accessible_seating', allegiance: 'away' }),
        makeValidZone({ id: 'zone-3', type: 'gate', allegiance: 'buffer' }),
      ],
      edges: [makeValidEdge({ id: 'edge-1', source: 'non-existent', target: 'zone-2' })],
    };
    const result = StadiumUploadSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('non-existent source zone'))).toBe(true);
    }
  });

  it('rejects edges referencing non-existent target zone', () => {
    const data = {
      zones: [
        makeValidZone({ id: 'zone-1', type: 'family_section', allegiance: 'home' }),
        makeValidZone({ id: 'zone-2', type: 'accessible_seating', allegiance: 'away' }),
        makeValidZone({ id: 'zone-3', type: 'gate', allegiance: 'buffer' }),
      ],
      edges: [makeValidEdge({ id: 'edge-1', source: 'zone-1', target: 'ghost-zone' })],
    };
    const result = StadiumUploadSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('non-existent target zone'))).toBe(true);
    }
  });

  it('rejects stadium with no valid connected zones', () => {
    const data = {
      zones: [
        makeValidZone({ id: 'zone-1', type: 'family_section', allegiance: 'home' }),
        makeValidZone({ id: 'zone-2', type: 'accessible_seating', allegiance: 'away' }),
        makeValidZone({ id: 'zone-3', type: 'gate', allegiance: 'buffer' }),
      ],
      edges: [
        makeValidEdge({ id: 'edge-1', source: 'bad-1', target: 'bad-2' }),
      ],
    };
    const result = StadiumUploadSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('at least 2 zones connected'))).toBe(true);
    }
  });

  it('rejects zone with invalid type', () => {
    const data = {
      zones: [
        makeValidZone({ id: 'zone-1', type: 'invalid_type' }),
        makeValidZone({ id: 'zone-2', type: 'gate' }),
      ],
      edges: [makeValidEdge({ id: 'edge-1', source: 'zone-1', target: 'zone-2' })],
    };
    const result = StadiumUploadSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects zone with missing required fields', () => {
    const data = {
      zones: [
        { id: 'zone-1', name: 'Missing Fields' },
        makeValidZone({ id: 'zone-2' }),
      ],
      edges: [makeValidEdge({ id: 'edge-1', source: 'zone-1', target: 'zone-2' })],
    };
    const result = StadiumUploadSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects negative capacity', () => {
    const data = makeMinimalValidStadium();
    data.zones[0] = makeValidZone({
      id: 'zone-1',
      type: 'family_section',
      allegiance: 'home',
      capacity: -100,
    });
    const result = StadiumUploadSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

// === Crowd Upload Schema Tests ===

describe('CrowdUploadSchema', () => {
  it('accepts valid crowd density data', () => {
    const data = {
      densities: [
        { zoneId: 'zone-1', density: 50 },
        { zoneId: 'zone-2', density: 75 },
      ],
    };
    const result = CrowdUploadSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects empty densities array', () => {
    const data = { densities: [] };
    const result = CrowdUploadSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects density above 100', () => {
    const data = {
      densities: [{ zoneId: 'zone-1', density: 150 }],
    };
    const result = CrowdUploadSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects density below 0', () => {
    const data = {
      densities: [{ zoneId: 'zone-1', density: -5 }],
    };
    const result = CrowdUploadSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('validates referential integrity with known zone IDs', () => {
    const validZones = new Set(['zone-1', 'zone-2']);
    const schema = createCrowdUploadSchemaWithZones(validZones);

    const validData = {
      densities: [{ zoneId: 'zone-1', density: 40 }],
    };
    expect(schema.safeParse(validData).success).toBe(true);

    const invalidData = {
      densities: [{ zoneId: 'non-existent-zone', density: 40 }],
    };
    const result = schema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('non-existent zone'))).toBe(true);
    }
  });
});

// === Facility Upload Schema Tests ===

describe('FacilityUploadSchema', () => {
  const validFacility = {
    id: 'facility-1',
    name: 'Food Court A',
    type: 'food_stall',
    zone: 'zone-1',
    status: 'open',
    accessibility: {
      wheelchairAccessible: true,
      hasSignLanguageSupport: false,
      hasBrailleSignage: false,
      familyFriendly: true,
    },
    queueEstimate: 5,
    attributes: {
      dietaryOptions: ['vegetarian', 'halal'],
      cuisineType: 'Mexican',
      kidFriendly: true,
    },
  };

  it('accepts valid facility data', () => {
    const data = { facilities: [validFacility] };
    const result = FacilityUploadSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects empty facilities array', () => {
    const data = { facilities: [] };
    const result = FacilityUploadSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects facility with invalid type', () => {
    const data = {
      facilities: [{ ...validFacility, type: 'invalid_type' }],
    };
    const result = FacilityUploadSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects facility with invalid dietary filter', () => {
    const data = {
      facilities: [
        {
          ...validFacility,
          attributes: { dietaryOptions: ['invalid_diet'] },
        },
      ],
    };
    const result = FacilityUploadSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('validates referential integrity with known zone IDs', () => {
    const validZones = new Set(['zone-1', 'zone-2']);
    const schema = createFacilityUploadSchemaWithZones(validZones);

    const validData = { facilities: [validFacility] };
    expect(schema.safeParse(validData).success).toBe(true);

    const invalidData = {
      facilities: [{ ...validFacility, zone: 'non-existent-zone' }],
    };
    const result = schema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages.some((m) => m.includes('non-existent zone'))).toBe(true);
    }
  });

  it('accepts all valid facility types', () => {
    const facilityTypes = [
      'food_stall', 'water_station', 'restroom_standard', 'restroom_accessible',
      'restroom_family', 'restroom_gender_neutral', 'first_aid', 'medical_center',
      'AED_station', 'nursing_room', 'charging_station', 'prayer_room',
      'cooling_zone', 'smoking_area', 'lost_and_found', 'rest_area',
    ];
    for (const type of facilityTypes) {
      const data = { facilities: [{ ...validFacility, id: `fac-${type}`, type }] };
      const result = FacilityUploadSchema.safeParse(data);
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid dietary filters', () => {
    const dietaryFilters = [
      'vegetarian', 'vegan', 'gluten_free', 'halal', 'kosher', 'nut_free', 'dairy_free',
    ];
    const data = {
      facilities: [
        {
          ...validFacility,
          attributes: { dietaryOptions: dietaryFilters },
        },
      ],
    };
    const result = FacilityUploadSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});
