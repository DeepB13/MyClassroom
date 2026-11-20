import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';

const ShellContext = createContext({ slot: null, setActiveClass: () => {}, refreshClasses: () => {} });
export const useShell = () => useContext(ShellContext);

/** Highlights a class in the sidebar while its pages are on screen. */
export function useActiveClass(id) {
  const { setActiveClass } = useShell();
  useEffect(() => {
    if (!id) return undefined;
    setActiveClass(id);
    return () => setActiveClass(null);
  }, [id, setActiveClass]);
}

function BrandMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#fff" />
      <path d="M8 12l8-4 8 4-8 4z M11 15v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5l-5 2.5z" />
    </svg>
  );
}

export default function Layout() {
  const { user, ready, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sideOpen, setSideOpen] = useState(false);
  const [classes, setClasses] = useState([]);
  const [activeClass, setActiveClass] = useState(null);
  const [slot, setSlot] = useState(null); // DOM node where a class page portals its own sidebar section

  const refreshClasses = useCallback(() => {
    if (!user) { setClasses([]); return; }
    api('/classes').then(setClasses).catch(() => {});
  }, [user]);

  useEffect(() => { refreshClasses(); }, [refreshClasses, location.pathname]);
  useEffect(() => { setSideOpen(false); }, [location.pathname]);

  // theme + phone slide-out menu are driven by classes on <body>, like the original CSS expects
  useEffect(() => {
    document.body.className =
      `theme-${user ? user.role : 'guest'}${user ? ' hasside' : ''}${sideOpen ? ' side-open' : ''}`;
  }, [user, sideOpen]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSideOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const shell = useMemo(() => ({ slot, setActiveClass, refreshClasses }), [slot, refreshClasses]);
  const path = location.pathname;

  if (!ready) return null;

  const main = (
    <>
      <main className="container"><Outlet /></main>
      <footer className="sitefoot">MY CLASSROOM &middot; teach, learn, submit.</footer>
    </>
  );

  if (!user) {
    return (
      <ShellContext.Provider value={shell}>
        <header className="topbar">
          <Link className="brand" to="/"><BrandMark /> MY CLASSROOM</Link>
          <nav>
            <Link to="/login">Sign in</Link>
            <Link className="btn small" to="/signup">Create account</Link>
          </nav>
        </header>
        {main}
      </ShellContext.Provider>
    );
  }

  return (
    <ShellContext.Provider value={shell}>
      <div className="app">
        <aside
          className="sidebar" id="sidebar" aria-label="Main navigation"
          onClick={(e) => { if (e.target.closest('a, .navitem')) setSideOpen(false); }}
        >
          <Link className="brand" to="/dashboard"><BrandMark /> MY CLASSROOM</Link>

          <Link className="sidecard" to="/profile" title="Edit your profile">
            <Avatar user={user} size="md" />
            <span className="sidewho"><b>{user.name}</b><small>{user.role === 'teacher' ? 'Teacher' : 'Student'}</small></span>
          </Link>

          <nav className="sidenav" aria-label="Pages">
            <Link className={`navitem ${path === '/dashboard' ? 'on' : ''}`} to="/dashboard"><Icon name="home" /><span>Dashboard</span></Link>
            <Link className={`navitem ${path === '/profile' ? 'on' : ''}`} to="/profile"><Icon name="user" /><span>Profile</span></Link>
          </nav>

          <div ref={setSlot} />

          {classes.length > 0 && (
            <>
              <div className="sidelabel">My classes</div>
              <nav className="sidenav classlist" aria-label="My classes">
                {classes.map((k) => (
                  <Link key={k.id} className={`navitem ${activeClass === k.id ? 'cur' : ''}`} to={`/classes/${k.id}`}>
                    <i className={`dot c${k.color}`} /><span>{k.name}</span>
                  </Link>
                ))}
              </nav>
            </>
          )}

          <form
            className="signout"
            onSubmit={async (e) => { e.preventDefault(); await logout(); navigate('/'); }}
          >
            <button className="navitem"><Icon name="logout" /><span>Sign out</span></button>
          </form>
        </aside>
        <div className="scrim" onClick={() => setSideOpen(false)} />

        <div className="appmain">
          <header className="mobilebar">
            <button type="button" className="iconbtn" aria-label="Open menu" aria-controls="sidebar" onClick={() => setSideOpen(true)}>
              <Icon name="menu" size={24} />
            </button>
            <Link className="brand" to="/dashboard">MY CLASSROOM</Link>
            <Link className="mobileuser" to="/profile" aria-label="Your profile"><Avatar user={user} size="sm" /></Link>
          </header>
          {main}
        </div>
      </div>
    </ShellContext.Provider>
  );
}
