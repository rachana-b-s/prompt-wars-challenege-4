'use client';

/**
 * Interactive SVG stadium map component.
 * Renders zones dynamically from StadiumGraph data, color-coded by allegiance and density.
 * Supports pinch-to-zoom, scroll-to-zoom, and pan/drag gestures.
 * Displays fan's current location marker.
 *
 * Requirements: 9.1, 9.2, 9.4, 9.5, 9.6, 9.7
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { useStadiumStore } from '@/stores/stadium-store';
import { useCrowdStore } from '@/stores/crowd-store';
import { useFanStore } from '@/stores/fan-store';
import { RouteOverlay } from '@/components/RouteOverlay';
import type { Zone } from '@/types/stadium';
import type { DensityLevel } from '@/types/crowd';

export interface StadiumMapProps {
  onZoneClick?: (zoneId: string) => void;
  highlightedPath?: string[];
}

/** Color scheme for zone allegiance designation */
const ALLEGIANCE_COLORS: Record<string, string> = {
  home: '#3b82f6',    // blue
  away: '#ef4444',    // red
  neutral: '#6b7280', // gray
  buffer: '#f59e0b',  // amber
};

/** Additional colors for special zone types */
const ZONE_TYPE_COLORS: Record<string, string> = {
  family_section: '#a855f7',     // purple
  accessible_seating: '#14b8a6', // teal
};

/** Density overlay colors */
const DENSITY_OVERLAY_COLORS: Record<DensityLevel, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
};

/** Minimum/maximum zoom scale */
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_SENSITIVITY = 0.001;

interface ViewTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

interface PointerState {
  pointerId: number;
  x: number;
  y: number;
}

/**
 * Renders an individual zone SVG element based on its shape type.
 */
function renderZoneShape(zone: Zone): React.ReactNode {
  const { type, data } = zone.shape;

  switch (type) {
    case 'polygon':
      return <polygon points={data} />;
    case 'rect': {
      const parts = data.split(',');
      if (parts.length !== 4) return null;
      const [x, y, width, height] = parts.map(Number);
      return <rect x={x} y={y} width={width} height={height} rx="4" ry="4" />;
    }
    case 'circle': {
      const parts = data.split(',');
      if (parts.length !== 3) return null;
      const [cx, cy, r] = parts.map(Number);
      return <circle cx={cx} cy={cy} r={r} />;
    }
    case 'path':
      return <path d={data} />;
    default:
      return null;
  }
}

/**
 * Gets the fill color for a zone based on its allegiance and type.
 */
function getZoneBaseColor(zone: Zone): string {
  // Special zone types take priority for color-coding
  if (zone.type === 'family_section') return ZONE_TYPE_COLORS.family_section;
  if (zone.type === 'accessible_seating') return ZONE_TYPE_COLORS.accessible_seating;
  return ALLEGIANCE_COLORS[zone.allegiance] ?? ALLEGIANCE_COLORS.neutral;
}

/** Minimum pointer movement (px) before a gesture is treated as a drag/pan */
const DRAG_THRESHOLD = 5;

