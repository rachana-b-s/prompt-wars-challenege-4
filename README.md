# Smart Stadium Fan Navigator

AI-powered accessible navigation for FIFA World Cup 2026 stadiums.

---

## Chosen Vertical

**Smart City / Sports & Entertainment** — An accessibility-first indoor navigation system for large stadium venues, helping fans with diverse needs (wheelchair users, blind/deaf fans, families with children, pregnant attendees, neurodivergent individuals) navigate safely and efficiently during live events.

---

## Approach and Logic

### Core Problem
Navigating a 80,000+ capacity stadium during a live event is challenging for anyone, but especially for fans with accessibility needs, opposing team allegiances, or families with children. Existing solutions lack real-time crowd awareness, accessibility-first routing, and AI-powered contextual guidance. Beyond fans, organizers and venue staff need real-time situational awareness — the Staff Dashboard at `/dashboard` serves this persona with crowd density metrics, SOS alert monitoring, and AI-powered crowd flow recommendations.

### Technical Approach

1. **Graph-based pathfinding**: The stadium is modeled as a weighted directed graph (27 zones, 26 bidirectional edges). Each zone has attributes (allegiance, noise level, accessibility features, sensory triggers, crowd density). Each edge has physical properties (step-free, gradient, distance, width).

2. **Constraint-aware A\* search**: The route engine uses A* with a constraint solver that applies a priority hierarchy:
   - **Safety** (hard block): allegiance zone exclusion, child-unsafe zones → returns Infinity weight
   - **Physical access** (hard block): step-free requirement, max gradient, max distance
   - **Comfort** (soft penalty): crowd density (+3x for >80%), sensory triggers (+2.5x for quiet-preferring), noise avoidance

3. **Weakest-link group routing**: When multiple fans travel together, their accessibility profiles are merged using a weakest-link strategy — the route must satisfy the most restrictive member's constraints.

4. **GenAI integration (Gemini 2.0 Flash)**: Three API routes use Google Gemini for:
   - Natural-language route explanations with quantitative data points
   - Facility comparison recommendations
   - Medical symptom triage with urgency classification
   - All with 5-second timeouts and graceful fallback (app fully works without AI)

5. **Property-based testing**: 26 formal correctness properties validated with fast-check, ensuring invariants hold for ALL inputs (not just example cases).

---

## How the Solution Works

### User Flow
1. Fan opens the app → sees an interactive SVG stadium map with color-coded zones
2. Clicks a zone → "Set as my location" to establish position
3. Selects a destination (map click, search, or facility "Navigate" button)
4. Route computes instantly via client-side A* → path highlights on map with directional arrows
5. Route tab shows distance, time, warnings, and AI explanation (loads async)
6. Fan can configure accessibility profile, allegiance, language at any time — route recomputes automatically
7. **Staff Dashboard** — Visit `/dashboard` for the organizer/staff view with crowd metrics, density tables, and SOS alerts

### Architecture
```
┌─────────────────────────────────────────────────────────┐
│ Client (Next.js App Router)                             │
├─────────────────────────────────────────────────────────┤
│ SVG Map ←→ Zustand Stores ←→ A* Route Engine           │
│    ↓              ↓              ↓                      │
│ Zone Info    Fan Profile    Constraint Solver            │
│ Panel        + Group        (mergeProfiles,             │
│              Store          isZoneAllowed,               │
│                             getEdgeWeight)               │
├─────────────────────────────────────────────────────────┤
│ API Routes (Server)                                     │
│ /api/genai/reason  → Gemini → route explanation         │
│ /api/genai/recommend → Gemini → facility comparison     │
│ /api/genai/triage  → Gemini → medical guidance          │
│ /api/upload        → Zod validation → store update      │
│ /api/sos           → in-memory alert storage            │
└─────────────────────────────────────────────────────────┘
```

