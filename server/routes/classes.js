import { Router } from 'express';
import { HttpError, asyncHandler } from '../errors.js';
import { requireLogin } from '../middleware/auth.js';
import { uploadFiles } from '../middleware/upload.js';
import {
  Announcement, Assignment, Classroom, Comment, Enrollment, Submission,
} from '../models.js';
import {
  assignmentDTO, colorOf, deleteClassroom, deleteSubmission, getClassForUser, getOwnedClass,
  isLate, miniUser, newCode, saveUploads, userDTO,
} from '../services.js';

const router = Router();

// Classes shown in the left navigation bar
router.get('/', requireLogin(), asyncHandler(async (req, res) => {
  let classes;
  if (req.user.role === 'teacher') {
    classes = await Classroom.find({ teacher: req.user._id }).sort({ createdAt: -1 }).limit(30);
  } else {
    const enr = await Enrollment.find({ student: req.user._id }).sort({ joinedAt: -1 }).limit(30).populate('classroom');
    classes = enr.map((e) => e.classroom).filter(Boolean);
  }
  res.json(classes.map((c) => ({ id: String(c._id), name: c.name, color: colorOf(c._id) })));
}));

router.post('/', requireLogin('teacher'), asyncHandler(async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  if (!name) throw new HttpError(400, 'Class name is required.');
  const c = await Classroom.create({
    name: name.slice(0, 100),
    section: String(req.body.section ?? '').trim().slice(0, 100),
    subject: String(req.body.subject ?? '').trim().slice(0, 100),
    code: await newCode(),
    teacher: req.user._id,
  });
  res.status(201).json({ id: String(c._id), message: `Class created! Share the code ${c.code} with your students.` });
}));

router.post('/join', requireLogin('student'), asyncHandler(async (req, res) => {
  const code = String(req.body.code ?? '').trim().toUpperCase();
  const c = await Classroom.findOne({ code });
  if (!c) throw new HttpError(400, 'No class found with that code.');
  if (await Enrollment.exists({ classroom: c._id, student: req.user._id })) {
    throw new HttpError(400, "You've already joined this class.");
  }
  try {
    await Enrollment.create({ classroom: c._id, student: req.user._id });
  } catch (e) {
    if (e.code === 11000) throw new HttpError(400, "You've already joined this class.");
    throw e;
  }
  res.json({ id: String(c._id), message: `Joined ${c.name}!` });
}));

router.delete('/:id', requireLogin('teacher'), asyncHandler(async (req, res) => {
  await deleteClassroom(await getOwnedClass(req.user, req.params.id));
  res.json({ message: 'Class deleted.' });
}));

router.post('/:id/leave', requireLogin('student'), asyncHandler(async (req, res) => {
  const c = await getClassForUser(req.user, req.params.id);
  await Enrollment.deleteMany({ classroom: c._id, student: req.user._id });
  const assignmentIds = await Assignment.distinct('_id', { classroom: c._id });
  for (const s of await Submission.find({ student: req.user._id, assignment: { $in: assignmentIds } })) {
    await deleteSubmission(s);
  }
  res.json({ message: `You left ${c.name}.` });
}));

// ---- the class page (different payload for the teacher and for students)
const commentDTO = (cm, me, ownsClass) => ({
  id: String(cm._id),
  text: cm.text,
  createdAt: cm.createdAt,
  user: miniUser(cm.user),
  canDelete: String(cm.user._id) === String(me._id) || ownsClass,
});

