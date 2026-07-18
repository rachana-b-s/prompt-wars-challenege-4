import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface RecommendFacility {
  id: string;
  name: string;
  type: string;
  queueEstimate: number;
  distance: number;
  dietaryOptions?: string[];
}

export interface RecommendRequest {
  facilities: RecommendFacility[];
  fanPreferences: {
    dietary?: string[];
    allergens?: string[];
    kidFriendly?: boolean;
  };
  language: string;
}

export interface RecommendResponse {
  recommendation: string;
  topPick: { facilityId: string; reason: string };
  comparison: { label: string; value: string }[];
  language: string;
}

function buildPrompt(request: RecommendRequest): string {
  const { facilities, fanPreferences, language } = request;

  const facilityDescriptions = facilities
    .map((f) => {
      const totalTime = f.queueEstimate + Math.ceil(f.distance / 80); // ~80m/min walking
      const dietary = f.dietaryOptions?.length
        ? `Dietary options: ${f.dietaryOptions.join(', ')}`
        : 'No dietary info';
      return `- ${f.name} (${f.type}): queue ${f.queueEstimate} min, distance ${f.distance}m (~${Math.ceil(f.distance / 80)} min walk), total time ~${totalTime} min. ${dietary}`;
    })
    .join('\n');

  const preferenceLines: string[] = [];
  if (fanPreferences.dietary?.length) {
    preferenceLines.push(`Dietary requirements: ${fanPreferences.dietary.join(', ')}`);
  }
  if (fanPreferences.allergens?.length) {
    preferenceLines.push(`Allergen sensitivities: ${fanPreferences.allergens.join(', ')}`);
  }
  if (fanPreferences.kidFriendly) {
    preferenceLines.push('Needs kid-friendly options');
  }

  const preferencesText = preferenceLines.length
    ? preferenceLines.join('\n')
    : 'No specific dietary preferences';

  const languageInstruction = getLanguageInstruction(language);

  return `You are a stadium facility recommendation assistant. Compare the following facility options and recommend the best one for this fan.

FACILITIES:
${facilityDescriptions}

FAN PREFERENCES:
${preferencesText}

INSTRUCTIONS:
- Compare options by total time (queue wait + walking time), dietary match, and accessibility
- Include at least one quantitative data point in your recommendation (e.g., time saved, distance difference)
- Be concise and helpful
- ${languageInstruction}

Respond in JSON format with this exact structure:
{
  "recommendation": "<natural language recommendation comparing the options>",
  "topPick": { "facilityId": "<id of best option>", "reason": "<brief reason>" },
  "comparison": [
    { "label": "<comparison metric>", "value": "<comparison value>" }
  ],
  "language": "${language}"
}`;
}

import { LANGUAGE_TONE_INSTRUCTIONS } from '@/i18n';
import type { LanguageCode } from '@/types/fan';

function getLanguageInstruction(language: string): string {
  const code = language as LanguageCode;
  const tone = LANGUAGE_TONE_INSTRUCTIONS[code] ?? LANGUAGE_TONE_INSTRUCTIONS['en'];
  return `Respond in language code "${language}". ${tone}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return NextResponse.json(
      {
        error: 'GEMINI_API_KEY is not configured. Set it in your environment variables.',
      },
      { status: 503 }
    );
  }

  let body: RecommendRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  if (!body.facilities || !Array.isArray(body.facilities) || body.facilities.length === 0) {
    return NextResponse.json(
      { error: 'At least one facility must be provided' },
      { status: 400 }
    );
  }

  if (!body.language) {
    body.language = 'en';
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = buildPrompt(body);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    clearTimeout(timeout);

    const responseText = result.response.text();
    let parsed: RecommendResponse;

    try {
      parsed = JSON.parse(responseText) as RecommendResponse;
    } catch {
      return NextResponse.json(
        {
          error: 'Failed to parse GenAI response',
          raw: responseText,
        },
        { status: 502 }
      );
    }

    // Ensure language field matches request
    parsed.language = body.language;

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    clearTimeout(timeout);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'GenAI request timed out after 5 seconds' },
        { status: 504 }
      );
    }

    const message =
      error instanceof Error ? error.message : 'Unknown error contacting GenAI service';

    return NextResponse.json(
      { error: `GenAI service error: ${message}` },
      { status: 502 }
    );
  }
}
