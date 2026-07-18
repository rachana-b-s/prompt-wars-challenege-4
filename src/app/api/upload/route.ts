import { NextRequest, NextResponse } from 'next/server';
import {
  StadiumUploadSchema,
  CrowdUploadSchema,
  FacilityUploadSchema,
  createCrowdUploadSchemaWithZones,
  createFacilityUploadSchemaWithZones,
} from '@/schemas';

/**
 * Upload API route for stadium, crowd, and facility data.
 *
 * Accepts multipart/form-data or application/json requests.
 * For multipart: expects "type" field (stadium|crowd|facility) and "file" field (JSON or CSV).
 * For application/json: expects { type, data } where data is the parsed object.
 *
 * Requirements: 7.1–7.8, 12.5
 */

type UploadType = 'stadium' | 'crowd' | 'facility';

interface UploadSuccessResponse {
  success: true;
  message: string;
  recordCount: number;
}

interface UploadErrorResponse {
  success: false;
  errors: { path: string; message: string }[];
}

/**
 * Parse CSV content into an array of objects using the first row as headers.
 */
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j].trim()] = values[j]?.trim() ?? '';
    }
    records.push(record);
  }

  return records;
}

/**
 * Parse a single CSV line handling quoted fields with commas.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);

  return result;
}

/**
 * Attempt to parse a string value into a typed value (number, boolean, JSON array/object).
 */
function coerceValue(value: string): unknown {
  if (value === '') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;

  const num = Number(value);
  if (!isNaN(num) && value.trim() !== '') return num;

  // Try parsing as JSON (for arrays and objects)
  if (
    (value.startsWith('[') && value.endsWith(']')) ||
    (value.startsWith('{') && value.endsWith('}'))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

/**
 * Convert CSV records into typed objects by coercing values.
 */
function coerceRecords(records: Record<string, string>[]): Record<string, unknown>[] {
  return records.map((record) => {
    const coerced: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      // Handle dot-notation for nested objects (e.g., "position.x" -> { position: { x } })
      if (key.includes('.')) {
        const parts = key.split('.');
        let target = coerced;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]] || typeof target[parts[i]] !== 'object') {
            target[parts[i]] = {};
          }
          target = target[parts[i]] as Record<string, unknown>;
        }
        target[parts[parts.length - 1]] = coerceValue(value);
      } else {
        coerced[key] = coerceValue(value);
      }
    }
    return coerced;
  });
}

/**
 * Transform CSV records into the expected schema shape based on upload type.
 */
function transformCsvToSchema(
  records: Record<string, unknown>[],
  type: UploadType
): unknown {
  switch (type) {
    case 'stadium':
      // CSV for stadium: each row is a zone. Edges would need a separate format.
      // Support a simplified approach: JSON is preferred for stadium, but we attempt
      // to parse rows as zones with a basic edge generation.
      return { zones: records, edges: [] };
    case 'crowd':
      return { densities: records };
    case 'facility':
      return { facilities: records };
    default:
      return records;
  }
}

/**
 * Determine file type from content or filename extension.
 */
function detectFileType(content: string, filename?: string): 'json' | 'csv' {
  if (filename) {
    if (filename.endsWith('.json')) return 'json';
    if (filename.endsWith('.csv')) return 'csv';
  }

  // Try to detect from content
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }

  return 'csv';
}

/**
 * Format Zod errors into user-friendly error objects.
 */
function formatZodErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/**
 * Validate data against the appropriate schema based on upload type.
 * For crowd and facility uploads, optionally validates referential integrity
 * against known zone IDs if provided.
 */
