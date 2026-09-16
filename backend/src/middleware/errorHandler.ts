import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { formatZodError, summariseFieldErrors, FieldError } from './validator.js';

export class AppError extends Error {
  public statusCode: number;
  public errors?: FieldError[];

  constructor(message: string, statusCode: number, errors?: FieldError[]) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Field names as stored, mapped to what a user actually calls them.
const FIELD_LABELS: Record<string, string> = {
  _id: 'ID',
  email: 'email address',
  aadhaarNumber: 'Aadhaar number',
  roomNumber: 'room number',
  propertyName: 'property name',
  tokenHash: 'invitation link',
  tenant: 'tenant reference',
  property: 'property reference',
  room: 'room reference',
  bed: 'bed reference',
  owner: 'owner reference',
  key: 'setting key'
};

const labelFor = (field: string) => FIELD_LABELS[field] || field;

interface NormalisedError {
  statusCode: number;
  message: string;
  errors?: FieldError[];
}

/**
 * Maps the error types this app can actually produce onto clear, client-safe
 * responses. Without this, a duplicate key or a malformed id surfaces as a 500
 * carrying raw driver text such as "E11000 duplicate key error collection...".
 */
const normalise = (err: any): NormalisedError => {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, message: err.message, errors: err.errors };
  }

  // Validation that ran outside the validate() middleware.
  if (err instanceof ZodError) {
    const errors = formatZodError(err);
    return { statusCode: 400, message: summariseFieldErrors(errors), errors };
  }

  // Malformed ObjectId or an unparseable value for a typed field.
  if (err?.name === 'CastError') {
    const field = labelFor(err.path || 'reference');
    return {
      statusCode: 400,
      message: `The ${field} provided is not valid`,
      errors: [{ field: err.path || 'request', message: `Not a valid ${field}` }]
    };
  }

  // Mongoose schema validation (enum, min/max, required).
  if (err?.name === 'ValidationError' && err.errors) {
    const errors: FieldError[] = Object.entries(err.errors).map(([field, detail]: [string, any]) => ({
      field,
      message: detail?.message || `${labelFor(field)} is not valid`
    }));
    return { statusCode: 400, message: summariseFieldErrors(errors), errors };
  }

  // Unique index violation. For a compound index (for example property+roomNumber)
  // the last key is the one the user actually typed, so report that.
  if (err?.code === 11000) {
    const keyValue = err.keyValue || {};
    const keys = Object.keys(keyValue).length
      ? Object.keys(keyValue)
      : Object.keys(err.keyPattern || {});
    const field = keys[keys.length - 1] || 'value';
    const label = labelFor(field);
    const value = keyValue[field];
    return {
      statusCode: 409,
      message: value
        ? `That ${label} ("${value}") is already in use.`
        : `That ${label} is already in use.`,
      errors: [{ field, message: `This ${label} already exists` }]
    };
  }

  // Body parser rejected the payload.
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return { statusCode: 400, message: 'The request body is not valid JSON' };
  }
  if (err?.type === 'entity.too.large') {
    return { statusCode: 413, message: 'The request is too large. Please upload a smaller file.' };
  }

  // JWT failures that escaped a route handler.
  if (err?.name === 'TokenExpiredError') {
    return { statusCode: 401, message: 'Your session has expired. Please log in again.' };
  }
  if (err?.name === 'JsonWebTokenError') {
    return { statusCode: 401, message: 'Your session is not valid. Please log in again.' };
  }

  // Database unreachable.
  if (err?.name === 'MongoNetworkError' || err?.name === 'MongooseServerSelectionError') {
    return { statusCode: 503, message: 'The service is temporarily unavailable. Please try again shortly.' };
  }

  return { statusCode: err?.statusCode || 500, message: err?.message || 'Internal Server Error' };
};

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const { statusCode, message, errors } = normalise(err);

  // Server faults need the stack; expected 4xx responses are noise at that level.
  if (statusCode >= 500) {
    console.error(`[Error] ${statusCode} ${req.method} ${req.url} - ${message}`, err);
  } else {
    console.warn(`[Error] ${statusCode} ${req.method} ${req.url} - ${message}`);
  }

  // Never surface internal failure detail to the client.
  const clientMessage =
    statusCode >= 500 && process.env.NODE_ENV === 'production'
      ? 'Something went wrong on our side. Please try again.'
      : message;

  res.status(statusCode).json({
    status: 'error',
    message: clientMessage,
    ...(errors?.length ? { errors } : {}),
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500 ? { stack: err?.stack } : {})
  });
};

// Unknown API paths should answer in JSON like every other endpoint, not with
// Express's default HTML page.
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Cannot ${req.method} ${req.path}`
  });
};
