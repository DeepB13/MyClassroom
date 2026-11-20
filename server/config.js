import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const INSTANCE_DIR = path.join(ROOT_DIR, 'instance');
export const UPLOAD_DIR = path.join(INSTANCE_DIR, 'uploads');
export const AVATAR_DIR = path.join(INSTANCE_DIR, 'avatars');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(AVATAR_DIR, { recursive: true });

/** Use SECRET_KEY from env, otherwise create one once and keep it on disk. */
function loadSecretKey() {
  if (process.env.SECRET_KEY) return process.env.SECRET_KEY;
  const file = path.join(INSTANCE_DIR, 'secret_key');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  }
  return fs.readFileSync(file, 'utf8').trim();
}

export const SECRET_KEY = loadSecretKey();
export const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/myclassroom';
export const PORT = Number(process.env.PORT) || 5000;
export const COOKIE_SECURE = process.env.COOKIE_SECURE === '1';

export const MAX_REQUEST_BYTES = 25 * 1024 * 1024; // 25 MB per request
export const MAX_PHOTO_BYTES = 3 * 1024 * 1024; // profile photos: 3 MB

export const ALLOWED_EXT = new Set([
  'pdf', 'doc', 'docx', 'txt', 'md', 'csv', 'png', 'jpg', 'jpeg', 'gif', 'ppt', 'pptx',
  'xls', 'xlsx', 'zip', 'py', 'java', 'c', 'cpp', 'js', 'html', 'ipynb',
]);
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing 0/O/1/I
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const PHOTO_MIME = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
