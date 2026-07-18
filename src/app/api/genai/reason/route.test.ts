import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

// Mock the Google Generative AI module
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              reasoning: 'This route was selected because it avoids high-density zones.',
              dataPoints: [{ label: 'Gate C density', value: '85%' }],
              language: 'en',
            }),
          },
        }),
      }),
    })),
  };
});

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/genai/reason', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  route: {
    path: ['gate-a', 'concourse-north', 'section-101'],
    distance: 350,
    estimatedTime: 180,
    warnings: [{ type: 'high_density', message: 'Zone at 85% capacity', zone: 'concourse-north' }],
  },
  constraints: {
    stepFreeRequired: true,
    avoidHighDensity: true,
    preferQuiet: false,
  },
  crowdData: {
    'gate-a': 30,
    'concourse-north': 85,
    'section-101': 45,
  },
  fanProfile: {
    allegiance: 'home',
    accessibility: ['wheelchair'],
  },
  language: 'en',
};

describe('POST /api/genai/reason', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-api-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 500 when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;

    const req = createRequest(validBody);
    const res = await POST(req);

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain('GEMINI_API_KEY');
  });

  it('returns 400 when request body is invalid JSON', async () => {
    const req = new NextRequest('http://localhost:3000/api/genai/reason', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Invalid JSON');
  });

  it('returns 400 when route field is missing', async () => {
    const body = { ...validBody, route: undefined };
    const req = createRequest(body);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('route');
  });

  it('returns 400 when route.path is empty', async () => {
    const body = { ...validBody, route: { ...validBody.route, path: [] } };
    const req = createRequest(body);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('path');
  });

  it('returns 400 when route.distance is not positive', async () => {
    const body = { ...validBody, route: { ...validBody.route, distance: 0 } };
    const req = createRequest(body);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('distance');
  });

  it('returns 400 when constraints is missing', async () => {
    const body = { ...validBody, constraints: undefined };
    const req = createRequest(body);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('constraints');
  });

  it('returns 400 when language is missing', async () => {
    const body = { ...validBody, language: undefined };
    const req = createRequest(body);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('language');
  });

  it('returns GenAIResponse with reasoning and data points on success', async () => {
    const req = createRequest(validBody);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reasoning).toBeDefined();
    expect(json.dataPoints).toBeDefined();
    expect(json.dataPoints.length).toBeGreaterThanOrEqual(1);
    expect(json.language).toBe('en');
  });

  it('returns 400 when fanProfile is missing', async () => {
    const body = { ...validBody, fanProfile: undefined };
    const req = createRequest(body);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('fanProfile');
  });

  it('returns 400 when crowdData is missing', async () => {
    const body = { ...validBody, crowdData: undefined };
    const req = createRequest(body);
    const res = await POST(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('crowdData');
  });
});
