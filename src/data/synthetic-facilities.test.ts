import { describe, it, expect } from 'vitest';
import { syntheticFacilities } from './synthetic-facilities';
import { Facility, FacilityType } from '../types/facility';

function countByType(type: FacilityType): number {
  return syntheticFacilities.filter((f) => f.type === type).length;
}

describe('synthetic-facilities', () => {
  it('exports a non-empty array of Facility objects', () => {
    expect(Array.isArray(syntheticFacilities)).toBe(true);
    expect(syntheticFacilities.length).toBeGreaterThan(0);
  });

  it('has at least 10 food stalls', () => {
    expect(countByType('food_stall')).toBeGreaterThanOrEqual(10);
  });

  it('has at least 8 restrooms across types', () => {
    const restrooms =
      countByType('restroom_standard') +
      countByType('restroom_accessible') +
      countByType('restroom_family') +
      countByType('restroom_gender_neutral');
    expect(restrooms).toBeGreaterThanOrEqual(8);
  });

  it('has restroom type variety (standard, accessible, family, gender-neutral)', () => {
    expect(countByType('restroom_standard')).toBeGreaterThanOrEqual(1);
    expect(countByType('restroom_accessible')).toBeGreaterThanOrEqual(1);
    expect(countByType('restroom_family')).toBeGreaterThanOrEqual(1);
    expect(countByType('restroom_gender_neutral')).toBeGreaterThanOrEqual(1);
  });

  it('has at least 2 first aid stations', () => {
    expect(countByType('first_aid')).toBeGreaterThanOrEqual(2);
  });

  it('has at least 1 medical center', () => {
    expect(countByType('medical_center')).toBeGreaterThanOrEqual(1);
  });

  it('has at least 4 AED stations', () => {
    expect(countByType('AED_station')).toBeGreaterThanOrEqual(4);
  });

  it('has at least 2 nursing rooms', () => {
    expect(countByType('nursing_room')).toBeGreaterThanOrEqual(2);
  });

  it('has at least 3 charging stations', () => {
    expect(countByType('charging_station')).toBeGreaterThanOrEqual(3);
  });

  it('has at least 1 prayer room', () => {
    expect(countByType('prayer_room')).toBeGreaterThanOrEqual(1);
  });

  it('has at least 2 cooling zones', () => {
    expect(countByType('cooling_zone')).toBeGreaterThanOrEqual(2);
  });

  it('all facilities have valid status', () => {
    for (const f of syntheticFacilities) {
      expect(['open', 'closed', 'limited']).toContain(f.status);
    }
  });

  it('all facilities have non-negative queue estimates', () => {
    for (const f of syntheticFacilities) {
      expect(f.queueEstimate).toBeGreaterThanOrEqual(0);
    }
  });

  it('all facilities have unique IDs', () => {
    const ids = syntheticFacilities.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('food stalls have varied dietary options', () => {
    const foodStalls = syntheticFacilities.filter((f) => f.type === 'food_stall');
    const allDietary = new Set<string>();
    for (const stall of foodStalls) {
      for (const d of stall.attributes.dietaryOptions ?? []) {
        allDietary.add(d);
      }
    }
    // Should have at least 5 different dietary options represented
    expect(allDietary.size).toBeGreaterThanOrEqual(5);
  });

  it('food stalls have varied cuisine types', () => {
    const foodStalls = syntheticFacilities.filter((f) => f.type === 'food_stall');
    const cuisines = new Set(
      foodStalls.map((f) => f.attributes.cuisineType).filter(Boolean)
    );
    // Should have at least 5 different cuisines
    expect(cuisines.size).toBeGreaterThanOrEqual(5);
  });

  it('AED stations are distributed across different zones', () => {
    const aedZones = syntheticFacilities
      .filter((f) => f.type === 'AED_station')
      .map((f) => f.zone);
    const uniqueZones = new Set(aedZones);
    expect(uniqueZones.size).toBeGreaterThanOrEqual(4);
  });

  it('all facilities have accessibility information', () => {
    for (const f of syntheticFacilities) {
      expect(f.accessibility).toBeDefined();
      expect(typeof f.accessibility.wheelchairAccessible).toBe('boolean');
      expect(typeof f.accessibility.hasSignLanguageSupport).toBe('boolean');
      expect(typeof f.accessibility.hasBrailleSignage).toBe('boolean');
      expect(typeof f.accessibility.familyFriendly).toBe('boolean');
    }
  });
});
