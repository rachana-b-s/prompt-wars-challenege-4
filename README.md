# Smart Stadium Fan Navigator

AI-powered accessible navigation for FIFA World Cup 2026 stadiums. Real-time crowd density, accessibility-first routing, and GenAI-powered recommendations.

## Overview

The Smart Stadium Fan Navigator helps fans navigate large stadium venues with:
- **A* pathfinding** with constraint-aware routing (accessibility, allegiance, crowd density)
- **Google Gemini AI** for natural-language route explanations, facility recommendations, and medical triage
- **Accessibility-first design** supporting 10 accessibility categories (wheelchair, blind, deaf, neurodivergent, pregnancy, child safety, and more)
- **Real-time crowd density** visualization with color-coded overlays
- **Emergency services** (SOS alerts, AED locator, lost child protocol, medical triage)
- **Multilingual support** for 8 languages with culturally-adapted AI responses

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand with persist middleware
- **Validation**: Zod schemas
- **Testing**: Vitest + fast-check (property-based testing)
- **AI**: Google Gemini 2.0 Flash via `@google/generative-ai`
- **Deployment**: Vercel-ready

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment (optional — app works without AI key)
cp .env.local.example .env.local
# Edit .env.local and add your GEMINI_API_KEY (get one at https://aistudio.google.com/apikey)

# Run development server
npm run dev

# Open http://localhost:3000
```

## Usage

1. **Set your location** — Click any zone on the map → "Set as my location"
2. **Set destination** — Click another zone → "Navigate here", or use the destination search in the Route tab
3. **View route** — The path highlights on the map with blue arrows; the Route tab shows time, distance, and AI reasoning
4. **Configure profile** — Profile tab lets you set accessibility needs, allegiance, language
5. **Find facilities** — Facilities tab with filters for food, restrooms, medical, comfort amenities
6. **Emergency** — Emergency tab for SOS, medical triage, AED locator, lost child reporting

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/genai/          # GenAI API routes (reason, recommend, triage)
│   ├── api/upload/         # Stadium data upload API
│   ├── api/sos/            # Emergency SOS API
│   └── upload/             # Data upload page
├── components/             # React components (map, panels, forms)
├── engine/                 # A* route engine + constraint solver
├── services/               # Service layer (crowd monitor, facility registry, GenAI client, SOS)
├── stores/                 # Zustand stores (stadium, crowd, facility, fan, group, route)
├── hooks/                  # React hooks (useAutoRoute, useProactiveWarnings)
├── types/                  # TypeScript type definitions
├── schemas/                # Zod validation schemas
├── data/                   # Synthetic stadium and facility data
└── i18n/                   # Internationalization (8 languages)
```

## Testing

```bash
# Run all tests
npm run test:run

# Run tests in watch mode
npm test

# Run specific test file
npx vitest run src/engine/route-engine.property.test.ts
```

The test suite includes:
- **322 tests** across 20 test files
- **26 property-based tests** (fast-check) validating formal correctness properties
- Unit tests for constraint solver, route engine, services, and API routes
- Integration tests for the upload pipeline

## Key Correctness Properties

The app is validated against 26 formal correctness properties including:
- Route existence completeness (connected zones always find a path)
- Wheelchair step-free constraint enforcement
- Fan allegiance zone exclusion
- Child safety zone exclusion
- Density staleness detection (>60s threshold)
- Facility filter conjunction correctness
- SOS emergency route override (shortest path ignoring penalties)

## Accessibility (WCAG 2.1 AA)

- Semantic HTML landmarks (`<main>`, `<nav>`, `<aside>`)
- ARIA roles/labels on all interactive elements
- Keyboard navigation (arrow keys for map zones, tab for panels)
- Screen-reader-optimized route descriptions
- Skip-to-content link
- `prefers-reduced-motion` support
- Color legend (doesn't rely on color alone)
- Touch target compliance (40px+ buttons)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | No | Google Gemini API key for AI features. App works without it (graceful fallback). |

## Deployment

```bash
# Build for production
npm run build

# Deploy to Vercel
vercel deploy
```

The only required environment variable on Vercel is `GEMINI_API_KEY`. If not set, AI features show fallback messages but all other functionality works.

## License

MIT
