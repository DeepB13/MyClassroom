import { Router } from 'express';
import { HttpError, asyncHandler } from '../errors.js';
import { requireLogin } from '../middleware/auth.js';
import { Announcement, Comment } from '../models.js';
import { deleteAnnouncement, findDoc, getClassForUser, getOwnedClass } from '../services.js';

const router = Router();

router.delete('/announcements/:id', requireLogin('teacher'), asyncHandler(async (req, res) => {
  const n = await findDoc(Announcement, req.params.id);
  if (!n) throw new HttpError(404);
  await getOwnedClass(req.user, n.classroom);
  await deleteAnnouncement(n);
  res.status(204).end();
}));

// teacher of the class or an enrolled student only
router.post('/announcements/:id/comments', requireLogin(), asyncHandler(async (req, res) => {
  const n = await findDoc(Announcement, req.params.id);
  if (!n) throw new HttpError(404);
  await getClassForUser(req.user, n.classroom);
  const text = String(req.body.text ?? '').trim();
  if (text) await Comment.create({ announcement: n._id, user: req.user._id, text: text.slice(0, 1000) });
  res.status(201).json({ ok: true });
}));

// the author can delete their own comment; the class teacher can delete any
router.delete('/comments/:id', requireLogin(), asyncHandler(async (req, res) => {
  const cm = await findDoc(Comment, req.params.id);
  if (!cm) throw new HttpError(404);
  const ann = await Announcement.findById(cm.announcement);
  if (!ann) throw new HttpError(404);
  const cls = await getClassForUser(req.user, ann.classroom);
  const isAuthor = cm.user.equals(req.user._id);
  const isClassTeacher = req.user.role === 'teacher' && cls.teacher.equals(req.user._id);
  if (!isAuthor && !isClassTeacher) throw new HttpError(403);
  await cm.deleteOne();
  res.status(204).end();
}));

export default router;
