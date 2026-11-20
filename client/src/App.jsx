import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import ErrorView from './components/ErrorView.jsx';
import Layout from './components/Layout.jsx';
import AssignmentPage from './pages/AssignmentPage.jsx';
import ClassPage from './pages/ClassPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Profile from './pages/Profile.jsx';
import Signup from './pages/Signup.jsx';

/** Pages that need a signed-in user (the API enforces roles and per-class access too). */
function Protected({ children }) {
  const { user, loggedOut } = useAuth();
  if (user) return children;
  return loggedOut ? <Navigate to="/" replace /> : <Navigate to="/login" replace state={{ needLogin: true }} />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/classes/:id" element={<Protected><ClassPage /></Protected>} />
        <Route path="/assignments/:id" element={<Protected><AssignmentPage /></Protected>} />
        <Route path="*" element={<ErrorView status={404} />} />
      </Route>
    </Routes>
  );
}
