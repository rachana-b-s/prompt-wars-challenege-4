import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

/**
 * Helper to create a JSON request body.
 */
function createJsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Minimal valid stadium data for testing.
 */
const validStadiumData = {
  zones: [
    {
      id: 'zone-1',
      name: 'Family Section A',
      type: 'family_section',
      allegiance: 'neutral',
      capacity: 500,
      noiseLevel: 'low',
      sensoryTriggers: [],
      isSunExposed: false,
      isIndoor: true,
      accessibilityFeatures: {
        stepFree: true,
        hasRamp: true,
        hasElevator: false,
        hasTactileIndicators: true,
        hasHandrails: true,
        hasRestArea: true,
        wideCorridors: true,
        maxGradient: 0,
        hasWallFollowingPath: false,
      },
      facilities: [],
      position: { x: 0, y: 0 },
      shape: { type: 'rect', data: '0,0,100,100' },
    },
    {
      id: 'zone-2',
      name: 'Accessible Seating B',
      type: 'accessible_seating',
      allegiance: 'home',
      capacity: 300,
      noiseLevel: 'medium',
      sensoryTriggers: [],
      isSunExposed: false,
      isIndoor: true,
      accessibilityFeatures: {
        stepFree: true,
        hasRamp: true,
        hasElevator: true,
        hasTactileIndicators: true,
        hasHandrails: true,
        hasRestArea: true,
        wideCorridors: true,
        maxGradient: 2,
        hasWallFollowingPath: true,
      },
      facilities: [],
      position: { x: 100, y: 0 },
      shape: { type: 'rect', data: '100,0,100,100' },
    },
    {
      id: 'zone-3',
      name: 'Away Section',
      type: 'seating_section',
      allegiance: 'away',
      capacity: 1000,
      noiseLevel: 'high',
      sensoryTriggers: [],
      isSunExposed: true,
      isIndoor: false,
      accessibilityFeatures: {
        stepFree: false,
        hasRamp: false,
        hasElevator: false,
        hasTactileIndicators: false,
        hasHandrails: false,
        hasRestArea: false,
        wideCorridors: false,
        maxGradient: 5,
        hasWallFollowingPath: false,
      },
      facilities: [],
      position: { x: 200, y: 0 },
      shape: { type: 'rect', data: '200,0,100,100' },
    },
    {
      id: 'zone-4',
      name: 'Buffer Zone',
      type: 'concourse',
      allegiance: 'buffer',
      capacity: 200,
      noiseLevel: 'low',
      sensoryTriggers: [],
      isSunExposed: false,
      isIndoor: true,
      accessibilityFeatures: {
        stepFree: true,
        hasRamp: true,
        hasElevator: false,
        hasTactileIndicators: false,
        hasHandrails: true,
        hasRestArea: false,
        wideCorridors: true,
        maxGradient: 0,
        hasWallFollowingPath: false,
      },
      facilities: [],
      position: { x: 150, y: 100 },
      shape: { type: 'rect', data: '150,100,100,100' },
    },
  ],
  edges: [
    {
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
        gradient: 0,
        hasTactileIndicators: true,
        hasHandrails: true,
        maxUninterruptedDistance: 50,
      },
    },
    {
      id: 'edge-2',
      source: 'zone-2',
      target: 'zone-4',
      distance: 80,
      bidirectional: true,
      type: 'corridor',
      accessibility: {
        stepFree: true,
        hasStairs: false,
        hasEscalator: false,
        hasRamp: false,
        hasElevator: false,
        width: 2.5,
        gradient: 1,
        hasTactileIndicators: false,
        hasHandrails: true,
        maxUninterruptedDistance: 80,
      },
    },
  ],
};

const validCrowdData = {
  densities: [
    { zoneId: 'zone-1', density: 30 },
    { zoneId: 'zone-2', density: 65 },
  ],
};

const validFacilityData = {
  facilities: [
    {
      id: 'facility-1',
      name: 'Food Court A',
      type: 'food_stall',
      zone: 'zone-1',
      status: 'open',
      accessibility: { wheelchairAccessible: true },
      queueEstimate: 5,
      attributes: { dietaryOptions: ['vegetarian', 'halal'] },
    },
  ],
};

