const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n) => String(n).padStart(2, '0');

/** "05 Mar 2025, 14:30" */
export function fmtDt(v) {
  if (!v) return '';
  const d = new Date(v);
  return `${p2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** "05 Mar 2025, 02:30 PM" or "No due date" */
export function fmtDue(v) {
  if (!v) return 'No due date';
  const d = new Date(v);
  const h = d.getHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${p2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${p2(h12)}:${p2(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

/** 87.5 -> "87.5", 90 -> "90" (like Python's '%g') */
export const fmtGrade = (n) => String(parseFloat(Number(n).toPrecision(6)));

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export const plural = (n, one, many) => (n === 1 ? one : many);
