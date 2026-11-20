import { Router } from 'express';
import { asyncHandler } from '../errors.js';
import { requireLogin } from '../middleware/auth.js';
import { Announcement, Assignment, Classroom, Enrollment, Submission } from '../models.js';
import { colorOf } from '../services.js';

const router = Router();

const baseClass = (c) => ({
  id: String(c._id), name: c.name, section: c.section || '', subject: c.subject || '', color: colorOf(c._id),
});

router.get('/', requireLogin(), asyncHandler(async (req, res) => {
  const me = req.user;
  const now = new Date();

  if (me.role === 'teacher') {
    const classes = await Classroom.find({ teacher: me._id }).sort({ createdAt: -1 });
    const ids = classes.map((c) => c._id);
    const [enrollments, assignments] = await Promise.all([
      Enrollment.find({ classroom: { $in: ids } }, 'classroom student'),
      Assignment.find({ classroom: { $in: ids } }),
    ]);
    const subs = await Submission.find({ assignment: { $in: assignments.map((a) => a._id) } }, 'grade');

    const cards = classes.map((c) => {
      const upcoming = assignments
        .filter((a) => c._id.equals(a.classroom) && a.dueAt && a.dueAt >= now)
        .sort((x, y) => x.dueAt - y.dueAt)[0];
      return {
        ...baseClass(c),
        code: c.code,
        studentCount: enrollments.filter((e) => c._id.equals(e.classroom)).length,
        nextDue: upcoming ? { id: String(upcoming._id), dueAt: upcoming.dueAt } : null,
      };
    });
    return res.json({
      role: 'teacher',
      classes: cards,
      pending: subs.filter((s) => s.grade == null).length,
      studentsTotal: new Set(enrollments.map((e) => String(e.student))).size,
      assignmentsTotal: assignments.length,
    });
  }

  // student
  const enrollments = await Enrollment.find({ student: me._id })
    .sort({ joinedAt: -1 })
    .populate({ path: 'classroom', populate: { path: 'teacher', select: 'name' } });
  const live = enrollments.filter((e) => e.classroom);
  const classIds = live.map((e) => e.classroom._id);
  const [assignments, mySubs] = await Promise.all([
    Assignment.find({ classroom: { $in: classIds } }),
    Submission.find({ student: me._id }, 'assignment'),
  ]);
  const mine = new Set(mySubs.map((s) => String(s.assignment)));
  const todo = assignments
    .filter((a) => !mine.has(String(a._id)))
    .sort((a, b) => (a.dueAt ? 0 : 1) - (b.dueAt ? 0 : 1) || (a.dueAt ?? 0) - (b.dueAt ?? 0));

  // per class: the next unsubmitted assignment, and the count of announcements not seen yet
  const nextDue = new Map();
  for (const a of todo) if (!nextDue.has(String(a.classroom))) nextDue.set(String(a.classroom), a);

  const cards = [];
  for (const e of live) {
    const c = e.classroom;
    const nd = nextDue.get(String(c._id));
    cards.push({
      ...baseClass(c),
      teacherName: c.teacher?.name || '',
      unread: await Announcement.countDocuments({ classroom: c._id, createdAt: { $gt: e.seenAnnouncementsAt } }),
      nextDue: nd ? { id: String(nd._id), dueAt: nd.dueAt, isOverdue: !!(nd.dueAt && nd.dueAt < now) } : null,
    });
  }

  const classNames = new Map(live.map((e) => [String(e.classroom._id), e.classroom.name]));
  res.json({
    role: 'student',
    classes: cards,
    todo: todo.slice(0, 8).map((a) => ({
      id: String(a._id),
      title: a.title,
      className: classNames.get(String(a.classroom)),
      dueAt: a.dueAt,
      isOverdue: !!(a.dueAt && a.dueAt < now),
    })),
    todoCount: todo.length,
    overdueCount: todo.filter((a) => a.dueAt && a.dueAt < now).length,
    submittedCount: mySubs.length,
  });
}));

export default router;
