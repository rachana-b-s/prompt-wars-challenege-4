import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { TriageResponse } from '@/types/emergency';
import { LANGUAGE_TONE_INSTRUCTIONS } from '@/i18n';
import type { LanguageCode } from '@/types/fan';

interface TriageRequest {
  symptoms: string;
  currentZone: string;
  availableFacilities: { id: string; type: string; zone: string; name: string }[];
  language: string;
}

const TRIAGE_DISCLAIMER =
  'This is not medical advice. This tool provides general guidance only. If you are experiencing a medical emergency, please seek immediate help from stadium medical staff or call emergency services.';

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY environment variable is not configured.' },
      { status: 500 }
    );
  }

  let body: TriageRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  const { symptoms, currentZone, availableFacilities, language } = body;

  if (!symptoms || !currentZone) {
    return NextResponse.json(
      { error: 'Missing required fields: symptoms and currentZone.' },
      { status: 400 }
    );
  }

  const facilitiesContext = (availableFacilities ?? [])
    .map((f) => `- ${f.name} (${f.type}) in zone ${f.zone} [id: ${f.id}]`)
    .join('\n');

  const prompt = `You are a medical triage assistant for a stadium event. Based on the fan's reported symptoms, recommend the appropriate level of medical assistance.

RECOMMENDATION LEVELS:
- "water_station": For mild dehydration, heat-related fatigue, minor thirst, light-headedness from heat
- "first_aid": For minor injuries (cuts, scrapes, sprains), moderate symptoms (nausea, dizziness not heat-related, mild allergic reactions)
- "medical_center": For severe symptoms (chest pain, difficulty breathing, severe allergic reactions, loss of consciousness, head injuries, seizures, suspected fractures)

URGENCY LEVELS:
- "low": Non-urgent, fan can walk to facility at own pace
- "medium": Should seek assistance soon, within 10 minutes
- "high": Immediate assistance needed, consider sending help to fan's location

FAN'S REPORTED SYMPTOMS:
${symptoms}

FAN'S CURRENT ZONE:
${currentZone}

AVAILABLE MEDICAL/HEALTH FACILITIES:
${facilitiesContext || 'No facility data available.'}

LANGUAGE PREFERENCE: ${language || 'en'}

Respond with a JSON object containing:
{
  "recommendation": "water_station" | "first_aid" | "medical_center",
  "reasoning": "A brief explanation of why this level of care is recommended (in the fan's preferred language)",
  "nearestFacilityId": "The id of the most appropriate and nearest facility from the available list",
  "urgency": "low" | "medium" | "high"
}

IMPORTANT: Always err on the side of caution. If symptoms could indicate something serious, recommend a higher level of care.
${LANGUAGE_TONE_INSTRUCTIONS[(language || 'en') as LanguageCode] ?? LANGUAGE_TONE_INSTRUCTIONS['en']}
Provide your reasoning in the fan's preferred language (${language || 'en'}).
Return ONLY the JSON object, no additional text.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let result;
    try {
      result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseText = result.response.text();
    let parsed: { recommendation: string; reasoning: string; nearestFacilityId: string; urgency: string };

    try {
      parsed = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse GenAI response.' },
        { status: 502 }
      );
    }

    // Validate the recommendation value
    const validRecommendations = ['water_station', 'first_aid', 'medical_center'] as const;
    const validUrgencies = ['low', 'medium', 'high'] as const;

    const recommendation = validRecommendations.includes(parsed.recommendation as typeof validRecommendations[number])
      ? (parsed.recommendation as TriageResponse['recommendation'])
      : 'first_aid'; // Default to first_aid if unclear

    const urgency = validUrgencies.includes(parsed.urgency as typeof validUrgencies[number])
      ? (parsed.urgency as TriageResponse['urgency'])
      : 'medium'; // Default to medium if unclear

    const nearestFacilityId = parsed.nearestFacilityId || (availableFacilities?.[0]?.id ?? 'unknown');

    const triageResponse: TriageResponse = {
      recommendation,
      reasoning: parsed.reasoning || 'Unable to generate detailed reasoning.',
      nearestFacilityId,
      urgency,
      disclaimer: TRIAGE_DISCLAIMER,
    };

    return NextResponse.json(triageResponse);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'GenAI request timed out. Please try again.' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: 'An error occurred while processing the triage request.' },
      { status: 500 }
    );
  }
}
