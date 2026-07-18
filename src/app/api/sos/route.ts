import { NextRequest, NextResponse } from 'next/server';
import type { SOSAlert, LostChildProtocol } from '@/types/emergency';

// In-memory stores for demo purposes
const sosAlerts: SOSAlert[] = [];
const lostChildReports: LostChildProtocol[] = [];

/**
 * Validates an SOSAlert payload has all required fields.
 */
function validateSOSAlert(body: Record<string, unknown>): { valid: boolean; error?: string } {
  if (!body.id || typeof body.id !== 'string') {
    return { valid: false, error: 'Missing or invalid "id" field: must be a non-empty string' };
  }
  if (!body.zone || typeof body.zone !== 'string') {
    return { valid: false, error: 'Missing or invalid "zone" field: must be a non-empty string' };
  }
  if (typeof body.timestamp !== 'number' || body.timestamp <= 0) {
    return { valid: false, error: 'Missing or invalid "timestamp" field: must be a positive number' };
  }
  const validTypes = ['medical', 'security', 'general'];
  if (!body.type || typeof body.type !== 'string' || !validTypes.includes(body.type)) {
    return { valid: false, error: 'Missing or invalid "type" field: must be one of "medical", "security", "general"' };
  }
  if (body.description !== undefined && typeof body.description !== 'string') {
    return { valid: false, error: 'Invalid "description" field: must be a string if provided' };
  }
  return { valid: true };
}

/**
 * Validates a LostChildProtocol payload has all required fields.
 */
function validateLostChildProtocol(body: Record<string, unknown>): { valid: boolean; error?: string } {
  if (!body.id || typeof body.id !== 'string') {
    return { valid: false, error: 'Missing or invalid "id" field: must be a non-empty string' };
  }
  if (typeof body.childAge !== 'number' || body.childAge <= 0) {
    return { valid: false, error: 'Missing or invalid "childAge" field: must be a positive number' };
  }
  if (!body.childDescription || typeof body.childDescription !== 'string') {
    return { valid: false, error: 'Missing or invalid "childDescription" field: must be a non-empty string' };
  }
  if (!body.lastKnownZone || typeof body.lastKnownZone !== 'string') {
    return { valid: false, error: 'Missing or invalid "lastKnownZone" field: must be a non-empty string' };
  }
  if (typeof body.timestamp !== 'number' || body.timestamp <= 0) {
    return { valid: false, error: 'Missing or invalid "timestamp" field: must be a positive number' };
  }
  if (!body.contactInfo || typeof body.contactInfo !== 'string') {
    return { valid: false, error: 'Missing or invalid "contactInfo" field: must be a non-empty string' };
  }
  return { valid: true };
}

/**
 * Determines whether the payload is a LostChildProtocol (has childAge field)
 * or an SOSAlert.
 */
function isLostChildPayload(body: Record<string, unknown>): boolean {
  return body.childAge !== undefined;
}

/**
 * POST /api/sos
 * Accepts SOSAlert or LostChildProtocol payloads.
 * Returns acknowledgment within 3 seconds (SOS) / 5 seconds (lost child).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { error: 'Request body must be a JSON object' },
      { status: 400 }
    );
  }

  const payload = body as Record<string, unknown>;

  if (isLostChildPayload(payload)) {
    // Validate as LostChildProtocol
    const validation = validateLostChildProtocol(payload);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const report: LostChildProtocol = {
      id: payload.id as string,
      childAge: payload.childAge as number,
      childDescription: payload.childDescription as string,
      lastKnownZone: payload.lastKnownZone as string,
      timestamp: payload.timestamp as number,
      contactInfo: payload.contactInfo as string,
    };

    lostChildReports.push(report);

    return NextResponse.json({
      acknowledged: true,
      type: 'lost_child',
      id: report.id,
    });
  }

  // Validate as SOSAlert
  const validation = validateSOSAlert(payload);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  const alert: SOSAlert = {
    id: payload.id as string,
    zone: payload.zone as string,
    timestamp: payload.timestamp as number,
    type: payload.type as 'medical' | 'security' | 'general',
    description: payload.description as string | undefined,
  };

  sosAlerts.push(alert);

  return NextResponse.json({
    acknowledged: true,
    type: 'sos',
    id: alert.id,
  });
}

/**
 * GET /api/sos
 * Retrieves all stored alerts (for admin/demo purposes).
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ sosAlerts, lostChildReports });
}
