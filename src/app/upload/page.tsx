'use client';

/**
 * Data Upload Page — allows evaluators to upload stadium layout, crowd density,
 * and facility data in JSON or CSV format.
 *
 * Each upload section provides:
 * - File input accepting .json and .csv
 * - Upload progress indicator
 * - Success/error feedback with detailed validation error display
 *
 * Requirements: 7.1, 7.3, 7.4, 7.8
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';

type UploadType = 'stadium' | 'crowd' | 'facility';

interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadState {
  status: UploadStatus;
  fileName: string | null;
  errors: ValidationError[];
  successMessage: string | null;
}

const initialUploadState: UploadState = {
  status: 'idle',
  fileName: null,
  errors: [],
  successMessage: null,
};

export default function UploadPage() {
  const [stadiumUpload, setStadiumUpload] = useState<UploadState>(initialUploadState);
  const [crowdUpload, setCrowdUpload] = useState<UploadState>(initialUploadState);
  const [facilityUpload, setFacilityUpload] = useState<UploadState>(initialUploadState);

  const handleUpload = useCallback(
    async (file: File, type: UploadType, setState: (s: UploadState) => void) => {
      setState({
        status: 'uploading',
        fileName: file.name,
        errors: [],
        successMessage: null,
      });

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (response.ok) {
          setState({
            status: 'success',
            fileName: file.name,
            errors: [],
            successMessage: result.message || `${type} data uploaded successfully.`,
          });
        } else {
          setState({
            status: 'error',
            fileName: file.name,
            errors: result.errors || [{ field: 'file', message: result.message || 'Upload failed.' }],
            successMessage: null,
          });
        }
      } catch {
        setState({
          status: 'error',
          fileName: file.name,
          errors: [{ field: 'network', message: 'Network error. Please check your connection and try again.' }],
          successMessage: null,
        });
      }
    },
    []
  );

  return (
    <main
      className="min-h-screen bg-gray-50 dark:bg-gray-950 px-4 py-8"
      role="main"
      aria-label="Data Upload"
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Stadium Data Upload
            </h1>
            <Link
              href="/"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline focus:outline-2 focus:outline-blue-600 focus:outline-offset-2 rounded px-2 py-1"
            >
              Back to Navigator
            </Link>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Upload custom stadium layout, crowd density, and facility data in JSON or CSV format.
          </p>
        </header>

        {/* Upload sections */}
        <div className="space-y-6">
          <UploadCard
            title="Stadium Layout"
            description="Upload stadium zone layout including zones, edges, accessibility features, and allegiance designations."
            type="stadium"
            state={stadiumUpload}
            onUpload={(file) => handleUpload(file, 'stadium', setStadiumUpload)}
            onReset={() => setStadiumUpload(initialUploadState)}
          />

          <UploadCard
            title="Crowd Data"
            description="Upload real-time crowd density data to update the Crowd Monitor with per-zone density levels."
            type="crowd"
            state={crowdUpload}
            onUpload={(file) => handleUpload(file, 'crowd', setCrowdUpload)}
            onReset={() => setCrowdUpload(initialUploadState)}
          />

          <UploadCard
            title="Facility Data"
            description="Upload facility information including type, location, operating status, accessibility, and category-specific attributes."
            type="facility"
            state={facilityUpload}
            onUpload={(file) => handleUpload(file, 'facility', setFacilityUpload)}
            onReset={() => setFacilityUpload(initialUploadState)}
          />
        </div>
      </div>
    </main>
  );
}

/**
 * Upload card component for a single data type.
 */
function UploadCard({
  title,
  description,
  type,
  state,
  onUpload,
  onReset,
}: {
  title: string;
  description: string;
  type: UploadType;
  state: UploadState;
  onUpload: (file: File) => void;
  onReset: () => void;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    // Reset the input so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <section
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm"
      aria-labelledby={`upload-title-${type}`}
    >
      <h2
        id={`upload-title-${type}`}
        className="text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        {title}
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {description}
      </p>

      {/* File input area */}
      <div className="mt-4">
        <label
          htmlFor={`file-input-${type}`}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          Select a file (.json or .csv)
        </label>
        <div className="flex items-center gap-3">
          <input
            id={`file-input-${type}`}
            type="file"
            accept=".json,.csv"
            onChange={handleFileChange}
            disabled={state.status === 'uploading'}
            className="block w-full text-sm text-gray-500 dark:text-gray-400
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-medium
              file:bg-blue-50 file:text-blue-700
              dark:file:bg-blue-900 dark:file:text-blue-200
              hover:file:bg-blue-100 dark:hover:file:bg-blue-800
              file:cursor-pointer
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-2 focus:outline-blue-600 focus:outline-offset-2 rounded"
            aria-describedby={`upload-status-${type}`}
          />
          {(state.status === 'success' || state.status === 'error') && (
            <button
              onClick={onReset}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline focus:outline-2 focus:outline-blue-600 focus:outline-offset-2 rounded"
              aria-label={`Reset ${title} upload`}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Status feedback */}
      <div
        id={`upload-status-${type}`}
        className="mt-4"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {state.status === 'uploading' && (
          <UploadProgress fileName={state.fileName} />
        )}
        {state.status === 'success' && (
          <SuccessFeedback message={state.successMessage} fileName={state.fileName} />
        )}
        {state.status === 'error' && (
          <ErrorFeedback errors={state.errors} fileName={state.fileName} />
        )}
      </div>
    </section>
  );
}

/**
 * Upload progress indicator with animated spinner.
 */
function UploadProgress({ fileName }: { fileName: string | null }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded">
      <svg
        className="animate-spin h-5 w-5 text-blue-600 dark:text-blue-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="text-sm text-blue-700 dark:text-blue-300">
        Uploading {fileName ? <span className="font-medium">{fileName}</span> : 'file'}...
      </span>
    </div>
  );
}

/**
 * Success feedback with check icon.
 */
function SuccessFeedback({
  message,
  fileName,
}: {
  message: string | null;
  fileName: string | null;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded">
      <svg
        className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          clipRule="evenodd"
        />
      </svg>
      <div>
        <p className="text-sm font-medium text-green-700 dark:text-green-300">
          {message || 'Upload successful.'}
        </p>
        {fileName && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
            File: {fileName}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Error feedback with validation error list.
 */
function ErrorFeedback({
  errors,
  fileName,
}: {
  errors: ValidationError[];
  fileName: string | null;
}) {
  return (
    <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
      <div className="flex items-start gap-3">
        <svg
          className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            Upload failed{fileName ? ` for ${fileName}` : ''}.
          </p>
          {errors.length > 0 && (
            <ul className="mt-2 space-y-1" aria-label="Validation errors">
              {errors.map((error, index) => (
                <li key={index} className="text-xs text-red-600 dark:text-red-400">
                  <span className="font-mono font-medium">{error.field}</span>
                  {': '}
                  {error.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
