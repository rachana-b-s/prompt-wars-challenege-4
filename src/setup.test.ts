import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Project Setup', () => {
  it('should have vitest configured correctly', () => {
    expect(true).toBe(true);
  });

  it('should have fast-check available for property-based testing', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return typeof n === 'number';
      })
    );
  });
});