function validateUpload(
  data: unknown,
  type: UploadType,
  knownZoneIds?: Set<string>
): { success: true; recordCount: number } | { success: false; errors: { path: string; message: string }[] } {
  switch (type) {
    case 'stadium': {
      const result = StadiumUploadSchema.safeParse(data);
      if (result.success) {
        return { success: true, recordCount: result.data.zones.length };
      }
      return { success: false, errors: formatZodErrors(result.error) };
    }
    case 'crowd': {
      // First validate basic schema
      const basicResult = CrowdUploadSchema.safeParse(data);
      if (!basicResult.success) {
        return { success: false, errors: formatZodErrors(basicResult.error) };
      }

      // If we have known zone IDs, validate referential integrity
      if (knownZoneIds && knownZoneIds.size > 0) {
        const refSchema = createCrowdUploadSchemaWithZones(knownZoneIds);
        const refResult = refSchema.safeParse(data);
        if (!refResult.success) {
          return { success: false, errors: formatZodErrors(refResult.error) };
        }
      }

      return { success: true, recordCount: basicResult.data.densities.length };
    }
    case 'facility': {
      // First validate basic schema
      const basicResult = FacilityUploadSchema.safeParse(data);
      if (!basicResult.success) {
        return { success: false, errors: formatZodErrors(basicResult.error) };
      }

      // If we have known zone IDs, validate referential integrity
      if (knownZoneIds && knownZoneIds.size > 0) {
        const refSchema = createFacilityUploadSchemaWithZones(knownZoneIds);
        const refResult = refSchema.safeParse(data);
        if (!refResult.success) {
          return { success: false, errors: formatZodErrors(refResult.error) };
        }
      }

      return { success: true, recordCount: basicResult.data.facilities.length };
    }
    default:
      return {
        success: false,
        errors: [{ path: 'type', message: `Unknown upload type: "${type}". Must be "stadium", "crowd", or "facility".` }],
      };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadSuccessResponse | UploadErrorResponse>> {
  const contentType = request.headers.get('content-type') || '';

  let type: UploadType;
  let data: unknown;

  try {
    if (contentType.includes('multipart/form-data')) {
      // Handle multipart/form-data file upload
      const formData = await request.formData();
      const typeField = formData.get('type');
      const fileField = formData.get('file');

      if (!typeField || typeof typeField !== 'string') {
        return NextResponse.json(
          {
            success: false,
            errors: [{ path: 'type', message: 'Missing required "type" field. Must be "stadium", "crowd", or "facility".' }],
          },
          { status: 400 }
        );
      }

      if (!['stadium', 'crowd', 'facility'].includes(typeField)) {
        return NextResponse.json(
          {
            success: false,
            errors: [{ path: 'type', message: `Invalid type "${typeField}". Must be "stadium", "crowd", or "facility".` }],
          },
          { status: 400 }
        );
      }

      type = typeField as UploadType;

      if (!fileField || !(fileField instanceof File)) {
        return NextResponse.json(
          {
            success: false,
            errors: [{ path: 'file', message: 'Missing required "file" field. Upload a JSON or CSV file.' }],
          },
          { status: 400 }
        );
      }

      const fileContent = await fileField.text();
      const fileType = detectFileType(fileContent, fileField.name);

      if (fileType === 'json') {
        try {
          data = JSON.parse(fileContent);
        } catch {
          return NextResponse.json(
            {
              success: false,
              errors: [{ path: 'file', message: 'File contains invalid JSON. Please check the file format.' }],
            },
            { status: 400 }
          );
        }
      } else {
        // CSV parsing
        const records = parseCSV(fileContent);
        if (records.length === 0) {
          return NextResponse.json(
            {
              success: false,
              errors: [{ path: 'file', message: 'CSV file is empty or contains only headers.' }],
            },
            { status: 400 }
          );
        }
        const coerced = coerceRecords(records);
        data = transformCsvToSchema(coerced, type);
      }
    } else if (contentType.includes('application/json')) {
      // Handle direct JSON body upload
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          {
            success: false,
            errors: [{ path: '', message: 'Invalid JSON in request body.' }],
          },
          { status: 400 }
        );
      }

      if (!body || typeof body !== 'object') {
        return NextResponse.json(
          {
            success: false,
            errors: [{ path: '', message: 'Request body must be a JSON object with "type" and "data" fields.' }],
          },
          { status: 400 }
        );
      }

      const reqBody = body as Record<string, unknown>;

      if (!reqBody.type || typeof reqBody.type !== 'string') {
        return NextResponse.json(
          {
            success: false,
            errors: [{ path: 'type', message: 'Missing required "type" field. Must be "stadium", "crowd", or "facility".' }],
          },
          { status: 400 }
        );
      }

      if (!['stadium', 'crowd', 'facility'].includes(reqBody.type)) {
        return NextResponse.json(
          {
            success: false,
            errors: [{ path: 'type', message: `Invalid type "${reqBody.type}". Must be "stadium", "crowd", or "facility".` }],
          },
          { status: 400 }
        );
      }

      type = reqBody.type as UploadType;

      if (!reqBody.data) {
        return NextResponse.json(
          {
            success: false,
            errors: [{ path: 'data', message: 'Missing required "data" field containing the upload payload.' }],
          },
          { status: 400 }
        );
      }

      data = reqBody.data;
    } else {
      return NextResponse.json(
        {
          success: false,
          errors: [{ path: '', message: 'Unsupported content type. Use "multipart/form-data" for file uploads or "application/json" for direct data submission.' }],
        },
        { status: 415 }
      );
    }

    // Validate the data against the appropriate schema
    const validationResult = validateUpload(data, type);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          errors: validationResult.errors,
        },
        { status: 400 }
      );
    }

    // Build success message based on upload type
    const messages: Record<UploadType, string> = {
      stadium: 'Stadium data uploaded successfully',
      crowd: 'Crowd density data uploaded successfully',
      facility: 'Facility data uploaded successfully',
    };

    return NextResponse.json({
      success: true,
      message: messages[type],
      recordCount: validationResult.recordCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred during upload processing.';
    return NextResponse.json(
      {
        success: false,
        errors: [{ path: '', message }],
      },
      { status: 500 }
    );
  }
}