### Key Features
| Feature | Implementation |
|---------|---------------|
| Accessible routing | 10 accessibility categories with category-specific constraints (pregnancy: restroom proximity, child: zone exclusion, blind: tactile preference) |
| Real-time density | Color-coded overlay (green/yellow/red) with 60s staleness detection |
| Emergency services | SOS with exponential backoff retry (1s→2s→4s), AED locator with SOS route, lost child protocol, medical triage via AI |
| Data upload | JSON + CSV upload with Zod schema validation and referential integrity checks |
| Multilingual | 8 languages with culturally-adapted AI tone (formal for Japanese, informal for Portuguese) |
| Group navigation | Add members with individual profiles → auto-merged constraints → weakest-link routing |
| Staff dashboard | Real-time crowd density overview, SOS alert feed, capacity metrics, AI crowd flow recommendations for organizers/staff |

---

## Assumptions Made

1. **Synthetic data for demo**: The stadium layout (MetLife Stadium, FIFA World Cup 2026) uses synthetic zone/edge/facility data. In production, this would be replaced via the upload API with real venue data.
2. **Client-side pathfinding**: With ~30 zones and ~26 edges, the graph is small enough for instant client-side A* computation. For larger venues (1000+ nodes), the engine would need server-side computation.
3. **Crowd density is pre-loaded**: Density data is initialized from synthetic data and updated via the upload API. In production, this would connect to real-time sensors/IoT feeds.
4. **GenAI is optional**: The app is fully functional without a Gemini API key. AI features gracefully degrade to algorithmic fallbacks.
5. **Single environment variable**: Only `GEMINI_API_KEY` is needed for deployment. No database, no external services beyond Gemini.
6. **Browser-based**: Designed as a web app (mobile-first responsive). No native app required.

---

## Evaluation Coverage

### Code Quality
- TypeScript strict mode throughout
- Consistent functional patterns (pure functions for engine/services, hooks for React)
- Barrel exports, clear module boundaries
- Components follow single-responsibility principle
- Zustand stores with persist middleware for session continuity

### Security
- Environment variables for API keys (never exposed to client)
- Input validation via Zod schemas on all upload endpoints
- No raw SQL/injection vectors (no database)
- API routes validate request bodies before processing
- GenAI responses are parsed and type-checked before use
- SOS endpoint validates all required fields

### Efficiency
- Client-side A* with min-heap priority queue (O(E log V) — instant for 30 zones)
- Zustand stores with `partialize` to minimize localStorage writes
- Paginated facility results (4 per page — no DOM bloat)
- GenAI calls are async and non-blocking (UI never waits for AI)
- Route computation uses key-based deduplication (won't recompute for same source+destination pair)
- BFS-based facility proximity uses lazy computation

### Testing
- **334 tests** across 22 test files
- **26 property-based tests** (fast-check) validating formal correctness invariants
- Unit tests for constraint solver, route engine, crowd monitor, facility registry
- API route tests with mocked GenAI responses
- Integration tests for the upload pipeline
- Component tests for map rendering (Property 21: zone count matches graph)

### Accessibility (WCAG 2.1 AA)
- Semantic HTML landmarks (`<main>`, `<nav>`, `<aside>`, `<section>`)
- Full ARIA implementation (tablist/tab/tabpanel, role="button", aria-label, aria-live)
- Keyboard navigation (arrow keys for zones, Enter/Space to select, Tab between panels)
- Screen-reader route output (`ScreenReaderRoute` component with step-by-step text)
- Skip-to-content link
- `prefers-reduced-motion` support (disables animations)
- Color legend (information not conveyed by color alone)
- Touch target compliance (40px+ interactive elements)
- Visible focus indicators on all interactive elements
- Error messages use `role="alert"` with `aria-live`

---

## Quick Start

```bash
npm install
cp .env.local.example .env.local  # Optional: add GEMINI_API_KEY for AI features
npm run dev                        # Open http://localhost:3000
```

## Commands

```bash
npm run dev        # Development server
npm run build      # Production build
npm run test:run   # Run all 334 tests
npm test           # Tests in watch mode
npm run lint       # ESLint
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | No | Google Gemini API key. Get one free at https://aistudio.google.com/apikey. App works without it. |

## Deployment

Vercel-ready. Push to GitHub, connect to Vercel, add `GEMINI_API_KEY` env var. Single command: `vercel deploy`.

## License

MIT
