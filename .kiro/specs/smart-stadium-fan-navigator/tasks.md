# Implementation Plan: Smart Stadium Fan Navigator

## Overview

This plan implements the Smart Stadium Fan Navigator as a Next.js 14+ App Router application with client-side A* pathfinding, SVG-based map rendering, Google Gemini GenAI reasoning, and comprehensive accessibility-first routing. Tasks are ordered to establish core infrastructure first, then build pathfinding logic, layering features incrementally toward a working demo.

## Tasks

- [x] 1. Set up project structure, core types, and configuration
  - [x] 1.1 Initialize Next.js 14+ project with TypeScript, Tailwind CSS, Zustand, Zod, and Vitest + fast-check
    - Create Next.js app with App Router (`npx create-next-app@latest --typescript --tailwind --app`)
    - Install dependencies: `zustand`, `zod`, `vitest`, `fast-check`, `@google/generative-ai`
    - Configure Vitest in `vitest.config.ts`
    - Add `.env.local.example` with `GEMINI_API_KEY` placeholder
    - _Requirements: 10.1, 10.2, 10.4_

  - [x] 1.2 Define core TypeScript types and interfaces
    - Create `src/types/stadium.ts` — ZoneId, Zone, ZoneType, ZoneAccessibility, ZoneShape, StadiumGraph, StadiumMetadata, GraphEdge, EdgeAccessibility, EdgeType
    - Create `src/types/facility.ts` — FacilityId, Facility, FacilityType, FacilityAccessibility, FacilityAttributes, DietaryFilter
    - Create `src/types/fan.ts` — FanProfile, AccessibilityProfile, FanAllegiance, LanguageCode, FanGroup, FanGroupMember, GroupConstraintSet
    - Create `src/types/route.ts` — RouteRequest, GroupRouteRequest, RouteResult, RouteConstraints, RouteWarning
    - Create `src/types/crowd.ts` — DensityMap, DensityLevel, DensityUpdate
    - Create `src/types/emergency.ts` — SOSAlert, LostChildProtocol, TriageResponse
    - Create `src/types/errors.ts` — AppError, ValidationError, ConstraintConflict
    - _Requirements: 1.1, 3.1, 4.1, 5.1, 6.1, 7.6_

  - [x] 1.3 Create Zod validation schemas for data upload
    - Create `src/schemas/stadium-upload.ts` — full Zod schema for stadium JSON upload including zones (min 2, required fields), edges, facilities, structural constraints (at least 1 FamilySection, 1 AccessibleSeatingArea, 1 BufferZone between home/away)
    - Create `src/schemas/crowd-upload.ts` — Zod schema for crowd density data uploads
    - Create `src/schemas/facility-upload.ts` — Zod schema for facility data uploads
    - Include validation for referential integrity (facility zone references exist in zones)
    - _Requirements: 7.1, 7.6, 7.7, 7.8, 12.5_

- [x] 2. Implement synthetic data and stadium graph store
  - [x] 2.1 Create synthetic stadium data
    - Create `src/data/synthetic-stadium.ts` with a FIFA World Cup 2026 stadium configuration
    - Include at least 20 zones, 5 gates, realistic crowd patterns
    - Include zone types: gates, concourses, seating sections, concession areas, restroom clusters, medical areas, family sections, accessible seating, cooling zones, prayer areas
    - Include allegiance distribution: home zones, away zones, neutral zones, buffer zones
    - Include accessibility features, noise levels, sensory triggers per zone
    - Include position and shape data for SVG map rendering
    - _Requirements: 7.5, 10.5_

  - [x] 2.2 Create synthetic facility data
    - Create `src/data/synthetic-facilities.ts` with realistic facility distribution
    - At least 10 food stalls with varied DietaryFilters and cuisine types
    - At least 8 restrooms (standard, accessible, family, gender-neutral)
    - At least 2 first aid stations, 1 medical center, 4 AED stations
    - At least 2 nursing rooms, 3 charging stations, 1 prayer room, 2 cooling zones
    - Include queue estimates, operating status, accessibility features
    - _Requirements: 10.6, 7.5_

  - [x] 2.3 Create Zustand store for stadium graph and crowd data
    - Create `src/stores/stadium-store.ts` — StadiumGraph state, load/replace graph, zone lookup
    - Create `src/stores/crowd-store.ts` — DensityMap state, update density, bulk update, staleness check (>60s)
    - Create `src/stores/facility-store.ts` — Facility registry state, search, filter, queue estimates
    - Auto-load synthetic data on first access
    - Persist to LocalStorage for session continuity
    - _Requirements: 6.1, 6.5, 7.5, 10.5_

