import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';
import Count from '../components/Count.jsx';
import Icon from '../components/Icon.jsx';
import { useAction, useLoad, useTitle } from '../hooks.js';

const DEFAULT_HINT = 'PNG, JPG, GIF or WebP · up to 3 MB';

export default function Profile() {
  useTitle('Profile');
  const { user, setUser } = useAuth();
  const run = useAction();
  const { data } = useLoad('/profile');
  const [name, setName] = useState(user.name);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // object URL of the chosen photo
  const [hint, setHint] = useState({ text: DEFAULT_HINT, bad: false });
  const input = useRef(null);
  const isTeacher = user.role === 'teacher';
  const classCount = data ? data.classCount : 0;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setHint({ text: DEFAULT_HINT, bad: false });
    if (input.current) input.current.value = '';
  };

  const pick = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const refuse = (text) => { setHint({ text, bad: true }); e.target.value = ''; setFile(null); setPreview(null); };
    if (!/^image\/(png|jpeg|gif|webp)$/.test(f.type)) return refuse('Please choose a PNG, JPG, GIF or WebP image.');
    if (f.size > 3 * 1024 * 1024) return refuse('That photo is over 3 MB - please choose a smaller one.');
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setHint({ text: `${f.name} - press “Save changes” to apply`, bad: false });
  };

  const save = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.set('name', name);
    if (file) fd.set('photo', file);
    const res = await run(() => api('/profile', { method: 'PUT', form: fd }));
    if (res) { setUser(res.user); setName(res.user.name); reset(); }
  };

  const removePhoto = async () => {
    if (!window.confirm('Remove your profile photo?')) return;
    const res = await run(() => api('/profile/photo', { method: 'DELETE' }));
    if (res) { setUser(res.user); reset(); }
  };

  // live preview: the typed name's initial and the chosen photo, before anything is saved
  const previewUser = { ...user, name: name.trim() || '?' };

  return (
    <>
      <div className="pagehead">
        <div>
          <h1><span className="gradtext">Your profile</span></h1>
          <p className="muted">Change your name or add a photo — people in your classes will see the update.</p>
        </div>
      </div>

      <div className="profilegrid">
        <aside className="card profilecard">
          <div className="pbanner" />
          <div className="pavatar"><Avatar user={previewUser} size="xl" src={preview} /></div>
          <h2>{name.trim() || 'Your name'}</h2>
          <span className="pill rolepill">{isTeacher ? 'Teacher' : 'Student'}</span>
          <p className="muted pemail">{user.email}</p>
          <div className="pstats">
            <Count to={classCount} />
            <small>{classCount === 1 ? 'class' : 'classes'} {isTeacher ? 'taught' : 'joined'}</small>
          </div>
        </aside>

        <section className="card">
          <h3>Edit profile</h3>
          <form onSubmit={save}>
            <div className="photoedit">
              <label className="photopick" htmlFor="photoInput" title="Choose a photo">
                <span><Avatar user={previewUser} size="xl" src={preview} /></span>
                <span className="camera"><Icon name="camera" size={18} /></span>
              </label>
              <div>
                <b>Profile photo</b>
                <p className={`muted small ${hint.bad ? 'bad' : ''}`}>{hint.text}</p>
                <div className="row">
                  <label className="btn small ghost filebtn" htmlFor="photoInput">{user.photo ? 'Change photo' : 'Choose photo'}</label>
                  {user.photo && <button type="button" className="btn small danger" onClick={removePhoto}>Remove</button>}
                </div>
              </div>
              <input
                type="file" id="photoInput" ref={input} accept="image/png,image/jpeg,image/gif,image/webp"
                hidden onChange={pick}
              />
            </div>

            <label>Your name <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="name" /></label>
            <label>Email <input value={user.email} disabled readOnly /></label>
            <label>Account type <input value={isTeacher ? 'Teacher' : 'Student'} disabled readOnly /></label>

            <div className="row end"><button className="btn">Save changes</button></div>
          </form>
        </section>
      </div>
    </>
  );
}
