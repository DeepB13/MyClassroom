import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { EMAIL_RE } from '../config.js';
import { HttpError, asyncHandler } from '../errors.js';
import { clearSession, issueSession } from '../middleware/auth.js';
import { User } from '../models.js';
import { userDTO } from '../services.js';

const router = Router();

// Who am I? Used by the React app on start-up (also hands out the CSRF token).
router.get('/me', (req, res) => {
  res.json(req.user ? { user: userDTO(req.user), csrf: req.csrf } : { user: null });
});

router.post('/signup', asyncHandler(async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const pw = String(req.body.password ?? '');
  const role = String(req.body.role ?? '');

  let error = null;
  if (!name) error = 'Please enter your name.';
  else if (!EMAIL_RE.test(email)) error = 'Please enter a valid email address.';
  else if (pw.length < 8) error = 'Password must be at least 8 characters.';
  else if (!['teacher', 'student'].includes(role)) error = 'Please choose Teacher or Student.';
  else if (await User.exists({ email })) error = 'An account with this email already exists.';
  if (error) throw new HttpError(400, error);

  let user;
  try {
    user = await User.create({
      name: name.slice(0, 100), email, role, passwordHash: await bcrypt.hash(pw, 10),
    });
  } catch (e) {
    if (e.code === 11000) throw new HttpError(400, 'An account with this email already exists.');
    throw e;
  }
  const csrf = issueSession(res, user);
  res.status(201).json({ user: userDTO(user), csrf });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const user = await User.findOne({ email });
  const ok = user && (await bcrypt.compare(String(req.body.password ?? ''), user.passwordHash));
  if (!ok) throw new HttpError(401, 'Incorrect email or password.');
  const csrf = issueSession(res, user);
  res.json({ user: userDTO(user), csrf });
}));

router.post('/logout', (req, res) => {
  clearSession(res);
  res.status(204).end();
});

export default router;
