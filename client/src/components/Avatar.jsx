/**
 * Round avatar: the user's photo if they have one, otherwise a coloured initial.
 * The initial sits underneath the photo, so it still shows if the photo can't be loaded.
 * `src` overrides the photo (used for the live preview on the profile page).
 */
export default function Avatar({ user, size = '', src }) {
  const cls = `avatar av${user.color}${size ? ` ${size}` : ''}`;
  const initial = (user.name || '?').slice(0, 1).toUpperCase();
  const photo = src || (user.photo ? `/api/avatar/${user.id}?v=${user.photo}` : null);
  return (
    <span className={cls}>
      <i>{initial}</i>
      {photo && <img src={photo} alt="" loading="lazy" />}
    </span>
  );
}
