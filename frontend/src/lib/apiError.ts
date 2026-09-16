/**
 * Single place that turns anything thrown by an API call into a sentence worth
 * showing a user.
 *
 * The backend answers every failure with the same envelope:
 *   { status: 'error', message: string, errors?: [{ field, message }] }
 * `errors` carries the per-field detail; `message` already summarises it. This
 * helper prefers the field detail when there is exactly one problem (it is the
 * most actionable), and otherwise lists the fields so nothing is hidden.
 */

export interface ApiFieldError {
  field: string;
  message: string;
}

const NETWORK_MESSAGE =
  'Cannot reach the server. Check your connection and try again.';

const STATUS_FALLBACKS: Record<number, string> = {
  401: 'Your session has expired. Please log in again.',
  403: 'You do not have permission to do that.',
  404: 'We could not find what you were looking for.',
  409: 'That conflicts with something that already exists.',
  413: 'That file is too large. Please upload a smaller one.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on our side. Please try again.',
  502: 'An upstream service did not respond. Please try again.',
  503: 'The service is temporarily unavailable. Please try again shortly.'
};

/** Field-level problems, when the server supplied them. */
export const getApiFieldErrors = (err: any): ApiFieldError[] => {
  const errors = err?.response?.data?.errors;
  if (!Array.isArray(errors)) return [];
  return errors
    .filter((e: any) => e && typeof e.message === 'string')
    .map((e: any) => ({ field: String(e.field ?? ''), message: e.message }));
};

/** Human-readable label for a field path such as "address.city". */
const humanField = (field: string) =>
  field
    .split('.')
    .pop()!
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();

export const getApiErrorMessage = (err: any, fallback = 'Something went wrong. Please try again.'): string => {
  // Request never reached the server (offline, CORS, DNS, server down).
  if (err?.response === undefined) {
    if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
    if (err?.message && !/^Request failed/.test(err.message) && err?.request) return NETWORK_MESSAGE;
    if (err?.request) return NETWORK_MESSAGE;
  }

  const fieldErrors = getApiFieldErrors(err);
  if (fieldErrors.length === 1) {
    return fieldErrors[0].message;
  }
  if (fieldErrors.length > 1) {
    return fieldErrors.map((e) => `${humanField(e.field)}: ${e.message}`).join(' • ');
  }

  const message = err?.response?.data?.message;
  if (typeof message === 'string' && message.trim()) return message;

  const status = err?.response?.status;
  if (status && STATUS_FALLBACKS[status]) return STATUS_FALLBACKS[status];

  return fallback;
};

/** True when the failure is the licence paywall, which callers handle specially. */
export const isPaymentRequired = (err: any) => err?.response?.status === 402;
