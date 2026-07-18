/**
 * Property Test: Data Upload Validation Rejects Invalid Schema
 *
 * Property 20: Missing required fields or <2 connected zones always rejected
 * with descriptive error.
 *
 * **Validates: Requirements 7.3, 7.6, 12.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { NextRequest } from 'next/server';
import { POST } from './route';

// --- Helpers ---

function createJsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Generate a valid zone shape that passes schema validation */
const validZoneShape = fc.record({
  type: fc.constantFrom('polygon', 'rect', 'circle', 'path'),
  data: fc.string({ minLength: 1 }),
});

/** Generate valid accessibility features */
const validAccessibilityFeatures = fc.record({
  stepFree: fc.boolean(),
  hasRamp: fc.boolean(),
  hasElevator: fc.boolean(),
  hasTactileIndicators: fc.boolean(),
  hasHandrails: fc.boolean(),
  hasRestArea: fc.boolean(),
  wideCorridors: fc.boolean(),
  maxGradient: fc.nat({ max: 15 }),
  hasWallFollowingPath: fc.boolean(),
});

/** Generate a valid zone object */
function validZoneArb(id: string, type: string, allegiance: string) {
  return fc.record({
    id: fc.constant(id),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    type: fc.constant(type),
    allegiance: fc.constant(allegiance),
    capacity: fc.integer({ min: 1, max: 10000 }),
    noiseLevel: fc.constantFrom('low', 'medium', 'high'),
    sensoryTriggers: fc.constant([]),
    isSunExposed: fc.boolean(),
    isIndoor: fc.boolean(),
    accessibilityFeatures: validAccessibilityFeatures,
    facilities: fc.constant([]),
    position: fc.record({ x: fc.integer({ min: 0, max: 1000 }), y: fc.integer({ min: 0, max: 800 }) }),
    shape: validZoneShape,
  });
}

/** Generate a valid edge between two zones */
function validEdgeArb(id: string, source: string, target: string) {
  return fc.record({
    id: fc.constant(id),
    source: fc.constant(source),
    target: fc.constant(target),
    distance: fc.integer({ min: 1, max: 500 }),
    bidirectional: fc.constant(true),
    type: fc.constantFrom('corridor', 'ramp', 'stairs', 'elevator', 'escalator', 'outdoor_path'),
    accessibility: fc.record({
      stepFree: fc.boolean(),
      hasStairs: fc.boolean(),
      hasEscalator: fc.boolean(),
      hasRamp: fc.boolean(),
      hasElevator: fc.boolean(),
      width: fc.double({ min: 0.5, max: 10, noNaN: true }),
      gradient: fc.nat({ max: 15 }),
      hasTactileIndicators: fc.boolean(),
      hasHandrails: fc.boolean(),
      maxUninterruptedDistance: fc.integer({ min: 1, max: 500 }),
    }),
  });
}

// --- Property Tests ---