export function StadiumMap({ onZoneClick, highlightedPath = [] }: StadiumMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState<ViewTransform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });
  const [isPanning, setIsPanning] = useState(false);
  const pointersRef = useRef<PointerState[]>([]);
  const lastPinchDistRef = useRef<number | null>(null);
  const [focusedZoneIndex, setFocusedZoneIndex] = useState<number>(-1);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);

  const graph = useStadiumStore((state) => state.graph);
  const densityMap = useCrowdStore((state) => state.densityMap);
  const currentZone = useFanStore((state) => state.profile.currentZone);

  const zones = graph?.zones ?? [];
  const highlightedSet = new Set(highlightedPath);

  // --- Zoom via scroll wheel ---
  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    setTransform((prev) => {
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale + delta * prev.scale));
      // Zoom toward the cursor position
      const svg = svgRef.current;
      if (!svg) return { ...prev, scale: newScale };
      const rect = svg.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const scaleRatio = newScale / prev.scale;
      const newTranslateX = cursorX - scaleRatio * (cursorX - prev.translateX);
      const newTranslateY = cursorY - scaleRatio * (cursorY - prev.translateY);
      const maxTx = (newScale - 1) * 490;
      const maxTy = (newScale - 1) * 380;
      return {
        scale: newScale,
        translateX: Math.max(-maxTx, Math.min(maxTx, newTranslateX)),
        translateY: Math.max(-maxTy, Math.min(maxTy, newTranslateY)),
      };
    });
  }, []);

  // --- Pan/drag via pointer events ---
  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // Only initiate pan on primary button or touch
    if (e.button !== 0) return;
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
    pointersRef.current = [
      ...pointersRef.current.filter((p) => p.pointerId !== e.pointerId),
      { pointerId: e.pointerId, x: e.clientX, y: e.clientY },
    ];
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const pointers = pointersRef.current;
    const idx = pointers.findIndex((p) => p.pointerId === e.pointerId);
    if (idx === -1) return;

    const prevPointer = pointers[idx];

    // Check if movement exceeds drag threshold before starting pan
    if (!isDraggingRef.current && pointerDownPosRef.current) {
      const distFromStart = Math.hypot(
        e.clientX - pointerDownPosRef.current.x,
        e.clientY - pointerDownPosRef.current.y
      );
      if (distFromStart < DRAG_THRESHOLD) {
        return; // Not yet a drag — don't pan
      }
      // Threshold exceeded — start dragging
      isDraggingRef.current = true;
      setIsPanning(true);
      const svg = svgRef.current;
      if (svg) {
        svg.setPointerCapture(e.pointerId);
      }
    }

    if (pointers.length === 1) {
      const dx = e.clientX - prevPointer.x;
      const dy = e.clientY - prevPointer.y;
      setTransform((prev) => {
        const newTranslateX = prev.translateX + dx;
        const newTranslateY = prev.translateY + dy;
        // Clamp translation so map can't be dragged off-screen
        const maxTranslate = (prev.scale - 1) * 490; // half of viewBox width scaled
        const maxTranslateY = (prev.scale - 1) * 380;
        return {
          ...prev,
          translateX: Math.max(-maxTranslate, Math.min(maxTranslate, newTranslateX)),
          translateY: Math.max(-maxTranslateY, Math.min(maxTranslateY, newTranslateY)),
        };
      });
    } else if (pointers.length === 2) {
      // Two pointers: pinch-to-zoom
      const otherIdx = idx === 0 ? 1 : 0;
      const other = pointers[otherIdx];
      const newDist = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (lastPinchDistRef.current !== null) {
        const pinchDelta = newDist / lastPinchDistRef.current;
        setTransform((prev) => {
          const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * pinchDelta));
          const midX = (e.clientX + other.x) / 2;
          const midY = (e.clientY + other.y) / 2;
          const svg = svgRef.current;
          if (!svg) return { ...prev, scale: newScale };
          const rect = svg.getBoundingClientRect();
          const px = midX - rect.left;
          const py = midY - rect.top;
          const scaleRatio = newScale / prev.scale;
          return {
            scale: newScale,
            translateX: px - scaleRatio * (px - prev.translateX),
            translateY: py - scaleRatio * (py - prev.translateY),
          };
        });
      }
      lastPinchDistRef.current = newDist;
    }

    // Update stored pointer position
    pointersRef.current = pointers.map((p, i) =>
      i === idx ? { ...p, x: e.clientX, y: e.clientY } : p
    );
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    pointersRef.current = pointersRef.current.filter((p) => p.pointerId !== e.pointerId);
    if (pointersRef.current.length < 2) {
      lastPinchDistRef.current = null;
    }
    if (pointersRef.current.length === 0) {
      setIsPanning(false);
      pointerDownPosRef.current = null;
    }
  }, []);

  // --- Zone click handler ---
  const handleZoneClick = useCallback(
    (zoneId: string) => {
      // Suppress click if the pointer was dragged (pan gesture)
      if (isDraggingRef.current) return;
      if (onZoneClick) {
        onZoneClick(zoneId);
      }
    },
    [onZoneClick]
  );

  // --- Keyboard navigation for accessibility ---
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (zones.length === 0) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedZoneIndex((prev) => (prev + 1) % zones.length);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedZoneIndex((prev) => (prev - 1 + zones.length) % zones.length);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (focusedZoneIndex >= 0 && focusedZoneIndex < zones.length) {
          handleZoneClick(zones[focusedZoneIndex].id);
        }
      }
    },
    [zones, focusedZoneIndex, handleZoneClick]
  );

  // Focus the SVG element zone when focusedZoneIndex changes
  useEffect(() => {
    if (focusedZoneIndex >= 0 && svgRef.current) {
      const zoneEl = svgRef.current.querySelector(
        `[data-zone-index="${focusedZoneIndex}"]`
      ) as SVGElement | null;
      if (zoneEl) {
        zoneEl.focus();
      }
    }
  }, [focusedZoneIndex]);

  // --- Get density info for a zone ---
  const getDensityOverlay = (zoneId: string): { color: string; opacity: number } | null => {
    const entry = densityMap[zoneId];
    if (!entry) return null;
    const color = DENSITY_OVERLAY_COLORS[entry.level];
    // Scale opacity: 0.2 for green, 0.35 for yellow, 0.5 for red
    const opacity = entry.level === 'green' ? 0.2 : entry.level === 'yellow' ? 0.35 : 0.5;
    return { color, opacity };
  };

  // --- Get fan location zone position ---
  const fanZone = currentZone ? zones.find((z) => z.id === currentZone) : undefined;

  // --- Zoom control handlers ---
  const zoomIn = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.min(MAX_SCALE, prev.scale + 0.5),
    }));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(MIN_SCALE, prev.scale - 0.5),
    }));
  }, []);

  const resetView = useCallback(() => {
    setTransform({ scale: 1, translateX: 0, translateY: 0 });
  }, []);

  if (!graph) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500" role="status">
        <p>Loading stadium map...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Zoom controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-1 z-10">
        <button
          onClick={zoomIn}
          aria-label="Zoom in"
          className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-300 dark:border-gray-600 text-lg font-bold flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-2 focus:outline-blue-600 focus:outline-offset-2"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          aria-label="Zoom out"
          className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-300 dark:border-gray-600 text-lg font-bold flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-2 focus:outline-blue-600 focus:outline-offset-2"
        >
          −
        </button>
        <button
          onClick={resetView}
          aria-label="Reset view"
          className="w-10 h-10 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-300 dark:border-gray-600 text-sm font-bold flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-2 focus:outline-blue-600 focus:outline-offset-2"
        >
          ⟲
        </button>
      </div>

      {/* Map legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-2.5 z-10 text-[10px]">
        <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Legend</p>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#3b82f6] inline-block" />
            <span className="text-gray-600 dark:text-gray-400">Home</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#ef4444] inline-block" />
            <span className="text-gray-600 dark:text-gray-400">Away</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#6b7280] inline-block" />
            <span className="text-gray-600 dark:text-gray-400">Neutral</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#f59e0b] inline-block" />
            <span className="text-gray-600 dark:text-gray-400">Buffer</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#a855f7] inline-block" />
            <span className="text-gray-600 dark:text-gray-400">Family</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#14b8a6] inline-block" />
            <span className="text-gray-600 dark:text-gray-400">Accessible</span>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1.5" />
          <p className="font-medium text-gray-600 dark:text-gray-400">Density</p>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#22c55e] inline-block" />
            <span className="text-gray-600 dark:text-gray-400">Low (0-40%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#eab308] inline-block" />
            <span className="text-gray-600 dark:text-gray-400">Moderate (41-70%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#ef4444] inline-block" />
            <span className="text-gray-600 dark:text-gray-400">High (71-100%)</span>
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox="10 20 980 760"
        role="img"
        aria-label={`Interactive stadium map of ${graph.metadata.name} with ${zones.length} zones`}
        className="w-full h-full select-none"
        style={{ touchAction: 'none', cursor: isPanning ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
      <title>{`Stadium Map: ${graph.metadata.name}`}</title>
      <desc>
        Interactive map showing {zones.length} zones with crowd density overlay.
        Use arrow keys to navigate between zones, Enter or Space to select.
      </desc>

      {/* SVG defs: grid pattern + glow filter */}
      <defs>
        <pattern id="grid-pattern" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3" />
        </pattern>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Dark background with subtle grid */}
      <rect x="10" y="20" width="980" height="760" fill="#1f2937" rx="8" />
      <rect x="10" y="20" width="980" height="760" fill="url(#grid-pattern)" rx="8" />

      {/* Map label */}
      <text x="500" y="770" textAnchor="middle" fontSize="11" fill="#6b7280" opacity="0.7">
        Stadium Map: {graph.metadata.name}
      </text>

      {/* Transform group for pan/zoom */}
      <g
        transform={`translate(${transform.translateX}, ${transform.translateY}) scale(${transform.scale})`}
      >
        {/* Stadium perimeter outline */}
        <ellipse cx="500" cy="400" rx="460" ry="360" fill="none" stroke="#4b5563" strokeWidth="2" strokeDasharray="8 4" opacity="0.5" />

        {/* Playing field */}
        <g>
          <rect x="350" y="310" width="300" height="180" rx="4" fill="#166534" fillOpacity="0.5" stroke="#22c55e" strokeWidth="1.5" />
          {/* Center circle */}
          <circle cx="500" cy="400" r="30" fill="none" stroke="#22c55e" strokeWidth="1" opacity="0.6" />
          {/* Halfway line */}
          <line x1="500" y1="310" x2="500" y2="490" stroke="#22c55e" strokeWidth="1" opacity="0.6" />
          {/* Field outline */}
          <rect x="360" y="320" width="280" height="160" rx="2" fill="none" stroke="#22c55e" strokeWidth="0.8" opacity="0.5" />
          {/* Label */}
          <text x="500" y="400" textAnchor="middle" dominantBaseline="central" fontSize="14" fill="#22c55e" opacity="0.7" fontWeight="bold">PITCH</text>
        </g>
        {/* Render each zone */}
        {zones.map((zone, index) => {
          const baseColor = getZoneBaseColor(zone);
          const densityOverlay = getDensityOverlay(zone.id);
          const isHighlighted = highlightedSet.has(zone.id);
          const isFocused = focusedZoneIndex === index;

          return (
            <g
              key={zone.id}
              data-zone-id={zone.id}
              data-zone-index={index}
              role="button"
              aria-label={`${zone.name}, ${zone.allegiance} zone, density: ${densityMap[zone.id]?.density ?? 'unknown'}%`}
              tabIndex={-1}
              onClick={() => handleZoneClick(zone.id)}
              style={{ cursor: 'pointer' }}
            >
              {/* Base zone shape with allegiance color */}
              <g
                fill={baseColor}
                fillOpacity={0.75}
                stroke={isHighlighted ? '#ffffff' : isFocused ? '#1d4ed8' : '#374151'}
                strokeWidth={isHighlighted ? 3 : isFocused ? 2.5 : 1}
              >
                {renderZoneShape(zone)}
              </g>

              {/* Density overlay */}
              {densityOverlay && (
                <g
                  fill={densityOverlay.color}
                  fillOpacity={densityOverlay.opacity}
                  stroke="none"
                  pointerEvents="none"
                >
                  {renderZoneShape(zone)}
                </g>
              )}

              {/* Route highlight overlay */}
              {isHighlighted && (
                <g
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={3}
                  strokeDasharray="6 3"
                  pointerEvents="none"
                  filter="url(#glow)"
                >
                  {renderZoneShape(zone)}
                </g>
              )}

              {/* Zone label (short name) */}
              <text
                x={zone.position.x}
                y={zone.position.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={10}
                fill="#f9fafb"
                stroke="#1f2937"
                strokeWidth={3}
                paintOrder="stroke"
                fontWeight={isHighlighted ? 'bold' : 'normal'}
                pointerEvents="none"
                aria-hidden="true"
              >
                {zone.name.length > 15 ? zone.name.slice(0, 13) + '…' : zone.name}
              </text>
            </g>
          );
        })}

        {/* Route path with directional arrows */}
        {highlightedPath.length >= 2 && (
          <RouteOverlay path={highlightedPath} zones={zones} />
        )}

        {/* Fan current location marker */}
        {fanZone && (
          <g aria-label={`Your location: ${fanZone.name}`} pointerEvents="none">
            {/* Pulsing ring */}
            <circle
              cx={fanZone.position.x}
              cy={fanZone.position.y}
              r={12}
              fill="none"
              stroke="#2563eb"
              strokeWidth={2}
              opacity={0.5}
            >
              <animate
                attributeName="r"
                values="10;16;10"
                dur="2s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.6;0.2;0.6"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
            {/* Location dot */}
            <circle
              cx={fanZone.position.x}
              cy={fanZone.position.y}
              r={7}
              fill="#2563eb"
              stroke="#ffffff"
              strokeWidth={2}
            />
            {/* Inner dot */}
            <circle
              cx={fanZone.position.x}
              cy={fanZone.position.y}
              r={3}
              fill="#ffffff"
            />
          </g>
        )}
      </g>
    </svg>
    </div>
  );
}
