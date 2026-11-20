import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { COOKIE_SECURE, SECRET_KEY } from '../config.js';
import { HttpError } from '../errors.js';
import { User } from '../models.js';

const COOKIE = 'token';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

/** Create a session: a signed JWT in an HttpOnly cookie. The CSRF token lives inside the JWT. */
export function issueSession(res, user) {
  const csrf = crypto.randomBytes(16).toString('hex');
  const token = jwt.sign({ uid: String(user._id), csrf }, SECRET_KEY, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    maxAge: SEVEN_DAYS,
  });
  return csrf;
}

export const clearSession = (res) => res.clearCookie(COOKIE);

/** Equivalent of Flask's before_request: load the current user from the cookie. */
export async function loadUser(req, res, next) {
  req.user = null;
  req.csrf = '';
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, SECRET_KEY);
      req.user = await User.findById(payload.uid);
      req.csrf = payload.csrf;
    } catch {
      /* invalid / expired token -> treated as signed out */
    }
  }
  next();
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/**
 * CSRF protection for every state-changing request.
 *  - signed in: the X-CSRF-Token header must match the token stored inside the session JWT
 *  - signed out (login / signup): the body must be JSON, which a cross-site <form> cannot send
 */
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.user) {
    if (!safeEqual(req.get('X-CSRF-Token') || '', req.csrf)) {
      return next(new HttpError(400, 'Invalid or missing form token. Please refresh and retry.'));
    }
  } else if (!req.is('application/json')) {
    return next(new HttpError(400, 'Invalid request.'));
  }
  next();
}

/** requireLogin() or requireLogin('teacher') / requireLogin('student') */
export const requireLogin = (role) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Please sign in first.'));
  if (role && req.user.role !== role) return next(new HttpError(403));
  next();
};
