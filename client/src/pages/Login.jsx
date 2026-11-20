import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useTitle } from '../hooks.js';
import { useToast } from '../Toast.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const told = useRef(false);
  useTitle('Sign in');

  useEffect(() => {
    if (location.state?.needLogin && !told.current) { told.current = true; toast('Please sign in first.', 'error'); }
  }, [location.state, toast]);

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password); // the redirect happens as soon as `user` is set
    } catch (err) {
      toast(err.message, 'error');
      setPassword('');
      setBusy(false);
    }
  };

  return (
    <div className="card auth">
      <h2>Welcome back</h2>
      <form onSubmit={submit}>
        <label>Email <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
        <label>Password <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        <button className="btn full" disabled={busy}>Sign in</button>
      </form>
      <p className="muted">New here? <Link to="/signup">Create an account</Link></p>
    </div>
  );
}
