/**
 * Application error types for the Smart Stadium Fan Navigator.
 */

export interface AppError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ValidationError extends AppError {
  field: string;
  value: unknown;
}

export interface ConstraintConflict {
  memberA: string;
  memberB: string;
  constraint: string;
  description: string;
}
