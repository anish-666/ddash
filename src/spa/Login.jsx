import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      nav('/', { replace: true }); // go to dashboard
    } catch (e) {
      setErr(e.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: 360, padding: 16 }}>
        <div className="login-header" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, marginBottom:12 }}>
          <img src="/logo.png" alt="Docvai logo" style={{ height: 48 }} />
          <div className="login-title" style={{ margin:0, fontWeight:700, fontSize:20 }}>Docvai Dashboard</div>
          <div className="login-subtitle" style={{ margin:0, fontSize:13, opacity:0.75 }}>Sign in to continue</div>
        </div>

        <form className="stack" onSubmit={onSubmit}>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />

          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />

          {err && <div className="error">{err}</div>}

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
