import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { ALLOWED_EXT, AVATAR_DIR, CODE_ALPHABET, UPLOAD_DIR } from './config.js';
import { HttpError } from './errors.js';
import {
  Announcement, Assignment, Classroom, Comment, Enrollment, StoredFile, Submission,
} from './models.js';

// ----------------------------------------------------------------- serializers
/** Stable 0-5 colour index derived from an id (the Flask app used id % 6). */
export const colorOf = (id) => parseInt(String(id).slice(-6), 16) % 6;

export const userDTO = (u) => ({
  id: String(u._id), name: u.name, email: u.email, role: u.role, photo: u.photo || null, color: colorOf(u._id),
});
/** Public view of a user (no e-mail), used where other students can see the person. */
export const miniUser = (u) => ({
  id: String(u._id), name: u.name, role: u.role, photo: u.photo || null, color: colorOf(u._id),
});

export const fileDTO = (f) => ({ id: String(f._id), name: f.originalName });

export const assignmentDTO = (a, files = []) => ({
  id: String(a._id),
  classroomId: String(a.classroom),
  title: a.title,
  instructions: a.instructions || '',
  points: a.points,
  dueAt: a.dueAt,
  createdAt: a.createdAt,
  isOverdue: !!(a.dueAt && a.dueAt < new Date()),
  files: files.map(fileDTO),
});

export const isLate = (sub, a) => !!(a.dueAt && sub.submittedAt > a.dueAt);

export const submissionDTO = (s, a, files = []) => ({
  id: String(s._id),
  submittedAt: s.submittedAt,
  isLate: isLate(s, a),
  grade: s.grade,
  feedback: s.feedback || '',
  files: files.map(fileDTO),
});

// ----------------------------------------------------------------- lookups & access checks
export async function findDoc(Model, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Model.findById(id);
}

/** Return the classroom if the user owns it (teacher) or is enrolled (student). */
export async function getClassForUser(user, id) {
  const c = await findDoc(Classroom, id);
  if (!c) throw new HttpError(404);
  if (user.role === 'teacher') {
    if (!c.teacher.equals(user._id)) throw new HttpError(403);
  } else if (!(await Enrollment.exists({ classroom: c._id, student: user._id }))) {
    throw new HttpError(403);
  }
  return c;
}

export async function getOwnedClass(user, id) {
  const c = await findDoc(Classroom, id);
  if (!c) throw new HttpError(404);
  if (!c.teacher.equals(user._id)) throw new HttpError(403);
  return c;
}

/** A profile photo is visible to its owner and to people who share a class with them. */
export async function canSeeUser(me, other) {
  if (other._id.equals(me._id)) return true;
  if (me.role === 'teacher') {
    const mine = await Classroom.distinct('_id', { teacher: me._id });
    return !!(await Enrollment.exists({ student: other._id, classroom: { $in: mine } }));
  }
  const myClasses = await Enrollment.distinct('classroom', { student: me._id });
  if (other.role === 'teacher') {
    return !!(await Classroom.exists({ teacher: other._id, _id: { $in: myClasses } }));
  }
  return !!(await Enrollment.exists({ student: other._id, classroom: { $in: myClasses } }));
}

export async function newCode() {
  for (;;) {
    let code = '';
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    if (!(await Classroom.exists({ code }))) return code;
  }
}

// ----------------------------------------------------------------- files
/** Same rules as werkzeug.utils.secure_filename. */
export function secureFilename(name) {
  const ascii = name.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
  const joined = ascii.replace(/[\\/]/g, ' ').trim().split(/\s+/).join('_');
  return joined.replace(/[^A-Za-z0-9_.-]/g, '').replace(/^[._]+|[._]+$/g, '');
}

/** Detect png / jpg / gif / webp from the real bytes, else null. */
export function sniffImage(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  const head6 = buf.subarray(0, 6).toString('latin1');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'gif';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF'
      && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

const unlinkQuiet = (file) => fs.promises.unlink(file).catch(() => {});
export const deleteAvatarFile = (name) => (name ? unlinkQuiet(path.join(AVATAR_DIR, name)) : undefined);

/** Store every valid uploaded file. Returns { saved, skipped: [original names] }. */
export async function saveUploads(files = [], owner) {
  let saved = 0;
  const skipped = [];
  for (const f of files) {
    if (!f || !f.originalname) continue;
    // multer hands us latin1-decoded names; restore the real UTF-8 text
    const original = Buffer.from(f.originalname, 'latin1').toString('utf8');
    const name = secureFilename(original);
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    if (!ALLOWED_EXT.has(ext)) {
      skipped.push(original);
      continue;
    }
    const stored = `${crypto.randomUUID().replace(/-/g, '')}.${ext}`;
    await fs.promises.writeFile(path.join(UPLOAD_DIR, stored), f.buffer);
    await StoredFile.create({ originalName: name, storedName: stored, ...owner });
    saved += 1;
  }
  return { saved, skipped };
}

// ----------------------------------------------------------------- cascading deletes
// (SQLAlchemy's cascade="all, delete-orphan" has no MongoDB equivalent, so it is explicit here)
export async function deleteStoredFile(f) {
  await unlinkQuiet(path.join(UPLOAD_DIR, f.storedName));
  await f.deleteOne();
}

async function removeStoredFiles(filter) {
  const files = await StoredFile.find(filter);
  await Promise.all(files.map((f) => unlinkQuiet(path.join(UPLOAD_DIR, f.storedName))));
  await StoredFile.deleteMany(filter);
}

export async function deleteSubmission(sub) {
  await removeStoredFiles({ submission: sub._id });
  await sub.deleteOne();
}

export async function deleteAssignment(a) {
  await removeStoredFiles({ assignment: a._id });
  for (const s of await Submission.find({ assignment: a._id })) await deleteSubmission(s);
  await a.deleteOne();
}

export async function deleteAnnouncement(n) {
  await Comment.deleteMany({ announcement: n._id });
  await n.deleteOne();
}

export async function deleteClassroom(c) {
  for (const a of await Assignment.find({ classroom: c._id })) await deleteAssignment(a);
  for (const n of await Announcement.find({ classroom: c._id })) await deleteAnnouncement(n);
  await Enrollment.deleteMany({ classroom: c._id });
  await c.deleteOne();
}
