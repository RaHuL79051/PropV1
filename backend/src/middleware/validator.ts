import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError, ZodIssue } from 'zod';

export interface FieldError {
  field: string;
  message: string;
}

// "body.address.city" -> "address.city"; the request section is noise to the client.
const toFieldName = (issue: ZodIssue): string => {
  const path = issue.path.filter((p) => !['body', 'query', 'params'].includes(String(p)));
  return path.length ? path.join('.') : 'request';
};

/**
 * Turns a ZodError into one message per field.
 *
 * A single value can trip several rules at once (an empty string is both "is
 * required" and "must be at least N characters"). Reporting every issue makes
 * the user read contradictory advice, so only the first issue per field is kept
 * — schemas are ordered so that is the most specific one.
 */
export const formatZodError = (error: ZodError): FieldError[] => {
  const seen = new Set<string>();
  const errors: FieldError[] = [];

  for (const issue of error.errors) {
    const field = toFieldName(issue);
    if (seen.has(field)) continue;
    seen.add(field);
    errors.push({ field, message: issue.message });
  }

  return errors;
};

// One sentence a client can show directly when it has nowhere to put field errors.
export const summariseFieldErrors = (errors: FieldError[]): string => {
  if (!errors.length) return 'The submitted details are not valid';
  if (errors.length === 1) return errors[0].message;
  return `${errors[0].message} (and ${errors.length - 1} other problem${errors.length > 2 ? 's' : ''})`;
};

export const validate = (schema: AnyZodObject) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = formatZodError(error);
        console.warn(
          `[Validation] ${req.method} ${req.url} rejected:`,
          errors.map((e) => `${e.field}: ${e.message}`).join('; ')
        );
        return res.status(400).json({
          status: 'error',
          message: summariseFieldErrors(errors),
          errors
        });
      }
      next(error);
    }
  };
};
