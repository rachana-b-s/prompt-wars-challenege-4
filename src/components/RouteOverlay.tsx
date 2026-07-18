'use client';

/**
 * SVG overlay that renders directional arrows along a computed route path.
 * Placed within the StadiumMap SVG transform group to render arrows between zone centers.
 *
 * Requirements: 9.2
 */

import type { Zone } from '@/types/stadium';

export interface RouteOverlayProps {
  /** Ordered list of zone IDs representing the route path */
  path: string[];
  /** All zones in the stadium graph (used to look up positions) */
  zones: Zone[];
}

/**
 * Computes an arrowhead marker definition SVG element.
 * We define the marker once and reference it on path elements.
 */
function ArrowMarkerDef() {
  return (
    <defs>
      <marker
        id="route-arrow"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb" />
      </marker>
    </defs>
  );
}

/**
 * Renders a directional segment between two zone positions.
 */
function RouteSegmentArrow({
  from,
  to,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
}) {
  // Shorten the line slightly so the arrow doesn't overlap the zone center
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return null;

  const shortenBy = 14; // pixels to shorten each end
  const ratio = shortenBy / length;

  const startX = from.x + dx * ratio;
  const startY = from.y + dy * ratio;
  const endX = to.x - dx * ratio;
  const endY = to.y - dy * ratio;

  return (
    <line
      x1={startX}
      y1={startY}
      x2={endX}
      y2={endY}
      stroke="#2563eb"
      strokeWidth={3}
      strokeLinecap="round"
      markerEnd="url(#route-arrow)"
      opacity={0.85}
      pointerEvents="none"
    />
  );
}

/**
 * Renders directional arrows along the route path between zone centers.
 * Should be placed inside the StadiumMap SVG transform group.
 */
export function RouteOverlay({ path, zones }: RouteOverlayProps) {
  if (path.length < 2) return null;

  // Build a lookup for zone positions
  const positionMap = new Map<string, { x: number; y: number }>();
  for (const zone of zones) {
    positionMap.set(zone.id, zone.position);
  }

  // Build segments
  const segments: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const fromPos = positionMap.get(path[i]);
    const toPos = positionMap.get(path[i + 1]);
    if (fromPos && toPos) {
      segments.push({ from: fromPos, to: toPos });
    }
  }

  if (segments.length === 0) return null;

  return (
    <g aria-label="Route path with directional arrows" pointerEvents="none">
      <ArrowMarkerDef />
      {segments.map((seg, idx) => (
        <RouteSegmentArrow key={idx} from={seg.from} to={seg.to} />
      ))}
    </g>
  );
}
