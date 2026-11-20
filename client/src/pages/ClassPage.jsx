import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import Avatar from '../components/Avatar.jsx';
import Comments from '../components/Comments.jsx';
import ErrorView from '../components/ErrorView.jsx';
import Icon from '../components/Icon.jsx';
import { useActiveClass, useShell } from '../components/Layout.jsx';
import Modal from '../components/Modal.jsx';
import { fmtDt, fmtDue, fmtGrade } from '../format.js';
import { useAction, useLoad, useTitle } from '../hooks.js';

export default function ClassPage() {
  const { id } = useParams();
  useActiveClass(id);
  const { data, error, reload } = useLoad(`/classes/${id}`);
  if (error) return <ErrorView error={error} />;
  if (!data) return null;
  return data.role === 'teacher'
    ? <TeacherClass key={id} data={data} reload={reload} />
    : <StudentClass key={id} data={data} reload={reload} />;
}

/** Class sections (Assignments / Announcements / Students) live in the left bar and in the URL hash. */
function useTab(valid) {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const wanted = hash.slice(1);
  const tab = valid.includes(wanted) ? wanted : 'assignments';
  const open = (name) => {
    navigate({ hash: `#${name}` }, { replace: true });
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };
  return [tab, open];
}

// ============================================================================ teacher
function TeacherClass({ data, reload }) {
  const c = data.class;
  const { slot } = useShell();
  const run = useAction();
  const [tab, open] = useTab(['assignments', 'announcements', 'students']);
  const [newOpen, setNewOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  useTitle(c.name);

  const details = [c.section, c.subject].filter(Boolean).join(' · ');
  const total = data.studentCount;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(c.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard not available */ }
  };

  const createAssignment = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const due = fd.get('dueAt');
    if (due) fd.set('dueAt', new Date(due).toISOString()); // the browser's local time -> a real instant
    else fd.delete('dueAt');
    if (await run(() => api(`/classes/${c.id}/assignments`, { method: 'POST', form: fd }))) {
      setNewOpen(false);
      reload();
    }
  };

  const deleteAssignment = async (a) => {
    if (!window.confirm('Delete this assignment and all its submissions?')) return;
    if (await run(() => api(`/assignments/${a.id}`, { method: 'DELETE' }))) reload();
  };

  const announce = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const text = new FormData(form).get('text');
    if (await run(() => api(`/classes/${c.id}/announce`, { method: 'POST', body: { text } }))) {
      form.reset();
      reload();
    }
  };

  const deleteAnnouncement = async (n) => {
    if (!window.confirm('Delete this announcement and its comments?')) return;
    if (await run(() => api(`/announcements/${n.id}`, { method: 'DELETE' }))) reload();
  };

  const tabBtn = (name, icon, label, count) => (
    <button type="button" onClick={() => open(name)} className={`navitem ${tab === name ? 'on' : ''}`}>
      <Icon name={icon} /><span>{label}</span><em className="chip">{count}</em>
    </button>
  );

  return (
    <>
      {slot && createPortal(
        <>
          <div className="sidelabel">This class</div>
          <div className={`classchip c${c.color}`}><b>{c.name}</b><small>{details || 'Your class'}</small></div>
          <nav className="sidenav" role="tablist" aria-label="Class sections">
            {tabBtn('assignments', 'clipboard', 'Assignments', data.assignments.length)}
            {tabBtn('announcements', 'bell', 'Announcements', data.announcements.length)}
            {tabBtn('students', 'users', 'Students', total)}
          </nav>
        </>,
        slot,
      )}

      <Link className="back" to="/dashboard"><Icon name="back" size={16} /> All classes</Link>
      <div className={`hero-banner c${c.color}`}>
        <div><h1>{c.name}</h1><p>{details}</p></div>
        <div className="codebox">
          Class code<b>{c.code}</b>
          <button type="button" className="btn small ghost light" onClick={copyCode}>{copied ? 'Copied!' : 'Copy'}</button>
        </div>
      </div>

      <section id="assignments" className="panel" hidden={tab !== 'assignments'}>
        <div className="row end"><button className="btn" onClick={() => setNewOpen(true)}>+ New assignment</button></div>
        {data.assignments.length === 0 && <div className="empty"><p>No assignments yet. Post your first one!</p></div>}
        {data.assignments.map((a) => {
          const pct = total ? Math.floor((a.submittedCount * 100) / total) : 0;
          return (
            <article className="card item" key={a.id}>
              <div className="itemmain">
                <Link to={`/assignments/${a.id}`}><h3>{a.title}</h3></Link>
                <small className="muted">
                  Due {fmtDue(a.dueAt)}{a.points ? ` · ${a.points} pts` : ''} · {a.submittedCount}/{total} submitted
                </small>
                <div className="progress" title={`${a.submittedCount} of ${total} submitted`}><span style={{ width: `${pct}%` }} /></div>
              </div>
              <div className="row">
                <Link className="btn small ghost" to={`/assignments/${a.id}`}>View submissions</Link>
                <button className="btn small danger" onClick={() => deleteAssignment(a)}>Delete</button>
              </div>
            </article>
          );
        })}
      </section>

      <section id="announcements" className="panel" hidden={tab !== 'announcements'}>
        <form className="card" onSubmit={announce}>
          <textarea name="text" rows={3} placeholder="Announce something to your class…" required />
          <div className="row end"><button className="btn small">Post</button></div>
        </form>
        {data.announcements.map((n) => (
          <article className="card ann" key={n.id}>
            <div className="row between">
              <div><p className="pre">{n.text}</p><small className="muted">{fmtDt(n.createdAt)}</small></div>
              <button type="button" className="btn small ghost" onClick={() => deleteAnnouncement(n)}>Delete</button>
            </div>
            <Comments announcement={n} onChange={reload} />
          </article>
        ))}
      </section>

      <section id="students" className="panel" hidden={tab !== 'students'}>
        <div className="card">
          {data.students.length > 0 ? data.students.map((s) => (
            <div className="person" key={s.id}>
              <Avatar user={s} />
              <div><b>{s.name}</b><br /><small className="muted">{s.email}</small></div>
            </div>
          )) : <p className="muted">Nobody has joined yet. Share the code <b>{c.code}</b> with your students.</p>}
        </div>
      </section>

      <Modal open={newOpen} onClose={() => setNewOpen(false)}>
        <form onSubmit={createAssignment}>
          <h3>New assignment</h3>
          <label>Title * <input name="title" required maxLength={150} /></label>
          <label>Instructions <textarea name="instructions" rows={4} /></label>
          <div className="row">
            <label className="grow">Points <input type="number" name="points" min={1} max={1000} /></label>
            <label className="grow">Due date &amp; time <input type="datetime-local" name="dueAt" /></label>
          </div>
          <label>Attachments (optional, multiple) <input type="file" name="files" multiple /></label>
          <div className="row end">
            <button type="button" className="btn ghost" onClick={() => setNewOpen(false)}>Cancel</button>
            <button className="btn">Post</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ============================================================================ student
function StatusPill({ a }) {
  if (a.state === 'graded') {
    return <span className="pill graded">Graded {fmtGrade(a.grade)}{a.points ? `/${a.points}` : ''}</span>;
  }
  if (a.state === 'submitted') return <span className="pill done">Submitted{a.isLate ? ' (late)' : ''}</span>;
  if (a.state === 'missing') return <span className="pill late">Missing</span>;
  return <span className="pill todo">To do</span>;
}

function StudentClass({ data, reload }) {
  const c = data.class;
  const { slot } = useShell();
  const [tab, open] = useTab(['assignments', 'announcements']);
  const [seen, setSeen] = useState(false); // true once the "new" bar/badges have been cleared
  const newCount = data.announcements.filter((n) => n.isNew).length;
  const hasNew = newCount > 0 && !seen;
  useTitle(c.name);

  // opening the Announcements tab marks them as read
  useEffect(() => {
    if (tab === 'announcements' && hasNew) {
      api(`/classes/${c.id}/announcements/seen`, { method: 'POST' }).catch(() => {});
      setSeen(true);
    }
  }, [tab, hasNew, c.id]);

  const details = [c.section, c.subject].filter(Boolean).join(' · ');

  return (
    <>
      {slot && createPortal(
        <>
          <div className="sidelabel">This class</div>
          <div className={`classchip c${c.color}`}><b>{c.name}</b><small>{c.teacherName}</small></div>
          <nav className="sidenav" role="tablist" aria-label="Class sections">
            <button type="button" onClick={() => open('assignments')} className={`navitem ${tab === 'assignments' ? 'on' : ''}`}>
              <Icon name="clipboard" /><span>Assignments</span><em className="chip">{data.assignments.length}</em>
            </button>
            <button type="button" onClick={() => open('announcements')} className={`navitem ${tab === 'announcements' ? 'on' : ''} ${hasNew ? 'hasnew' : ''}`}>
              <Icon name="bell" /><span>Announcements</span>
              {hasNew && <span className="redbadge">{newCount}</span>}
            </button>
          </nav>
        </>,
        slot,
      )}

      <Link className="back" to="/dashboard"><Icon name="back" size={16} /> All classes</Link>
      <div className={`hero-banner c${c.color}`}>
        <div><h1>{c.name}</h1><p>{details}</p><p>Teacher: {c.teacherName}</p></div>
      </div>
      {hasNew && (
        <a className="redbanner" href="#announcements" onClick={(e) => { e.preventDefault(); open('announcements'); }}>
          🔔 Your teacher posted {newCount} new announcement{newCount > 1 ? 's' : ''} — click to read
        </a>
      )}

      <section id="assignments" className="panel" hidden={tab !== 'assignments'}>
        {data.assignments.length === 0 && <div className="empty"><p>No assignments yet.</p></div>}
        {data.assignments.map((a) => (
          <Link className="card item linkcard" to={`/assignments/${a.id}`} key={a.id}>
            <div className="itemmain">
              <h3>{a.title}</h3>
              <small className="muted">Due {fmtDue(a.dueAt)}{a.points ? ` · ${a.points} pts` : ''}</small>
            </div>
            <StatusPill a={a} />
          </Link>
        ))}
      </section>

      <section id="announcements" className="panel" hidden={tab !== 'announcements'}>
        {data.announcements.length === 0 && <div className="empty"><p>No announcements.</p></div>}
        {data.announcements.map((n) => (
          <article className={`card ${n.isNew ? 'isnew' : ''}`} key={n.id}>
            {n.isNew && <span className="redbadge">NEW</span>}
            <p className="pre">{n.text}</p>
            <small className="muted">{fmtDt(n.createdAt)}</small>
            <Comments announcement={n} onChange={reload} />
          </article>
        ))}
      </section>
    </>
  );
}
