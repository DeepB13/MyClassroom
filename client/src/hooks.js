import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { useToast } from './Toast.jsx';

/** Load a GET endpoint. `reload()` refreshes quietly (keeps the old data on screen meanwhile). */
export function useLoad(path) {
  const [state, setState] = useState({ data: null, error: null });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const reload = useCallback(async () => {
    try {
      const data = await api(path);
      if (alive.current) setState({ data, error: null });
    } catch (error) {
      if (alive.current) setState((s) => ({ data: s.data, error }));
    }
  }, [path]);

  useEffect(() => {
    setState({ data: null, error: null });
    reload();
  }, [reload]);

  return { ...state, reload };
}

/**
 * const run = useAction();
 * const res = await run(() => api(...));   // shows the server's `message` as a success toast,
 *                                          // an error toast on failure, and returns null on failure
 */
export function useAction() {
  const toast = useToast();
  return useCallback(async (fn) => {
    try {
      const res = await fn();
      if (res && res.message) toast(res.message, 'success');
      return res ?? true;
    } catch (e) {
      toast(e.message, 'error');
      return null;
    }
  }, [toast]);
}

export function useTitle(title) {
  useEffect(() => { document.title = title ? `${title} · MY CLASSROOM` : 'MY CLASSROOM'; }, [title]);
}