- [x] 3. Checkpoint - Ensure project builds and tests run
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement constraint solver and route engine
  - [x] 4.1 Implement constraint solver
    - Create `src/engine/constraint-solver.ts`
    - Implement `mergeProfiles()` — merge multiple AccessibilityProfiles into GroupConstraintSet using weakest-link strategy (step-free if ANY member needs it, min walking distance, union of avoidance sets)
    - Implement `isZoneAllowed()` — check zone against hard constraints (allegiance exclusion, zone type exclusion, child safety)
    - Implement `isEdgeTraversable()` — check edge against hard constraints (step-free requirement, max gradient)
    - Implement `getEdgeWeight()` — compute dynamic weight using base_distance + density_penalty + accessibility_penalty + safety_penalty formula from design
    - Implement `identifyConflicts()` — detect mutually exclusive constraints in a GroupConstraintSet
    - Implement constraint priority: safety > physical access > comfort preferences
    - _Requirements: 3.25, 4.2, 4.3, 5.2, 5.3, 5.4, 12.6_

  - [x] 4.2 Write property tests for constraint solver
    - **Property 11: Group Constraint Merge Monotonicity** — merged set at least as restrictive as any individual profile
    - **Property 13: Constraint Priority Ordering** — comfort never overrides safety/physical access
    - **Property 25: Constraint Conflict Identification** — conflicting constraints identified, removing one makes route feasible
    - **Validates: Requirements 4.2, 4.3, 3.25, 12.6**

  - [x] 4.3 Implement A* route engine
    - Create `src/engine/route-engine.ts`
    - Implement `computeRoute()` — A* search with constraint-aware edge weighting, zone exclusion, density penalties
    - Implement `computeGroupRoute()` — route computation using merged GroupConstraintSet
    - Implement `findAlternatives()` — find N alternative routes by penalizing edges of previous best path
    - Handle edge cases: no route found (return nearest reachable alternative), zone closed, high-density reroute (>80)
    - Implement SOS emergency route override (shortest distance, ignore density/comfort)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 5.2, 5.3, 15.6_

  - [x] 4.4 Write property tests for route engine
    - **Property 1: Route Existence Completeness** — connected source/destination always returns path with status 'found'
    - **Property 2: Route Optimality Ordering** — alternatives ordered by non-decreasing composite score
    - **Property 3: High-Density Zone Avoidance** — avoids zones with density >80 when alternative exists
    - **Property 4: Route Result Structural Completeness** — successful routes have estimatedTime >0, distance >0, zonesTraversed = path length
    - **Property 5: Unreachable Destination Alternative Suggestion** — returns nearest reachable alternative when no path exists
    - **Property 6: Wheelchair Step-Free Constraint Enforcement** — wheelchair routes only use step-free edges
    - **Property 7: Limited Mobility Distance Constraint** — no edge exceeds 200m uninterrupted distance
    - **Property 8: Fan Allegiance Zone Exclusion** — routes never traverse opposing allegiance zones
    - **Property 19: SOS Emergency Route Override** — SOS route is shortest distance ignoring penalties
    - **Validates: Requirements 1.1–1.5, 3.1, 3.2, 5.2–5.4, 5.7, 15.6**

  - [x] 4.5 Implement accessibility-specific routing constraints
    - Add pregnancy routing: prefer routes within 2 zone-hops of restroom, avoid >1 flight stairs, rest areas every 150m
    - Add sensory sensitivity routing: prefer quiet routes, avoid high-noise zones, sensory triggers, smoking areas
    - Add child accompaniment routing: avoid alcohol/adult zones, service corridors; prefer family sections, max 500m
    - Add blind/low-vision routing: prefer tactile indicators, handrails, wall-following paths (without companion); allow visually complex areas (with companion)
    - Add deaf/HoH: no routing changes (UI-level only), but integrate with route display
    - _Requirements: 3.12–3.21, 17.4_

  - [x] 4.6 Write property tests for accessibility routing
    - **Property 9: Child Safety Zone Exclusion** — child accompaniment excludes alcohol, adult, service corridor zones
    - **Property 10: Sensory Sensitivity Zone Avoidance** — avoids high noise, sensory triggers, smoking areas
    - **Property 22: Pregnancy Restroom Proximity** — every zone in path within 2 zone-hops of a restroom
    - **Validates: Requirements 3.12, 3.15, 3.16, 3.18, 16.6, 17.4**

