import React from 'react';
import { Routes, Route, Navigate, Link, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/useAuth.jsx';
import Overview from './spa/Overview.jsx';
import Agents from './spa/Agents.jsx';
import Outbound from './spa/Outbound.jsx';
import Campaigns from './spa/Campaigns.jsx';
import Login from './spa/Login.jsx';
import Conversations from './spa/Conversations.jsx';

// A simple component that guards a route.  If the user
// is not authenticated, it redirects to the login
// page.  Otherwise it renders its children.
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

// Layout shell that renders the top navigation and
// outlet for nested routes.  It shows nothing if the
// user is not present so that the login page can take
// over the full screen.
function Shell() {
  const { user, logout } = useAuth();
  if (!user) {
    return <Outlet />;
  }
  return (
    <div className="app-shell">
      <nav className="topbar">
        <div className="logo">Docvai</div>
        <ul className="nav-links">
          <li><Link to="/overview">Overview</Link></li>
          <li><Link to="/agents">Agents</Link></li>
          <li><Link to="/outbound">Outbound</Link></li>
          <li><Link to="/campaigns">Campaigns</Link></li>
          <li><Link to="/conversations">Conversations</Link></li>

        </ul>
        <button className="btn" onClick={logout}>Logout</button>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<Shell />}>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Overview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/overview"
            element={
              <ProtectedRoute>
                <Overview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agents"
            element={
              <ProtectedRoute>
                <Agents />
              </ProtectedRoute>
            }
          />
          <Route
            path="/outbound"
            element={
              <ProtectedRoute>
                <Outbound />
              </ProtectedRoute>
            }
          />
          <Route
            path="/campaigns"
            element={
              <ProtectedRoute>
                <Campaigns />
              </ProtectedRoute>
            }
            <Route path="/conversations" element={<Conversations />} />

          />
        </Route>
        {/* catch all unknown routes and redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
