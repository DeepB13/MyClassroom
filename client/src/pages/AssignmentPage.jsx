import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Avatar from '../components/Avatar.jsx';
import ErrorView from '../components/ErrorView.jsx';
import Icon from '../components/Icon.jsx';
import { useActiveClass } from '../components/Layout.jsx';
import { fmtDt, fmtDue, fmtGrade } from '../format.js';
import { useAction, useLoad, useTitle } from '../hooks.js';

export default function AssignmentPage() {
  const { id } = useParams();
  const { data, error, reload } = useLoad(`/assignments/${id}`);
  useActiveClass(data ? data.classroom.id : null);
  useTitle(data ? data.assignment.title : '');
  if (error) return <ErrorView error={error} />;
  if (!data) return null;
  return data.role === 'teacher' ? <TeacherView data={data} reload={reload} /> : <StudentView data={data} reload={reload} />;
}

const FileLink = ({ f }) => <a className="file" href={`/api/files/${f.id}`}>📎 {f.name}</a>;

function BackLink({ classroom }) {
  return <Link className="back" to={`/classes/${classroom.id}`}><Icon name="back" size={16} /> {classroom.name}</Link>;
}

// ============================================================================ teacher
function GradeForm({ a, s, onSaved }) {
  const run = useAction();
  const save = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = { grade: fd.get('grade'), feedback: fd.get('feedback') };
    if (await run(() => api(`/submissions/${s.id}/grade`, { method: 'POST', body }))) onSaved();
  };
  return (
    <form className="gradeform" onSubmit={save}>
      <label>Grade{' '}
        <input
          type="number" step="any" min="0" max={a.points || undefined} name="grade"
          defaultValue={s.grade != null ? fmtGrade(s.grade) : ''}
        />{' '}
        {a.points ? <small>/ {a.points}</small> : null}
      </label>
      <label className="grow">Feedback <input name="feedback" defaultValue={s.feedback || ''} maxLength={2000} /></label>
      <button className="btn small">Save</button>
    </form>
  );
}

function TeacherView({ data, reload }) {
  const { assignment: a, classroom, rows, submittedCount, enrolledCount } = data;
  return (
    <>
      <BackLink classroom={classroom} />
      <div className="card">
        <h1>{a.title}</h1>
        <p className="muted">Due {fmtDue(a.dueAt)}{a.points ? ` · ${a.points} points` : ''}</p>
        {a.instructions && <p className="pre">{a.instructions}</p>}
        {a.files.map((f) => <FileLink key={f.id} f={f} />)}
      </div>

      <h2>Student submissions ({submittedCount}/{enrolledCount})</h2>
      {rows.length === 0 && <div className="empty"><p>No students enrolled yet.</p></div>}
      {rows.map(({ student: st, submission: s }) => (
        <div className="card sub" key={st.id}>
          <div className="subhead">
            <div className="person">
              <Avatar user={st} />
              <div><b>{st.name}</b><br /><small className="muted">{st.email}</small></div>
            </div>
            {s
              ? <span className={`pill ${s.isLate ? 'late' : 'done'}`}>Submitted {fmtDt(s.submittedAt)}{s.isLate ? ' · late' : ''}</span>
              : <span className="pill todo">Not submitted</span>}
          </div>
          {s && (
            <>
              <div>
                {s.files.length > 0
                  ? s.files.map((f) => <FileLink key={f.id} f={f} />)
                  : <small className="muted">No files.</small>}
              </div>
              <GradeForm key={`${s.id}-${s.grade}-${s.feedback}`} a={a} s={s} onSaved={reload} />
            </>
          )}
        </div>
      ))}
    </>
  );
}

// ============================================================================ student
function StudentView({ data, reload }) {
  const run = useAction();
  const { assignment: a, classroom, submission: sub } = data;
  const graded = sub && sub.grade != null;

  const submit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (await run(() => api(`/assignments/${a.id}/submit`, { method: 'POST', form: new FormData(form) }))) {
      form.reset();
      reload();
    }
  };

  const removeFile = async (f) => {
    if (!window.confirm('Remove this file?')) return;
    if (await run(() => api(`/submissions/${sub.id}/files/${f.id}`, { method: 'DELETE' }))) reload();
  };

  return (
    <>
      <BackLink classroom={classroom} />
      <div className="split">
        <section className="card">
          <h1>{a.title}</h1>
          <p className="muted">Posted {fmtDt(a.createdAt)} · Due {fmtDue(a.dueAt)}{a.points ? ` · ${a.points} points` : ''}</p>
          {a.instructions ? <p className="pre">{a.instructions}</p> : <p className="muted">No instructions.</p>}
          {a.files.map((f) => <FileLink key={f.id} f={f} />)}
        </section>

        <aside className="card">
          <h3>Your work</h3>
          {sub ? (
            <>
              <p>
                {graded
                  ? <span className="pill graded">Graded</span>
                  : <span className={`pill ${sub.isLate ? 'late' : 'done'}`}>Submitted{sub.isLate ? ' (late)' : ''}</span>}{' '}
                <small className="muted">{fmtDt(sub.submittedAt)}</small>
              </p>
              {graded && (
                <>
                  <p className="bigscore">{fmtGrade(sub.grade)}{a.points ? <> <small>/ {a.points}</small></> : null}</p>
                  {sub.feedback && <p className="pre"><b>Feedback:</b> {sub.feedback}</p>}
                </>
              )}
              {sub.files.map((f) => (
                <div className="row between" key={f.id}>
                  <FileLink f={f} />
                  {!graded && <button type="button" className="link" onClick={() => removeFile(f)}>✕</button>}
                </div>
              ))}
            </>
          ) : <p className="muted">You haven't submitted anything yet.</p>}

          {!graded && (
            <form onSubmit={submit}>
              <label>{sub ? 'Add more files' : 'Upload your solution'} <input type="file" name="files" multiple required /></label>
              <button className="btn full">{sub ? 'Add files' : 'Submit'}</button>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
