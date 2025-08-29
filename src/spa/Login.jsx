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
    setLoading(true);
    try {
      await login(email.trim(), password);
      nav(redirectTo, { replace: true });
    } catch (e) {
      setErr(e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="login-wrap"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
        background: 'linear-gradient(180deg, #0b1020 0%, #0f172a 100%)'
      }}
    >
      <div
        className="login-panel card"
        style={{
          width: 'min(92vw, 420px)',
          padding: 18,
          borderRadius: 14,
          background: 'white',
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)'
        }}
      >
        <div
          className="login-header"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 12 }}
        >
          <img src="/logo.png" alt="Docvai logo" style={{ height: 128 }} />
          <div className="login-title" style={{ margin: 0, fontWeight: 700, fontSize: 20 }}>Dashboard</div>
          <div className="login-subtitle" style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            Sign in to continue
          </div>
        </div>

        <form className="stack" onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
          <label className="label" style={{ fontSize: 12, color: '#334155' }}>Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@docvai.com"
            required
            autoFocus
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0' }}
          />

          <label className="label" style={{ fontSize: 12, color: '#334155' }}>Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0' }}
          />

          {err && (
            <div className="error" style={{ background:'#fef2f2', color:'#b91c1c', border:'1px solid #fecaca', borderRadius: 10, padding: '8px 10px' }}>
              {err}
            </div>
          )}

          <button
            className="btn btn-primary"
            disabled={loading}
            type="submit"
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: '#0ea5e9',
              color: 'white',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-footer muted" style={{ marginTop: 10, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
          Need access?{' '}
          <Link to="#" onClick={e => e.preventDefault()} style={{ color: '#0ea5e9' }}>
            contact admin
          </Link>
        </div>
      </div>
    </div>
  );
}
