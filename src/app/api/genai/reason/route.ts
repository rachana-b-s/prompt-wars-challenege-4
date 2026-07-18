import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Request body for route explanation.
 * Accepts route context including route result, constraints, crowd data,
 * fan profile, and language preference.
 */
interface ReasonRequest {
  route: {
    path: string[];
    distance: number;
    estimatedTime: number;
    warnings: { type: string; message: string; zone: string }[];
  };
  constraints: {
    stepFreeRequired: boolean;
    avoidHighDensity: boolean;
    preferQuiet: boolean;
    excludeAllegiance?: string[];
    avoidZoneTypes?: string[];
  };
  crowdData: Record<string, number>; // zoneId -> density (0-100)
  fanProfile: {
    allegiance: string;
    accessibility: string[];
  };
  language: string;
}

/**
 * Structured GenAI response with reasoning and quantitative data points.
 */
interface GenAIResponse {
  reasoning: string;
  dataPoints: { label: string; value: string }[];
  language: string;
}

import { LANGUAGE_TONE_INSTRUCTIONS } from '@/i18n';
import type { LanguageCode } from '@/types/fan';

/**
 * Language-specific tone instructions for cultural adaptation.
 * Requirement 8.3: formal for ja, informal for pt-BR, etc.
 */
function getToneInstruction(language: string): string {
  const code = language as LanguageCode;
  return LANGUAGE_TONE_INSTRUCTIONS[code] ?? LANGUAGE_TONE_INSTRUCTIONS['en'];
}

/**
 * Constructs a structured prompt for Gemini to explain route reasoning.
 */
function buildPrompt(request: ReasonRequest): string {
  const { route, constraints, crowdData, fanProfile, language } = request;

  const densityDescriptions = route.path.map((zone) => {
    const density = crowdData[zone];
    if (density === undefined) return `${zone}: unknown density`;
    const level = density <= 40 ? 'low' : density <= 70 ? 'moderate' : 'high';
    return `${zone}: ${density}% capacity (${level})`;
  });

  const constraintFactors: string[] = [];
  if (constraints.stepFreeRequired) {
    constraintFactors.push('Step-free route required (wheelchair accessible)');
  }
  if (constraints.avoidHighDensity) {
    constraintFactors.push('Avoiding high-density zones (>80% capacity)');
  }
  if (constraints.preferQuiet) {
    constraintFactors.push('Preferring quiet, low-stimulation routes');
  }
  if (constraints.excludeAllegiance && constraints.excludeAllegiance.length > 0) {
    constraintFactors.push(
      `Avoiding ${constraints.excludeAllegiance.join(', ')} fan zones for safety`
    );
  }
  if (constraints.avoidZoneTypes && constraints.avoidZoneTypes.length > 0) {
    constraintFactors.push(`Avoiding zone types: ${constraints.avoidZoneTypes.join(', ')}`);
  }

  const warningDescriptions = route.warnings.map(
    (w) => `[${w.type}] ${w.message} (zone: ${w.zone})`
  );

  const toneInstruction = getToneInstruction(language);

  return `You are a stadium navigation assistant explaining why a specific route was recommended to a fan.

${toneInstruction}
Respond in language code: ${language}

## Route Details
- Path: ${route.path.join(' → ')}
- Total distance: ${route.distance} meters
- Estimated travel time: ${Math.round(route.estimatedTime / 60)} minutes ${route.estimatedTime % 60} seconds
- Zones traversed: ${route.path.length}

## Crowd Density Along Route
${densityDescriptions.join('\n')}

## Active Constraints
${constraintFactors.length > 0 ? constraintFactors.join('\n') : 'None'}

## Fan Profile
- Team allegiance: ${fanProfile.allegiance}
- Accessibility needs: ${fanProfile.accessibility.length > 0 ? fanProfile.accessibility.join(', ') : 'None specified'}

## Route Warnings
${warningDescriptions.length > 0 ? warningDescriptions.join('\n') : 'None'}

## Instructions
Explain why this route was chosen. Include:
1. Why this path is optimal given the constraints
2. How crowd density influenced the route selection
3. Any accessibility accommodations made
4. Trade-offs vs alternative routes (e.g., additional time for safety or comfort)
5. Include at least one specific quantitative data point (e.g., density percentage, time saved, distance)

Keep the explanation concise (2-4 sentences) and helpful.

Respond with JSON in this exact format:
{
  "reasoning": "Your explanation here",
  "dataPoints": [{"label": "description of data point", "value": "quantitative value"}],
  "language": "${language}"
}`;
}

