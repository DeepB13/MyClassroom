import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { useTitle } from '../hooks.js';

export default function Home() {
  const { user } = useAuth();
  useTitle('');
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <>
      <section className="hero">
        <h1>Your class, <span>all in one place.</span></h1>
        <p>Teachers create classrooms and post assignments. Students join with a code and upload their solutions. Simple as that.</p>
        <div className="row center">
          <Link className="btn big" to="/signup">Get started</Link>
          <Link className="btn big ghost" to="/login">Sign in</Link>
        </div>
      </section>
      <section className="grid3">
        <div className="card feature f1"><h3>👩‍🏫 For teachers</h3><p>Create as many classrooms as you need, get a unique join code, post assignments with attachments and grade submissions.</p></div>
        <div className="card feature f2"><h3>🎒 For students</h3><p>Join multiple classes with a code, see every assignment and its deadline, and upload your solutions in seconds.</p></div>
        <div className="card feature f3"><h3>🔒 Private by default</h3><p>Only the teacher of a class and its enrolled students can see its work. Files are never public.</p></div>
      </section>
    </>
  );
}
