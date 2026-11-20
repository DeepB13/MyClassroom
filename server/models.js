import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const oid = (ref, required = true) => ({
  type: Schema.Types.ObjectId,
  ref,
  required,
  ...(required ? {} : { default: null }),
});

export const User = model('User', new Schema({
  name: { type: String, required: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['teacher', 'student'], required: true },
  photo: { type: String, default: null }, // file name inside instance/avatars
}));

export const Classroom = model('Classroom', new Schema({
  name: { type: String, required: true, maxlength: 100 },
  section: { type: String, default: '' },
  subject: { type: String, default: '' },
  code: { type: String, required: true, unique: true },
  teacher: oid('User'),
  createdAt: { type: Date, default: Date.now },
}));

const enrollmentSchema = new Schema({
  classroom: oid('Classroom'),
  student: oid('User'),
  joinedAt: { type: Date, default: Date.now },
  seenAnnouncementsAt: { type: Date, default: Date.now }, // for the "new announcement" bar
});
enrollmentSchema.index({ classroom: 1, student: 1 }, { unique: true });
export const Enrollment = model('Enrollment', enrollmentSchema);

export const Announcement = model('Announcement', new Schema({
  classroom: oid('Classroom'),
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}));

/** A comment under an announcement - written by the teacher or an enrolled student. */
export const Comment = model('Comment', new Schema({
  announcement: oid('Announcement'),
  user: oid('User'),
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}));

export const Assignment = model('Assignment', new Schema({
  classroom: oid('Classroom'),
  title: { type: String, required: true, maxlength: 150 },
  instructions: { type: String, default: '' },
  points: { type: Number, default: null },
  dueAt: { type: Date, default: null }, // date AND time
  createdAt: { type: Date, default: Date.now },
}));

const submissionSchema = new Schema({
  assignment: oid('Assignment'),
  student: oid('User'),
  submittedAt: { type: Date, default: Date.now },
  grade: { type: Number, default: null },
  feedback: { type: String, default: '' },
});
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
export const Submission = model('Submission', submissionSchema);

/** Belongs either to an assignment (teacher material) or a submission (student work). */
export const StoredFile = model('StoredFile', new Schema({
  originalName: { type: String, required: true },
  storedName: { type: String, required: true },
  assignment: oid('Assignment', false),
  submission: oid('Submission', false),
}));