/**
 * Validates the request body has all required fields.
 */
function validateRequest(body: unknown): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const req = body as Record<string, unknown>;

  if (!req.route || typeof req.route !== 'object') {
    return { valid: false, error: 'Missing or invalid "route" field' };
  }

  const route = req.route as Record<string, unknown>;
  if (!Array.isArray(route.path) || route.path.length === 0) {
    return { valid: false, error: 'route.path must be a non-empty array' };
  }
  if (typeof route.distance !== 'number' || route.distance <= 0) {
    return { valid: false, error: 'route.distance must be a positive number' };
  }
  if (typeof route.estimatedTime !== 'number' || route.estimatedTime <= 0) {
    return { valid: false, error: 'route.estimatedTime must be a positive number' };
  }

  if (!req.constraints || typeof req.constraints !== 'object') {
    return { valid: false, error: 'Missing or invalid "constraints" field' };
  }

  if (!req.crowdData || typeof req.crowdData !== 'object') {
    return { valid: false, error: 'Missing or invalid "crowdData" field' };
  }

  if (!req.fanProfile || typeof req.fanProfile !== 'object') {
    return { valid: false, error: 'Missing or invalid "fanProfile" field' };
  }

  if (!req.language || typeof req.language !== 'string') {
    return { valid: false, error: 'Missing or invalid "language" field' };
  }

  return { valid: true };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Check for API key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'GenAI service unavailable: GEMINI_API_KEY environment variable is not configured. Please set this variable to enable AI-powered route explanations.',
      },
      { status: 500 }
    );
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  const validation = validateRequest(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  const reasonRequest = body as ReasonRequest;

  // Build the prompt
  const prompt = buildPrompt(reasonRequest);

  // Set up 5-second timeout with AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    }, { signal: controller.signal } as unknown as Record<string, unknown>);

    clearTimeout(timeoutId);

    const response = result.response;
    const text = response.text();

    // Parse the JSON response from Gemini
    let genAIResponse: GenAIResponse;
    try {
      const parsed = JSON.parse(text);
      genAIResponse = {
        reasoning: parsed.reasoning || '',
        dataPoints: Array.isArray(parsed.dataPoints) ? parsed.dataPoints : [],
        language: parsed.language || reasonRequest.language,
      };

      // Ensure at least one data point exists
      if (genAIResponse.dataPoints.length === 0) {
        genAIResponse.dataPoints = [
          {
            label: 'Route distance',
            value: `${reasonRequest.route.distance}m`,
          },
        ];
      }
    } catch {
      // If Gemini response isn't valid JSON, use it as plain reasoning text
      genAIResponse = {
        reasoning: text,
        dataPoints: [
          {
            label: 'Route distance',
            value: `${reasonRequest.route.distance}m`,
          },
        ],
        language: reasonRequest.language,
      };
    }

    return NextResponse.json(genAIResponse);
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // Check if it was an abort (timeout)
    if (error instanceof Error && (error.name === 'AbortError' || error.message?.includes('abort'))) {
      return NextResponse.json(
        {
          error: 'Route explanation request timed out. The AI service did not respond within 5 seconds.',
        },
        { status: 504 }
      );
    }

    // Generic GenAI error
    return NextResponse.json(
      {
        error: 'Failed to generate route explanation. Please try again later.',
      },
      { status: 500 }
    );
  }
}
