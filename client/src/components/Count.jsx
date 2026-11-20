import { useEffect, useState } from 'react';

/** Number that counts up from 0 (skipped when the visitor prefers reduced motion). */
export default function Count({ to }) {
  const [value, setValue] = useState(to);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !to || to < 1) { setValue(to); return undefined; }
    let raf;
    const t0 = performance.now();
    const dur = 800;
    setValue(0);
    const step = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      setValue(Math.round(to * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <b className="count">{value}</b>;
}
