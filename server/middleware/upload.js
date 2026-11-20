import multer from 'multer';
import { MAX_PHOTO_BYTES, MAX_REQUEST_BYTES } from '../config.js';
import { HttpError } from '../errors.js';

function wrap(handler, limitStatus, limitMessage) {
  return (req, res, next) =>
    handler(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(limitStatus, limitMessage));
      if (err instanceof multer.MulterError) return next(new HttpError(400, err.message));
      next(err);
    });
}

const memory = multer.memoryStorage();

/** Assignment attachments and student solutions: field name "files", many allowed. */
export const uploadFiles = wrap(
  multer({ storage: memory, limits: { fileSize: MAX_REQUEST_BYTES, files: 20 } }).array('files', 20),
  413,
  'Upload too large (limit is 25 MB per submit).',
);

/** Profile photo: field name "photo", one file. */
export const uploadPhoto = wrap(
  multer({ storage: memory, limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }).single('photo'),
  400,
  'That photo is too big - please choose one under 3 MB.',
);