describe('POST /api/upload', () => {
  describe('Content-Type handling', () => {
    it('returns 415 for unsupported content type', async () => {
      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'hello',
      });
      const res = await POST(req);
      expect(res.status).toBe(415);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.errors[0].message).toContain('Unsupported content type');
    });

    it('returns 400 for invalid JSON body', async () => {
      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('JSON body validation', () => {
    it('returns 400 when type field is missing', async () => {
      const req = createJsonRequest({ data: validStadiumData });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.errors[0].path).toBe('type');
    });

    it('returns 400 when type is invalid', async () => {
      const req = createJsonRequest({ type: 'invalid', data: {} });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.errors[0].message).toContain('invalid');
    });

    it('returns 400 when data field is missing', async () => {
      const req = createJsonRequest({ type: 'stadium' });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.errors[0].path).toBe('data');
    });
  });

  describe('Stadium upload validation', () => {
    it('accepts valid stadium data', async () => {
      const req = createJsonRequest({ type: 'stadium', data: validStadiumData });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('Stadium data uploaded successfully');
      expect(json.recordCount).toBe(4);
    });

    it('rejects stadium data with fewer than 2 zones', async () => {
      const data = { ...validStadiumData, zones: [validStadiumData.zones[0]] };
      const req = createJsonRequest({ type: 'stadium', data });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.errors.some((e: { message: string }) => e.message.includes('at least 2'))).toBe(true);
    });

    it('rejects stadium data with no edges', async () => {
      const data = { ...validStadiumData, edges: [] };
      const req = createJsonRequest({ type: 'stadium', data });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('rejects stadium data missing family_section zone', async () => {
      const zonesWithoutFamily = validStadiumData.zones.map((z) =>
        z.type === 'family_section' ? { ...z, type: 'concourse' } : z
      );
      const data = { ...validStadiumData, zones: zonesWithoutFamily };
      const req = createJsonRequest({ type: 'stadium', data });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.errors.some((e: { message: string }) => e.message.includes('family_section'))).toBe(true);
    });

    it('rejects stadium data missing accessible_seating zone', async () => {
      const zonesWithoutAccessible = validStadiumData.zones.map((z) =>
        z.type === 'accessible_seating' ? { ...z, type: 'concourse' } : z
      );
      const data = { ...validStadiumData, zones: zonesWithoutAccessible };
      const req = createJsonRequest({ type: 'stadium', data });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.errors.some((e: { message: string }) => e.message.includes('accessible_seating'))).toBe(true);
    });

    it('rejects stadium data with edge referencing non-existent zone', async () => {
      const data = {
        ...validStadiumData,
        edges: [
          {
            ...validStadiumData.edges[0],
            source: 'nonexistent-zone',
          },
        ],
      };
      const req = createJsonRequest({ type: 'stadium', data });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.errors.some((e: { message: string }) => e.message.includes('nonexistent-zone'))).toBe(true);
    });

    it('returns descriptive errors for invalid zone type', async () => {
      const data = {
        ...validStadiumData,
        zones: [
          { ...validStadiumData.zones[0], type: 'invalid_type' },
          ...validStadiumData.zones.slice(1),
        ],
      };
      const req = createJsonRequest({ type: 'stadium', data });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.errors.length).toBeGreaterThan(0);
      expect(json.errors[0].path).toBeDefined();
      expect(json.errors[0].message).toBeDefined();
    });
  });

  describe('Crowd upload validation', () => {
    it('accepts valid crowd data', async () => {
      const req = createJsonRequest({ type: 'crowd', data: validCrowdData });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('Crowd density data uploaded successfully');
      expect(json.recordCount).toBe(2);
    });

    it('rejects crowd data with empty densities array', async () => {
      const req = createJsonRequest({ type: 'crowd', data: { densities: [] } });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.errors.some((e: { message: string }) => e.message.includes('at least 1'))).toBe(true);
    });

    it('rejects crowd data with density out of range', async () => {
      const req = createJsonRequest({
        type: 'crowd',
        data: { densities: [{ zoneId: 'zone-1', density: 150 }] },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('Facility upload validation', () => {
    it('accepts valid facility data', async () => {
      const req = createJsonRequest({ type: 'facility', data: validFacilityData });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('Facility data uploaded successfully');
      expect(json.recordCount).toBe(1);
    });

    it('rejects facility data with empty facilities array', async () => {
      const req = createJsonRequest({ type: 'facility', data: { facilities: [] } });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('rejects facility data with invalid facility type', async () => {
      const req = createJsonRequest({
        type: 'facility',
        data: {
          facilities: [
            {
              ...validFacilityData.facilities[0],
              type: 'invalid_type',
            },
          ],
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('Error response format', () => {
    it('returns errors with path and message fields', async () => {
      const req = createJsonRequest({ type: 'stadium', data: { zones: [], edges: [] } });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(Array.isArray(json.errors)).toBe(true);
      for (const error of json.errors) {
        expect(error).toHaveProperty('path');
        expect(error).toHaveProperty('message');
        expect(typeof error.message).toBe('string');
      }
    });
  });
});