- [x] 5. Checkpoint - Ensure route engine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement facility registry and crowd monitor
  - [x] 6.1 Implement facility registry service
    - Create `src/services/facility-registry.ts`
    - Implement `search()` — query facilities by type, dietary filter, cuisine, kid-friendly, max queue
    - Implement `filterByDietary()` — return only facilities matching DietaryFilter
    - Implement `filterByType()` — return only facilities matching FacilityType
    - Implement `getNearestByType()` — find nearest facility of given type from a zone
    - Implement combined filtering (intersection of all active filters)
    - Implement sort by proximity or queue estimate
    - _Requirements: 13.1, 13.6, 13.8, 14.1, 16.4, 17.7, 17.8_

  - [x] 6.2 Write property tests for facility registry
    - **Property 14: Facility Filter Correctness** — filtered results contain ONLY matching facilities
    - **Property 15: Combined Filter Conjunction** — simultaneous filters return intersection of individual results
    - **Property 16: Facility Sort Order Correctness** — sorted results in non-decreasing order of sort key
    - **Property 23: Quiet Restroom Filtering** — sensory sensitivity filter returns only restrooms in low-noise zones
    - **Property 24: Allergen Flagging Correctness** — exactly flags stalls with matching allergens
    - **Validates: Requirements 13.1, 13.5, 13.8, 14.4, 17.8**

  - [x] 6.3 Implement crowd monitor service
    - Create `src/services/crowd-monitor.ts`
    - Implement `getDensity()` — return current density level for a zone
    - Implement `getAllDensities()` — return full density map
    - Implement `updateDensity()` / `bulkUpdate()` — update density values with timestamps
    - Implement `isStale()` — return true if >60s since last update
    - Implement density color classification: green (0–40), yellow (41–70), red (71–100)
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [x] 6.4 Write property tests for crowd monitor
    - **Property 17: Density Color Classification** — correct color for all values 0–100
    - **Property 18: Density Staleness Detection** — stale iff >60s since lastUpdated
    - **Validates: Requirements 6.3, 6.5**

- [x] 7. Implement fan profile, group management, and state store
  - [x] 7.1 Create fan profile and group Zustand stores
    - Create `src/stores/fan-store.ts` — FanProfile state (accessibility, allegiance, language, currentZone, recentDestinations)
    - Implement profile update at any time during session
    - Support multiple simultaneous accessibility categories
    - Create `src/stores/group-store.ts` — FanGroup state, add/remove members, auto-recompute GroupConstraintSet
    - When group includes a child, auto-incorporate child accompaniment constraints
    - Persist profile to LocalStorage
    - _Requirements: 3.22, 3.23, 4.1, 4.6, 4.7, 5.1, 8.1, 11.4_

  - [x] 7.2 Implement automatic route trigger logic
    - Create `src/hooks/useAutoRoute.ts` — React hook that triggers route computation exactly once when both currentZone AND destination are set (non-null)
    - Setting only one value must NOT trigger computation
    - _Requirements: 11.3_

  - [x] 7.3 Write property test for auto-route trigger
    - **Property 26: Automatic Route Trigger on Location+Destination** — computation invoked exactly once when both set, not invoked when only one set
    - **Validates: Requirements 11.3**