router.get('/:id', requireLogin(), asyncHandler(async (req, res) => {
  const me = req.user;
  const c = await getClassForUser(me, req.params.id);
  const [assignments, announcements] = await Promise.all([
    Assignment.find({ classroom: c._id }).sort({ createdAt: -1 }),
    Announcement.find({ classroom: c._id }).sort({ createdAt: -1 }),
  ]);
  const comments = await Comment.find({ announcement: { $in: announcements.map((n) => n._id) } })
    .sort({ createdAt: 1 })
    .populate('user');
  const ownsClass = me.role === 'teacher';
  const annDTO = (n, isNew) => ({
    id: String(n._id),
    text: n.text,
    createdAt: n.createdAt,
    isNew,
    comments: comments
      .filter((cm) => cm.user && n._id.equals(cm.announcement))
      .map((cm) => commentDTO(cm, me, ownsClass)),
  });
  const head = {
    id: String(c._id), name: c.name, section: c.section || '', subject: c.subject || '', color: colorOf(c._id),
  };

  if (me.role === 'teacher') {
    const [enrollments, counts] = await Promise.all([
      Enrollment.find({ classroom: c._id }).populate('student'),
      Submission.aggregate([
        { $match: { assignment: { $in: assignments.map((a) => a._id) } } },
        { $group: { _id: '$assignment', n: { $sum: 1 } } },
      ]),
    ]);
    const countBy = new Map(counts.map((r) => [String(r._id), r.n]));
    const students = enrollments
      .map((e) => e.student)
      .filter(Boolean)
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    return res.json({
      role: 'teacher',
      class: { ...head, code: c.code },
      studentCount: enrollments.length,
      assignments: assignments.map((a) => ({
        ...assignmentDTO(a), submittedCount: countBy.get(String(a._id)) || 0,
      })),
      announcements: announcements.map((n) => annDTO(n, false)),
      students: students.map(userDTO),
    });
  }

  // student
  await c.populate('teacher', 'name');
  const enr = await Enrollment.findOne({ classroom: c._id, student: me._id });
  const subs = await Submission.find({ student: me._id, assignment: { $in: assignments.map((a) => a._id) } });
  const subBy = new Map(subs.map((s) => [String(s.assignment), s]));
  res.json({
    role: 'student',
    class: { ...head, teacherName: c.teacher?.name || '' },
    assignments: assignments.map((a) => {
      const s = subBy.get(String(a._id));
      let state = 'todo';
      if (s && s.grade != null) state = 'graded';
      else if (s) state = 'submitted';
      else if (a.dueAt && a.dueAt < new Date()) state = 'missing';
      return { ...assignmentDTO(a), state, grade: s ? s.grade : null, isLate: s ? isLate(s, a) : false };
    }),
    announcements: announcements.map((n) => annDTO(n, n.createdAt > enr.seenAnnouncementsAt)),
  });
}));

router.post('/:id/announcements/seen', requireLogin('student'), asyncHandler(async (req, res) => {
  const c = await getClassForUser(req.user, req.params.id);
  await Enrollment.updateOne({ classroom: c._id, student: req.user._id }, { seenAnnouncementsAt: new Date() });
  res.status(204).end();
}));

router.post('/:id/announce', requireLogin('teacher'), asyncHandler(async (req, res) => {
  const c = await getOwnedClass(req.user, req.params.id);
  const text = String(req.body.text ?? '').trim();
  if (text) await Announcement.create({ classroom: c._id, text: text.slice(0, 5000) });
  res.status(201).json({ ok: true });
}));

router.post('/:id/assignments', requireLogin('teacher'), uploadFiles, asyncHandler(async (req, res) => {
  const c = await getOwnedClass(req.user, req.params.id);
  const title = String(req.body.title ?? '').trim();
  if (!title) throw new HttpError(400, 'Assignment title is required.');

  let dueAt = null;
  if (req.body.dueAt) {
    dueAt = new Date(req.body.dueAt);
    if (Number.isNaN(dueAt.getTime())) throw new HttpError(400, 'Invalid due date.');
  }
  const points = parseInt(req.body.points, 10);
  const a = await Assignment.create({
    classroom: c._id,
    title: title.slice(0, 150),
    instructions: String(req.body.instructions ?? '').trim(),
    points: points > 0 ? points : null,
    dueAt,
  });
  const { skipped } = await saveUploads(req.files, { assignment: a._id });
  res.status(201).json({
    id: String(a._id),
    message: `Assignment posted.${skipped.length ? ` Skipped unsupported files: ${skipped.join(', ')}` : ''}`,
  });
}));

export default router;
