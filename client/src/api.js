// Thin fetch wrapper: JSON in/out, cookie session, CSRF header on every write.
let csrf = '';
let onUnauthorized = null;

export const setCsrf = (token) => { csrf = token || ''; };
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

/**
 * api('/classes')
 * api('/classes', { method: 'POST', body: { name } })      -> JSON
 * api('/profile', { method: 'PUT', form: formData })       -> multipart (file uploads)
 */
export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (method !== 'GET') headers['X-CSRF-Token'] = csrf;

  const res = await fetch(`/api${path}`, { method, headers, body: payload, credentials: 'same-origin' });
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* empty / non-JSON body */ }
  if (!res.ok) {
    if (res.status === 401 && onUnauthorized && !path.startsWith('/auth/')) onUnauthorized();
    const err = new Error((data && data.error) || 'Something went wrong. Please try again.');
    err.status = res.status;
    throw err;
  }
  return data;
}