- [x] 8. Implement SVG map renderer
  - [x] 8.1 Create SVG stadium map component
    - Create `src/components/StadiumMap.tsx`
    - Render zones dynamically from StadiumGraph data as SVG elements (one per zone)
    - Color-code zones by allegiance type (home, away, neutral, buffer, family, accessible seating)
    - Overlay crowd density colors (green/yellow/red) with opacity
    - Support pinch-to-zoom/scroll-to-zoom and pan/drag gestures
    - Display fan's current location marker
    - _Requirements: 9.1, 9.2, 9.4, 9.5, 9.6, 9.7_

  - [x] 8.2 Implement map interaction and route display
    - Implement zone tap/click to show zone info panel (name, density, facilities, allegiance)
    - Highlight computed route path with directional indicators (arrows along SVG path)
    - Implement zone selection for setting current location and destination
    - _Requirements: 9.2, 9.3, 9.4, 11.1_

  - [x] 8.3 Write property test for map rendering
    - **Property 21: Map Renders All Graph Zones** — SVG element count equals zone count in StadiumGraph
    - **Validates: Requirements 9.1, 9.6**

- [x] 9. Implement GenAI service and API routes
  - [x] 9.1 Create GenAI API route for route explanation
    - Create `src/app/api/genai/reason/route.ts`
    - Accept route context (route result, constraints, crowd data, fan profile, language)
    - Construct structured Gemini prompt with route factors, quantitative data points
    - Use `responseMimeType: "application/json"` for structured output
    - Enforce 5-second timeout with AbortController
    - Return GenAIResponse with reasoning text + at least one quantitative data point
    - Handle missing/invalid API key with clear error message
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 10.2, 10.3_

  - [x] 9.2 Create GenAI API route for facility recommendation
    - Create `src/app/api/genai/recommend/route.ts`
    - Accept facility context (available options, queue times, distances, dietary filters)
    - Generate natural-language comparison of queue times, walking distance, total time saved
    - Support multilingual output based on fan's language preference
    - _Requirements: 13.4, 14.7_

  - [x] 9.3 Create GenAI API route for medical triage
    - Create `src/app/api/genai/triage/route.ts`
    - Accept symptom description and current location
    - Return TriageResponse with recommendation level (water station/first aid/medical center), reasoning, nearest facility, urgency, and disclaimer
    - _Requirements: 15.3_

  - [x] 9.4 Implement GenAI client-side service with fallback
    - Create `src/services/genai-client.ts`
    - Async call to API routes with 5-second timeout
    - On failure: return fallback message "AI explanation temporarily unavailable" with basic route data
    - Support language parameter for multilingual output
    - Implement proactive warning calls (heat/dehydration)
    - _Requirements: 2.4, 2.5, 12.1, 15.5, 17.1_

- [x] 10. Implement UI pages and feature components
  - [x] 10.1 Create main page layout with navigation panels
    - Create `src/app/page.tsx` — main landing page with map view as primary content
    - Create layout with side panel for route info, profile, and facility search
    - Implement responsive layout (mobile-first with desktop breakpoints)
    - Ensure WCAG 2.1 AA compliance: proper ARIA landmarks, keyboard navigation, color contrast
    - _Requirements: 3.24, 9.1, 10.4_

  - [x] 10.2 Create profile setup component
    - Create `src/components/ProfileSetup.tsx`
    - Form for AccessibilityProfile (checkboxes for all categories, multi-select)
    - Fan allegiance selector (home/away/neutral)
    - Companion mode toggle
    - Allergen input
    - Allow updates at any time during session
    - _Requirements: 3.22, 3.23, 5.1_

  - [x] 10.3 Create group manager component
    - Create `src/components/GroupManager.tsx`
    - Add/remove group members with individual AccessibilityProfiles
    - Display merged GroupConstraintSet summary
    - Show which member constraints influenced the route
    - _Requirements: 4.1, 4.4, 4.6_

  - [x] 10.4 Create route panel with GenAI reasoning display
    - Create `src/components/RoutePanel.tsx`
    - Display computed route: estimated time, distance, zones traversed
    - Show GenAI explanation (loads async, shows loading state, fallback on error)
    - Show route warnings (allegiance proximity, high-density zones)
    - Display alternative routes with trade-off explanations
    - _Requirements: 1.4, 2.1, 2.2, 2.3, 2.6, 12.1_

  - [x] 10.5 Create destination selector and search
    - Create `src/components/DestinationSelector.tsx`
    - Searchable text input for zone search (<500ms results)
    - Categorized list (gates, restrooms, concessions, seating, first aid, family, accessible)
    - Recent destinations quick-select
    - Map tap integration for destination selection
    - _Requirements: 11.1, 11.2, 11.4, 11.5_

  - [x] 10.6 Create facility finder component
    - Create `src/components/FacilityFinder.tsx`
    - Tabs/filters for food, restrooms, medical, comfort amenities
    - Dietary filter multi-select for food stalls
    - Cuisine type filter
    - Restroom type filter (standard, accessible, family, gender-neutral)
    - Queue estimate display per facility
    - Sort by proximity or queue time
    - Max queue estimate filter
    - Allergen warning indicators on food stalls
    - Kid-friendly filter
    - _Requirements: 13.1–13.8, 14.1–14.8, 17.2–17.8_

  - [x] 10.7 Create emergency panel (SOS + medical + lost child)
    - Create `src/components/EmergencyPanel.tsx`
    - SOS button — sends alert to /api/sos with current zone, retry on failure, display zone on-screen as fallback
    - Medical facility search with first aid vs medical center distinction
    - AED locator with route computation
    - Lost child protocol form (age, clothing, last known zone)
    - Triage guidance via GenAI (symptom input → recommendation)
    - _Requirements: 15.1–15.8, 16.1–16.3_

