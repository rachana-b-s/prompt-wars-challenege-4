/**
 * Property test for StadiumMap component.
 * Property 21: Map Renders All Graph Zones — SVG element count equals zone count in StadiumGraph.
 *
 * **Validates: Requirements 9.1, 9.6**
 */

import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { StadiumMap } from './StadiumMap';
import { useStadiumStore } from '@/stores/stadium-store';
import { syntheticStadium } from '@/data/synthetic-stadium';

describe('Property 21: Map Renders All Graph Zones', () => {
  beforeEach(() => {
    // Ensure the stadium store has the synthetic stadium loaded
    useStadiumStore.setState({ graph: syntheticStadium });
  });

  it('renders exactly one SVG element per zone in the StadiumGraph', () => {
    const { container } = render(<StadiumMap />);

    // Query all elements with data-zone-id attribute
    const zoneElements = container.querySelectorAll('[data-zone-id]');

    // Assert count equals syntheticStadium.zones.length
    expect(zoneElements.length).toBe(syntheticStadium.zones.length);
  });

  it('renders a corresponding element for each zone in the graph', () => {
    const { container } = render(<StadiumMap />);

    // Verify each zone from syntheticStadium has a corresponding element
    for (const zone of syntheticStadium.zones) {
      const element = container.querySelector(`[data-zone-id="${zone.id}"]`);
      expect(element).not.toBeNull();
    }
  });

  it('does not render duplicate zone elements', () => {
    const { container } = render(<StadiumMap />);

    const zoneElements = container.querySelectorAll('[data-zone-id]');
    const zoneIds = Array.from(zoneElements).map((el) =>
      el.getAttribute('data-zone-id')
    );

    // All IDs should be unique
    const uniqueIds = new Set(zoneIds);
    expect(uniqueIds.size).toBe(zoneIds.length);
  });

  it('renders no zone elements when graph is null', () => {
    useStadiumStore.setState({ graph: null });

    const { container } = render(<StadiumMap />);

    const zoneElements = container.querySelectorAll('[data-zone-id]');
    expect(zoneElements.length).toBe(0);
  });
});
