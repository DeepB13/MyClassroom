import { Router } from 'express';
import { HttpError, asyncHandler } from '../errors.js';
import { requireLogin } from '../middleware/auth.js';
import { uploadFiles } from '../middleware/upload.js';
import { Assignment, Enrollment, StoredFile, Submission, User } from '../models.js';
import {
  assignmentDTO, deleteAssignment, deleteStoredFile, findDoc, getClassForUser,
  getOwnedClass, saveUploads, submissionDTO, userDTO,
} from '../services.js';

const router = Router();

async function getAssignmentForUser(user, id) {
  const a = await findDoc(Assignment, id);
  if (!a) throw new HttpError(404);
  const c = await getClassForUser(user, a.classroom);
  return { a, c };
}

router.get('/assignments/:id', requireLogin(), asyncHandler(async (req, res) => {
  const me = req.user;
  const { a, c } = await getAssignmentForUser(me, req.params.id);
  const files = await StoredFile.find({ assignment: a._id });
  const classroom = { id: String(c._id), name: c.name };

  if (me.role === 'teacher') {
    const [enrollments, subs] = await Promise.all([
      Enrollment.find({ classroom: c._id }).populate('student'),
      Submission.find({ assignment: a._id }),
    ]);
    const subFiles = await StoredFile.find({ submission: { $in: subs.map((s) => s._id) } });
    const subBy = new Map(subs.map((s) => [String(s.student), s]));
    const students = enrollments
      .map((e) => e.student)
      .filter(Boolean)
      .sort((x, y) => x.name.toLowerCase().localeCompare(y.name.toLowerCase()));
    return res.json({
      role: 'teacher',
      assignment: assignmentDTO(a, files),
      classroom,
      submittedCount: subs.length,
      enrolledCount: enrollments.length,
      rows: students.map((st) => {
        const s = subBy.get(String(st._id));
        return {
          student: userDTO(st),
          submission: s ? submissionDTO(s, a, subFiles.filter((f) => s._id.equals(f.submission))) : null,
        };
      }),
    });
  }

  const sub = await Submission.findOne({ assignment: a._id, student: me._id });
  const subFiles = sub ? await StoredFile.find({ submission: sub._id }) : [];
  res.json({
    role: 'student',
    assignment: assignmentDTO(a, files),
    classroom,
    submission: sub ? submissionDTO(sub, a, subFiles) : null,
  });
}));

router.delete('/assignments/:id', requireLogin('teacher'), asyncHandler(async (req, res) => {
  const a = await findDoc(Assignment, req.params.id);
  if (!a) throw new HttpError(404);
  await getOwnedClass(req.user, a.classroom);
  await deleteAssignment(a);
  res.json({ message: 'Assignment deleted.' });
}));

router.post('/assignments/:id/submit', requireLogin('student'), uploadFiles, asyncHandler(async (req, res) => {
  const { a } = await getAssignmentForUser(req.user, req.params.id);
  const uploads = (req.files || []).filter((f) => f && f.originalname);
  if (!uploads.length) throw new HttpError(400, 'Please choose at least one file to upload.');

  let sub = await Submission.findOne({ assignment: a._id, student: req.user._id });
  if (sub && sub.grade != null) {
    throw new HttpError(400, "This work has already been graded and can't be changed.");
  }
  const isNew = !sub;
  if (!sub) sub = await Submission.create({ assignment: a._id, student: req.user._id });

  const { saved, skipped } = await saveUploads(uploads, { submission: sub._id });
  if (!saved) {
    if (isNew) await sub.deleteOne(); // nothing valid was uploaded: don't leave an empty submission behind
    throw new HttpError(400, `Unsupported file type: ${skipped.join(', ')}`);
  }
  sub.submittedAt = new Date();
  await sub.save();
  res.json({ message: `Solution submitted.${skipped.length ? ` Skipped: ${skipped.join(', ')}` : ''}` });
}));

router.delete('/submissions/:sid/files/:fid', requireLogin('student'), asyncHandler(async (req, res) => {
  const f = await findDoc(StoredFile, req.params.fid);
  const sub = await findDoc(Submission, req.params.sid);
  if (!f || !sub) throw new HttpError(404);
  if (!sub.student.equals(req.user._id) || !f.submission || !f.submission.equals(sub._id)) {
    throw new HttpError(403);
  }
  if (sub.grade != null) throw new HttpError(400, "Graded work can't be changed.");
  await deleteStoredFile(f);
  res.status(204).end();
}));

router.post('/submissions/:sid/grade', requireLogin('teacher'), asyncHandler(async (req, res) => {
  const sub = await findDoc(Submission, req.params.sid);
  if (!sub) throw new HttpError(404);
  const a = await Assignment.findById(sub.assignment);
  if (!a) throw new HttpError(404);
  await getOwnedClass(req.user, a.classroom);

  const raw = String(req.body.grade ?? '').trim();
  const grade = raw ? Number(raw) : null;
  if (grade !== null && !Number.isFinite(grade)) throw new HttpError(400, 'Grade must be a number.');
  if (grade !== null && (grade < 0 || (a.points && grade > a.points))) {
    throw new HttpError(400, `Grade must be between 0 and ${a.points || 'the max'}.`);
  }
  sub.grade = grade;
  sub.feedback = String(req.body.feedback ?? '').trim().slice(0, 2000);
  await sub.save();
  const student = await User.findById(sub.student);
  res.json({ message: `Saved grade for ${student ? student.name : 'student'}.` });
}));

export default router;
