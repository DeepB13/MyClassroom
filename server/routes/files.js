import path from 'node:path';
import { Router } from 'express';
import { AVATAR_DIR, PHOTO_MIME, UPLOAD_DIR } from '../config.js';
import { HttpError, asyncHandler } from '../errors.js';
import { requireLogin } from '../middleware/auth.js';
import { Assignment, StoredFile, Submission, User } from '../models.js';
import { canSeeUser, findDoc, getClassForUser, getOwnedClass } from '../services.js';

const router = Router();


// Profile photos: only the owner and people who share a class with them
router.get('/avatar/:uid', requireLogin(), asyncHandler(async (req, res, next) => {
  const u = await findDoc(User, req.params.uid);
  if (!u || !u.photo || !(await canSeeUser(req.user, u))) throw new HttpError(404);
  const mime = PHOTO_MIME[u.photo.split('.').pop()];
  if (!mime) throw new HttpError(404);
  res.set('Content-Type', mime);
  res.set('Cache-Control', 'private, max-age=86400'); // the URL changes whenever the photo does
  res.sendFile(path.join(AVATAR_DIR, u.photo), (err) => {
    if (err && !res.headersSent) next(new HttpError(404));
  });
}));

// Uploaded files are never public: every download is permission-checked
router.get('/files/:fid', requireLogin(), asyncHandler(async (req, res, next) => {
  const f = await findDoc(StoredFile, req.params.fid);
  if (!f) throw new HttpError(404);
  if (f.assignment) {
    const a = await Assignment.findById(f.assignment);
    if (!a) throw new HttpError(404);
    await getClassForUser(req.user, a.classroom);
  } else {
    const sub = f.submission ? await Submission.findById(f.submission) : null;
    if (!sub) throw new HttpError(404);
    if (req.user.role === 'teacher') {
      const a = await Assignment.findById(sub.assignment);
      if (!a) throw new HttpError(404);
      await getOwnedClass(req.user, a.classroom);
    } else if (!sub.student.equals(req.user._id)) {
      throw new HttpError(403);
    }
  }
  res.download(path.join(UPLOAD_DIR, f.storedName), f.originalName, (err) => {
    if (err && !res.headersSent) next(new HttpError(404));
  });
}));

export default router;
