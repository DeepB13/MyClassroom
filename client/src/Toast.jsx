import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(() => {});
/** const toast = useToast();  toast('Saved', 'success')  /  toast('Oops', 'error') */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, out: true } : t)));
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 350);
  }, []);

  // Toasts fade away on their own (errors stay a bit longer) or on click of x
  const toast = useCallback((message, type = 'success') => {
    const id = ++nextId.current;
    setItems((list) => [...list, { id, message, type }]);
    setTimeout(() => dismiss(id), type === 'error' ? 9000 : 5000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {items.length > 0 && (
        <div className="toasts" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className={`flash ${t.type}${t.out ? ' out' : ''}`} role="status">
              <span>{t.message}</span>
              <button type="button" className="flashx" aria-label="Dismiss" onClick={() => dismiss(t.id)}>&times;</button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
