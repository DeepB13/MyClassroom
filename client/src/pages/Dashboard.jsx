import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Count from '../components/Count.jsx';
import ErrorView from '../components/ErrorView.jsx';
import Icon from '../components/Icon.jsx';
import { useShell } from '../components/Layout.jsx';
import Modal from '../components/Modal.jsx';
import { fmtDue, greeting, plural } from '../format.js';
import { useAction, useLoad, useTitle } from '../hooks.js';

export default function Dashboard() {
  const { user } = useAuth();
  return user.role === 'teacher' ? <TeacherDashboard /> : <StudentDashboard />;
}

function TeacherDashboard() {
  useTitle('Teacher dashboard');
  const { user } = useAuth();
  const navigate = useNavigate();
  const run = useAction();
  const { refreshClasses } = useShell();
  const { data, error, reload } = useLoad('/dashboard');
  const [creating, setCreating] = useState(false);

  if (error) return <ErrorView error={error} />;
  if (!data) return null;
  const { classes, pending, studentsTotal, assignmentsTotal } = data;

  const create = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const res = await run(() => api('/classes', { method: 'POST', body }));
    if (res) { setCreating(false); refreshClasses(); navigate(`/classes/${res.id}`); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete “${c.name}” with all its assignments and submissions? This cannot be undone.`)) return;
    if (await run(() => api(`/classes/${c.id}`, { method: 'DELETE' }))) { reload(); refreshClasses(); }
  };

  return (
    <>
      <div className="pagehead">
        <div>
          <h1><span className="gradtext">{greeting()}, {user.name}</span> 👋</h1>
          <p className="muted">{classes.length} {plural(classes.length, 'class', 'classes')} &middot; {pending} {plural(pending, 'submission', 'submissions')} waiting to be graded</p>
        </div>
        <button className="btn" onClick={() => setCreating(true)}>+ Create class</button>
      </div>

      <div className="tiles">
        <div className="tile t1"><span className="tico"><Icon name="book" size={24} /></span><div><Count to={classes.length} /><small>Classes</small></div></div>
        <div className="tile t2"><span className="tico"><Icon name="users" size={24} /></span><div><Count to={studentsTotal} /><small>Students</small></div></div>
        <div className="tile t3"><span className="tico"><Icon name="clipboard" size={24} /></span><div><Count to={assignmentsTotal} /><small>Assignments</small></div></div>
        <div className={`tile t4 ${pending ? 'alert' : ''}`}><span className="tico"><Icon name="edit" size={24} /></span><div><Count to={pending} /><small>To grade</small></div></div>
      </div>

      {classes.length > 0 ? (
        <div className="grid">
          {classes.map((c) => (
            <article className="card classcard" key={c.id}>
              <Link to={`/classes/${c.id}`} className={`banner c${c.color}`}>
                <h3>{c.name}</h3><span>{c.section || c.subject || ''}</span>
              </Link>
              <div className="body">
                <div className="code" title="Class code">Code <b>{c.code}</b></div>
                <div className="stats">
                  <span>👥 {c.studentCount} students</span>
                  {c.nextDue && <span className="duebadge">⏰ Assignment due · {fmtDue(c.nextDue.dueAt)}</span>}
                </div>
              </div>
              <div className="foot row">
                <Link className="btn small ghost" to={`/classes/${c.id}`}>Open</Link>
                <button className="btn small danger" onClick={() => remove(c)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          <h2>No classes yet</h2>
          <p>Create your first class to get a join code for your students.</p>
          <button className="btn" onClick={() => setCreating(true)}>+ Create class</button>
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)}>
        <form onSubmit={create}>
          <h3>Create class</h3>
          <label>Class name * <input name="name" required maxLength={100} /></label>
          <label>Section <input name="section" maxLength={100} /></label>
          <label>Subject <input name="subject" maxLength={100} /></label>
          <div className="row end">
            <button type="button" className="btn ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn">Create</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function StudentDashboard() {
  useTitle('Student dashboard');
  const { user } = useAuth();
  const navigate = useNavigate();
  const run = useAction();
  const { refreshClasses } = useShell();
  const { data, error, reload } = useLoad('/dashboard');
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');

  if (error) return <ErrorView error={error} />;
  if (!data) return null;
  const { classes, todo, todoCount, overdueCount, submittedCount } = data;

  const join = async (e) => {
    e.preventDefault();
    setJoining(false);
    const res = await run(() => api('/classes/join', { method: 'POST', body: { code } }));
    setCode('');
    if (res) { refreshClasses(); navigate(`/classes/${res.id}`); }
  };

  const leave = async (c) => {
    if (!window.confirm(`Leave “${c.name}”? Your submissions in this class will be removed.`)) return;
    if (await run(() => api(`/classes/${c.id}/leave`, { method: 'POST' }))) { reload(); refreshClasses(); }
  };

  return (
    <>
      <div className="pagehead">
        <div>
          <h1><span className="gradtext">{greeting()}, {user.name}</span> 👋</h1>
          <p className="muted">You're in {classes.length} class{classes.length !== 1 ? 'es' : ''}</p>
        </div>
        <button className="btn" onClick={() => setJoining(true)}>+ Join class</button>
      </div>

      <div className="tiles">
        <div className="tile t1"><span className="tico"><Icon name="book" size={24} /></span><div><Count to={classes.length} /><small>Classes</small></div></div>
        <div className="tile t2"><span className="tico"><Icon name="clock" size={24} /></span><div><Count to={todoCount} /><small>To do</small></div></div>
        <div className={`tile t4 ${overdueCount ? 'alert' : ''}`}><span className="tico"><Icon name="alert" size={24} /></span><div><Count to={overdueCount} /><small>Overdue</small></div></div>
        <div className="tile t3"><span className="tico"><Icon name="check" size={24} /></span><div><Count to={submittedCount} /><small>Submitted</small></div></div>
      </div>

      <div className="split">
        <section>
          {classes.length > 0 ? (
            <div className="grid two">
              {classes.map((c) => (
                <article className="card classcard" key={c.id}>
                  {c.unread > 0 && (
                    <Link className="redbar" to={`/classes/${c.id}#announcements`}>
                      🔔 {c.unread} new announcement{c.unread > 1 ? 's' : ''}
                    </Link>
                  )}
                  <Link to={`/classes/${c.id}`} className={`banner c${c.color}`}>
                    <h3>{c.name}</h3><span>{c.teacherName}</span>
                  </Link>
                  <div className="body">
                    <div className="stats">
                      <span>{c.subject || c.section || ''}</span>
                      {c.nextDue && (
                        <span className={`duebadge ${c.nextDue.isOverdue ? 'late' : ''}`}>
                          ⏰ Assignment due{c.nextDue.dueAt && <> · {fmtDue(c.nextDue.dueAt)}</>}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="foot row">
                    <Link className="btn small ghost" to={`/classes/${c.id}`}>Open</Link>
                    <button className="btn small ghost" onClick={() => leave(c)}>Leave</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <h2>You haven't joined any class</h2>
              <p>Ask your teacher for the class code and join.</p>
              <button className="btn" onClick={() => setJoining(true)}>+ Join class</button>
            </div>
          )}
        </section>

        <aside className="card todo">
          <h3>To do</h3>
          {todo.length > 0 ? todo.map((a) => (
            <Link className="todoitem" to={`/assignments/${a.id}`} key={a.id}>
              <b>{a.title}</b><small>{a.className}</small>
              <small className={a.isOverdue ? 'late' : ''}>{a.isOverdue ? 'Overdue · ' : ''}{fmtDue(a.dueAt)}</small>
            </Link>
          )) : <p className="muted">🎉 Nothing pending!</p>}
        </aside>
      </div>

      <Modal open={joining} onClose={() => setJoining(false)}>
        <form onSubmit={join}>
          <h3>Join class</h3>
          <p className="muted">Enter the 6-character code your teacher shared.</p>
          <input
            className="codeinput" required minLength={6} maxLength={8} placeholder="ABC234" autoComplete="off"
            value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <div className="row end">
            <button type="button" className="btn ghost" onClick={() => setJoining(false)}>Cancel</button>
            <button className="btn">Join</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
