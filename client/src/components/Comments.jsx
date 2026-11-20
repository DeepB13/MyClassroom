import { useState } from 'react';
import { api } from '../api.js';
import { fmtDt } from '../format.js';
import { useAction } from '../hooks.js';
import Avatar from './Avatar.jsx';

/** Comment thread under one announcement. `announcement` comes from the class payload. */
export default function Comments({ announcement: n, onChange }) {
  const run = useAction();
  const [text, setText] = useState('');

  const add = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const ok = await run(() => api(`/announcements/${n.id}/comments`, { method: 'POST', body: { text } }));
    if (ok) { setText(''); onChange(); }
  };

  const remove = async (cm) => {
    if (!window.confirm('Delete this comment?')) return;
    if (await run(() => api(`/comments/${cm.id}`, { method: 'DELETE' }))) onChange();
  };

  return (
    <div className="comments">
      {n.comments.map((cm) => (
        <div className="comment" key={cm.id}>
          <Avatar user={cm.user} size="sm" />
          <div className="cbody">
            <b>{cm.user.name}</b>{cm.user.role === 'teacher' && <> <span className="tag">Teacher</span></>}{' '}
            <small className="muted">{fmtDt(cm.createdAt)}</small>
            <p className="pre">{cm.text}</p>
          </div>
          {cm.canDelete && (
            <button type="button" className="link" title="Delete comment" onClick={() => remove(cm)}>✕</button>
          )}
        </div>
      ))}
      <form className="commentform" onSubmit={add}>
        <input
          placeholder="Add a comment…" required maxLength={1000} autoComplete="off"
          value={text} onChange={(e) => setText(e.target.value)}
        />
        <button className="btn small">Comment</button>
      </form>
    </div>
  );
}
