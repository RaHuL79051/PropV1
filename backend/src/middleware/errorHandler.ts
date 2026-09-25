import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
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

  // Prisma errors raised by the query engine.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation. For a compound index (for example
    // property+roomNumber) the last key is the one the user actually typed.
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | string | undefined) ?? [];
      const keys = Array.isArray(target) ? target : [String(target)];
      const field = keys[keys.length - 1] || 'value';
      const label = labelFor(field);
      return {
        statusCode: 409,
        message: `That ${label} is already in use.`,
        errors: [{ field, message: `This ${label} already exists` }]
      };
    }

    // Record required by the query (findUniqueOrThrow, update, delete, or a
    // required relation connect) was not found.
    if (err.code === 'P2025' || err.code === 'P2015') {
      return { statusCode: 404, message: 'The requested record could not be found' };
    }

    // Foreign key points at a row that does not exist.
    if (err.code === 'P2003') {
      const field = labelFor(String(err.meta?.field_name || 'reference'));
      return {
        statusCode: 400,
        message: `The ${field} provided does not exist`,
        errors: [{ field, message: `Not a valid ${field}` }]
      };
    }

    // Malformed value for a typed column — most commonly a non-UUID id string.
    if (err.code === 'P2023') {
      return {
        statusCode: 400,
        message: 'The reference provided is not valid',
        errors: [{ field: 'request', message: 'Not a valid reference' }]
      };
    }

    return { statusCode: 400, message: 'The submitted details are not valid' };
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return { statusCode: 400, message: 'The submitted details are not valid' };
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return { statusCode: 503, message: 'The service is temporarily unavailable. Please try again shortly.' };
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

  const clientMessage = message || err?.message || 'Internal Server Error';

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