- [x] 11. Implement data upload page and API route
  - [x] 11.1 Create upload API route with validation
    - Create `src/app/api/upload/route.ts`
    - Accept JSON and CSV file uploads
    - Parse CSV to JSON objects
    - Validate against Zod schemas (stadium, crowd, facility)
    - Return descriptive error messages identifying specific validation failures
    - Replace stadium graph on valid upload within 10 seconds
    - _Requirements: 7.1–7.8, 12.5_

  - [x] 11.2 Create upload page UI
    - Create `src/app/upload/page.tsx`
    - File input accepting .json and .csv
    - Upload progress indicator
    - Success/error feedback with detailed validation error display
    - Separate upload areas for stadium layout, crowd data, and facility data
    - _Requirements: 7.1, 7.3, 7.4, 7.8_

- [x] 12. Implement SOS API route and emergency services
  - [x] 12.1 Create SOS API route
    - Create `src/app/api/sos/route.ts`
    - Accept SOSAlert and LostChildProtocol payloads
    - Log/store alerts (in-memory for demo)
    - Return acknowledgment within 3 seconds (SOS) / 5 seconds (lost child)
    - _Requirements: 15.2, 16.2_

  - [x] 12.2 Implement client-side SOS service with retry
    - Create `src/services/sos-service.ts`
    - POST to /api/sos with exponential backoff retry (1s, 2s, 4s — max 3 retries)
    - On persistent failure: display current zone location prominently on-screen
    - Compute emergency route (shortest path to nearest medical center, overriding crowd avoidance)
    - _Requirements: 15.2, 15.6, 15.8, 16.2_

- [x] 13. Implement language selector and i18n support
  - [x] 13.1 Create language selector and i18n infrastructure
    - Create `src/components/LanguageSelector.tsx` — dropdown/picker for 8 languages (en, es, fr, ar, pt, de, ja, zh)
    - Create `src/i18n/` directory with translation files for UI labels
    - Pass language parameter to GenAI API calls for multilingual reasoning
    - Implement tone/cultural adaptation instruction in GenAI prompts (formal for ja, informal for pt-BR)
    - Show visual indicator for untranslatable terms
    - _Requirements: 8.1–8.4_

