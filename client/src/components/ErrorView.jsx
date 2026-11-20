import { Link } from 'react-router-dom';
import { useTitle } from '../hooks.js';

const MESSAGES = {
  403: "You don't have access to this page.",
  404: "We couldn't find that page.",
};

/** <ErrorView error={err} />  or  <ErrorView status={404} /> */
export default function ErrorView({ error, status }) {
  const code = status || (error && error.status) || 500;
  const msg = MESSAGES[code] || (error && error.message) || 'Something went wrong.';
  useTitle(String(code));
  return (
    <div className="empty">
      <h1>{code}</h1>
      <p>{msg}</p>
      <Link className="btn" to="/">Back home</Link>
    </div>
  );
}