describe('Property 20: Data Upload Validation Rejects Invalid Schema', () => {
  it('rejects stadium uploads with fewer than 2 zones', async () => {
    await fc.assert(
      fc.asyncProperty(
        validZoneArb('zone-only', 'family_section', 'neutral'),
        async (zone) => {
          const data = {
            zones: [zone],
            edges: [],
          };
          const req = createJsonRequest({ type: 'stadium', data });
          const res = await POST(req);
          const json = await res.json();

          // Must be rejected
          expect(res.status).toBe(400);
          expect(json.success).toBe(false);
          // Must have descriptive error
          expect(json.errors.length).toBeGreaterThan(0);
          expect(json.errors.some((e: { message: string }) =>
            e.message.toLowerCase().includes('at least')
          )).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('rejects stadium uploads with missing required zone fields', async () => {
    const requiredFields = ['id', 'name', 'type', 'allegiance', 'capacity', 'noiseLevel', 'accessibilityFeatures', 'position', 'shape'];

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...requiredFields),
        async (fieldToRemove) => {
          // Create two valid zones and remove a required field from one
          const zone1 = {
            id: 'z1',
            name: 'Family Zone',
            type: 'family_section',
            allegiance: 'neutral',
            capacity: 500,
            noiseLevel: 'low',
            sensoryTriggers: [],
            isSunExposed: false,
            isIndoor: true,
            accessibilityFeatures: {
              stepFree: true, hasRamp: true, hasElevator: false,
              hasTactileIndicators: true, hasHandrails: true, hasRestArea: true,
              wideCorridors: true, maxGradient: 0, hasWallFollowingPath: false,
            },
            facilities: [],
            position: { x: 0, y: 0 },
            shape: { type: 'rect', data: '0,0,100,100' },
          };
          const zone2 = {
            ...zone1,
            id: 'z2',
            name: 'Accessible Zone',
            type: 'accessible_seating',
            allegiance: 'home',
            position: { x: 100, y: 0 },
          };

          // Remove the required field from zone2
          const brokenZone = { ...zone2 } as Record<string, unknown>;
          delete brokenZone[fieldToRemove];

          const data = {
            zones: [zone1, brokenZone],
            edges: [{
              id: 'e1', source: 'z1', target: 'z2', distance: 50, bidirectional: true,
              type: 'corridor',
              accessibility: {
                stepFree: true, hasStairs: false, hasEscalator: false,
                hasRamp: true, hasElevator: false, width: 3, gradient: 0,
                hasTactileIndicators: true, hasHandrails: true, maxUninterruptedDistance: 50,
              },
            }],
          };

          const req = createJsonRequest({ type: 'stadium', data });
          const res = await POST(req);
          const json = await res.json();

          // Must be rejected with descriptive error
          expect(res.status).toBe(400);
          expect(json.success).toBe(false);
          expect(json.errors.length).toBeGreaterThan(0);
          expect(json.errors[0].message).toBeDefined();
          expect(typeof json.errors[0].message).toBe('string');
          expect(json.errors[0].message.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 9 }
    );
  });

  it('rejects stadium uploads with fewer than 2 connected zones', async () => {
    await fc.assert(
      fc.asyncProperty(
        validZoneArb('z1', 'family_section', 'neutral'),
        validZoneArb('z2', 'accessible_seating', 'home'),
        validZoneArb('z3', 'seating_section', 'away'),
        fc.constantFrom('buffer', 'neutral'),
        async (zone1, zone2, zone3, bufferAllegiance) => {
          // Create zones with buffer but NO valid edges connecting them
          const bufferZone = {
            id: 'z-buffer',
            name: 'Buffer',
            type: 'concourse',
            allegiance: bufferAllegiance,
            capacity: 200,
            noiseLevel: 'low',
            sensoryTriggers: [],
            isSunExposed: false,
            isIndoor: true,
            accessibilityFeatures: {
              stepFree: true, hasRamp: true, hasElevator: false,
              hasTactileIndicators: false, hasHandrails: true, hasRestArea: false,
              wideCorridors: true, maxGradient: 0, hasWallFollowingPath: false,
            },
            facilities: [],
            position: { x: 150, y: 100 },
            shape: { type: 'rect', data: '150,100,50,50' },
          };

          const data = {
            zones: [zone1, zone2, zone3, bufferZone],
            edges: [
              // Edge references a non-existent zone → means <2 zones connected via valid edges
              {
                id: 'bad-edge',
                source: 'nonexistent-a',
                target: 'nonexistent-b',
                distance: 50,
                bidirectional: true,
                type: 'corridor',
                accessibility: {
                  stepFree: true, hasStairs: false, hasEscalator: false,
                  hasRamp: true, hasElevator: false, width: 3, gradient: 0,
                  hasTactileIndicators: true, hasHandrails: true, maxUninterruptedDistance: 50,
                },
              },
            ],
          };

          const req = createJsonRequest({ type: 'stadium', data });
          const res = await POST(req);
          const json = await res.json();

          // Must be rejected
          expect(res.status).toBe(400);
          expect(json.success).toBe(false);
          expect(json.errors.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 5 }
    );
  });

  it('rejects any upload type with completely empty data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('stadium', 'crowd', 'facility'),
        async (uploadType) => {
          // Test with empty object
          const req = createJsonRequest({ type: uploadType, data: {} });
          const res = await POST(req);
          const json = await res.json();

          expect(res.status).toBe(400);
          expect(json.success).toBe(false);
          expect(json.errors.length).toBeGreaterThan(0);
          // Errors should be descriptive
          for (const error of json.errors) {
            expect(typeof error.message).toBe('string');
            expect(error.message.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 3 }
    );
  });
});