- [x] 14. Implement accessibility UI features
  - [x] 14.1 Implement deaf/HoH UI adaptations
    - Ensure all navigation instructions are visual text + map-based cues
    - Implement haptic vibration patterns for time-sensitive alerts (using Vibration API where available)
    - Display visual flash indicators for route changes and emergency notifications
    - Show visual representations of ambient audio info ("loud crowd noise ahead")
    - _Requirements: 3.5, 3.6, 3.7_

  - [x] 14.2 Implement blind/low-vision UI adaptations
    - Ensure all route instructions have ARIA landmarks and sequential step descriptions
    - Implement audio-described turn-by-turn cues with landmark references
    - Provide screen-reader-optimized route output (not relying on visual map)
    - _Requirements: 3.8, 3.9_

  - [x] 14.3 Implement neurodivergent and child-friendly UI
    - Numbered steps with predictable, consistent descriptions (no ambiguous directional language)
    - Short, simple step display for child accompaniment (max 3 instructions visible at once)
    - _Requirements: 3.17, 3.20_

- [x] 15. Implement proactive warnings and contextual recommendations
  - [x] 15.1 Implement proactive GenAI warnings
    - Create `src/hooks/useProactiveWarnings.ts`
    - Monitor fan's zone dwell time and sun exposure status
    - Trigger heat/dehydration warning when in sun-exposed zone >30min with density >60 (Req 15.5) or >45min any density (Req 17.6)
    - Recommend nearest water station or cooling zone
    - Show recommendation with estimated walking time
    - _Requirements: 15.5, 17.1, 17.6_

- [x] 16. Implement error handling and edge cases
  - [x] 16.1 Implement global error handling
    - Create `src/components/ErrorBoundary.tsx` — React error boundary with user-friendly messages and retry action
    - Implement crowd data unavailable fallback (distance-only routing with user notification)
    - Implement zone closed handling (suggest nearest open alternative)
    - Implement group constraint conflict resolution (identify specific conflicts, suggest split or alternative)
    - _Requirements: 12.1–12.6_

- [x] 17. Checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Data upload validation and integration testing
  - [x] 18.1 Write property test for data upload validation
    - **Property 20: Data Upload Validation Rejects Invalid Schema** — missing required fields or <2 connected zones always rejected with descriptive error
    - **Validates: Requirements 7.3, 7.6, 12.5**

  - [x] 18.2 Write integration tests for upload pipeline
    - Test JSON and CSV parsing end-to-end
    - Test valid upload replaces stadium graph and triggers map re-render
    - Test invalid upload returns field-level errors
    - _Requirements: 7.1–7.3_

- [x] 19. Final wiring and deployment configuration
  - [x] 19.1 Wire all components together on main page
    - Connect StadiumMap ↔ RoutePanel ↔ FacilityFinder ↔ EmergencyPanel via Zustand stores
    - Ensure route computation triggers on location + destination set
    - Ensure GenAI explanation loads async after route display
    - Ensure density overlay updates reflect crowd store changes
    - Verify responsive layout works on mobile and desktop
    - _Requirements: 11.3, 6.2, 2.5, 10.4_

  - [x] 19.2 Configure Vercel deployment
    - Create `vercel.json` if needed for any route configuration
    - Ensure single environment variable (`GEMINI_API_KEY`) is the only requirement
    - Verify build succeeds with `next build`
    - Test that missing API key shows clear configuration error (not crash)
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 20. Final checkpoint - Ensure all tests pass and app builds
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the 26 correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- The route engine and constraint solver are pure functions, ideal for property-based testing with fast-check
- Synthetic data is pre-loaded on first access — no user action required for demo
- GenAI calls always load asynchronously; the UI never blocks on AI responses
- SOS/emergency features degrade gracefully with retry and on-screen fallback

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["4.1", "6.3"] },
    { "id": 5, "tasks": ["4.2", "4.3", "6.1", "6.4"] },
    { "id": 6, "tasks": ["4.4", "4.5", "6.2"] },
    { "id": 7, "tasks": ["4.6", "7.1"] },
    { "id": 8, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 9, "tasks": ["8.2", "8.3", "9.1", "9.2", "9.3"] },
    { "id": 10, "tasks": ["9.4", "10.1"] },
    { "id": 11, "tasks": ["10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "13.1"] },
    { "id": 12, "tasks": ["11.1", "11.2", "12.1", "14.1", "14.2", "14.3"] },
    { "id": 13, "tasks": ["12.2", "15.1", "16.1", "18.1", "18.2"] },
    { "id": 14, "tasks": ["19.1"] },
    { "id": 15, "tasks": ["19.2"] }
  ]
}
```
