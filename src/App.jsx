import React from 'react';
import { Routes, Route, Navigate, Link, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/useAuth.jsx';
import Overview from './spa/Overview.jsx';
import Agents from './spa/Agents.jsx';
import Outbound from './spa/Outbound.jsx';
import Campaigns from './spa/Campaigns.jsx';
import Conversations from './spa/Conversations.jsx';
import Login from './spa/Login.jsx';

// Simple protected-route wrapper for React Router v6
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Docvai</div>
        <nav>
          <ul>
            <li><Link to="/">Overview</Link></li>
            <li><Link to="/agents">Agents</Link></li>
            <li><Link to="/outbound">Outbound</Link></li>
            <li><Link to="/campaigns">Campaigns</Link></li>
            <li><Link to="/conversations">Conversations</Link></li>
          </ul>
        </nav>
        <div className="spacer" />
        <div className="userSection">
          {user ? (
            <>
              <div className="muted">{user.email}</div>
              <button className="btn btn-secondary" onClick={logout}>Logout</button>
            </>
          ) : (
            <Link className="btn btn-primary" to="/login">Login</Link>
          )}
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />

        {/* Private app under the Layout */}
        <Route element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }>
          <Route index element={<Overview />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/outbound" element={<Outbound />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/conversations" element={<Conversations />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
