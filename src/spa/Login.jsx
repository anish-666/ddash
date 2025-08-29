import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../lib/useAuth.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const redirectTo = (loc.state && loc.state.from && loc.state.from.pathname) || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    try {
      setLoading(true);
      await login(email, password);
      nav(redirectTo, { replace: true });
    } catch (e) {
      setErr(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-panel card">
        <div className="login-header">
  <img
    src="/logo.png"
    alt="Docvai logo"
    style={{ height: 128, margin: '0 auto' }}
  />
  <div className="login-title" style={{ marginTop: 0 }}>Dashboard</div>
  <div className="login-subtitle">Sign in to continue</div>

        </div>

        <form className="stack" onSubmit={onSubmit}>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            placeholder="you@docvai.com"
            required
            autoFocus
          />

          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {err && <div className="error">{err}</div>}

          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-footer muted">
          <span>Need access?</span>{' '}
          <Link to="#" onClick={e=>e.preventDefault()}>contact admin</Link>
        </div>
      </div>
    </div>
  );
}
