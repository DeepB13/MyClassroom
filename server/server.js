/**
 * MY CLASSROOM - MERN edition (Express + MongoDB API; the React client lives in ../client).
 *
 *   dev:   npm run dev            (from the project root: API on :5000, Vite on :5173)
 *   prod:  npm run build && npm start     (Express also serves client/dist)
 */
import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import mongoose from 'mongoose';
import { MAX_REQUEST_BYTES, MONGO_URI, PORT, ROOT_DIR } from './config.js';
import { HttpError, errorHandler } from './errors.js';
import { csrfGuard, loadUser } from './middleware/auth.js';
import announcementRoutes from './routes/announcements.js';
import assignmentRoutes from './routes/assignments.js';
import authRoutes from './routes/auth.js';
import classRoutes from './routes/classes.js';
import dashboardRoutes from './routes/dashboard.js';
import fileRoutes from './routes/files.js';
import profileRoutes from './routes/profile.js';

const app = express();
app.disable('x-powered-by');

// security headers
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  next();
});

// 25 MB per request
app.use((req, res, next) => {
  if (Number(req.headers['content-length'] || 0) > MAX_REQUEST_BYTES) {
    return next(new HttpError(413));
  }
  next();
});

app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// every API call: load the user from the session cookie, then enforce CSRF on writes
app.use('/api', loadUser, csrfGuard);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api', announcementRoutes);
app.use('/api', assignmentRoutes);
app.use('/api', fileRoutes);
app.use('/api', (req, res, next) => next(new HttpError(404)));

// production: serve the built React app
const dist = path.join(ROOT_DIR, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorHandler);

await mongoose.connect(MONGO_URI);
console.log(`MongoDB connected: ${mongoose.connection.name}`);
app.listen(PORT, () => console.log(`MY CLASSROOM API listening on http://localhost:${PORT}`));
