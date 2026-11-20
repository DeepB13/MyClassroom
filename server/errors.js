const DEFAULT_MESSAGES = {
  400: 'Bad request.',
  401: 'Please sign in first.',
  403: "You don't have access to this page.",
  404: "We couldn't find that page.",
  413: 'Upload too large (limit is 25 MB per submit).',
};

export class HttpError extends Error {
  constructor(status, message) {
    super(message || DEFAULT_MESSAGES[status] || 'Error');
    this.status = status;
  }
}

/** Lets async route handlers throw: errors are forwarded to the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server.' : err.message });
}
