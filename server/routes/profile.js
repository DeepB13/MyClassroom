import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { AVATAR_DIR } from '../config.js';
import { HttpError, asyncHandler } from '../errors.js';
import { requireLogin } from '../middleware/auth.js';
import { uploadPhoto } from '../middleware/upload.js';
import { Classroom, Enrollment } from '../models.js';
import { deleteAvatarFile, sniffImage, userDTO } from '../services.js';

const router = Router();

router.get('/', requireLogin(), asyncHandler(async (req, res) => {
  const me = req.user;
  const classCount = me.role === 'teacher'
    ? await Classroom.countDocuments({ teacher: me._id })
    : await Enrollment.countDocuments({ student: me._id });
  res.json({ classCount });
}));

router.put('/', requireLogin(), uploadPhoto, asyncHandler(async (req, res) => {
  const me = req.user;
  const name = String(req.body.name ?? '').split(/\s+/).filter(Boolean).join(' '); // trim + collapse spaces
  if (!name) throw new HttpError(400, 'Please enter your name.');

  let newPhoto = null;
  if (req.file && req.file.originalname) {
    const ext = sniffImage(req.file.buffer); // judge by the real bytes, not the file name
    if (!ext) throw new HttpError(400, 'Please choose a PNG, JPG, GIF or WebP image.');
    newPhoto = `${crypto.randomUUID().replace(/-/g, '')}.${ext}`;
    await fs.promises.writeFile(path.join(AVATAR_DIR, newPhoto), req.file.buffer);
  }
  me.name = name.slice(0, 100);
  if (newPhoto) {
    await deleteAvatarFile(me.photo);
    me.photo = newPhoto;
  }
  await me.save();
  res.json({ user: userDTO(me), message: 'Profile updated.' });
}));

router.delete('/photo', requireLogin(), asyncHandler(async (req, res) => {
  const me = req.user;
  if (me.photo) {
    await deleteAvatarFile(me.photo);
    me.photo = null;
    await me.save();
  }
  res.json({ user: userDTO(me), message: 'Profile photo removed.' });
}));

export default router;
