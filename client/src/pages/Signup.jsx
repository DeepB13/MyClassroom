import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useTitle } from '../hooks.js';
import { useToast } from '../Toast.jsx';

export default function Signup() {
  const { user, signup } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ role: '', name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  useTitle('Sign up');

  if (user) return <Navigate to="/dashboard" replace />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await signup(form);
    } catch (err) {
      toast(err.message, 'error'); // the typed values stay in the form
      setBusy(false);
    }
  };

  return (
    <div className="card auth">
      <h2>Create your account</h2>
      <form onSubmit={submit}>
        <div className="roles">
          <label className="role">
            <input type="radio" name="role" value="teacher" checked={form.role === 'teacher'} onChange={set('role')} required />
            <span>👩‍🏫<b>I'm a teacher</b></span>
          </label>
          <label className="role">
            <input type="radio" name="role" value="student" checked={form.role === 'student'} onChange={set('role')} />
            <span>🎒<b>I'm a student</b></span>
          </label>
        </div>
        <label>Full name <input value={form.name} onChange={set('name')} required maxLength={100} /></label>
        <label>Email <input type="email" value={form.email} onChange={set('email')} required /></label>
        <label>Password <input type="password" value={form.password} onChange={set('password')} minLength={8} required placeholder="At least 8 characters" /></label>
        <button className="btn full" disabled={busy}>Create account</button>
      </form>
      <p className="muted">Already registered? <Link to="/login">Sign in</Link></p>
    </div>
  );
}
