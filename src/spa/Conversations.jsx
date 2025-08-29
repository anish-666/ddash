import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Conversations() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(null);

  async function load() {
    setErr('');
    try { setRows(await api.conversations()); }
    catch(e){ setErr(e.message || 'Failed to load'); }
  }

  useEffect(() => { load(); }, []);

  async function refreshRow(r) {
    if (!r.provider_call_id) return;
    setBusy(r.provider_call_id);
    try {
      const base = import.meta.env.VITE_API_BASE || '/.netlify/functions';
      const res = await fetch(`${base}/provider-poll?id=${encodeURIComponent(r.provider_call_id)}`, { credentials: 'include' });
      const json = await res.json().catch(()=>null);
      // 🔎 Log everything we got back from the provider (for mapping)
      console.groupCollapsed('Provider poll', r.provider_call_id);
      console.log(json);
      console.groupEnd();
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack-lg">
      <h1>Conversations</h1>
      {err && <div className="error">{err}</div>}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>To</th>
              <th>From</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Recording</th>
              <th>Transcript</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{r.started_at ? new Date(r.started_at).toLocaleString() : new Date(r.created_at).toLocaleString()}</td>
                <td>{r.to_number || '-'}</td>
                <td>{r.from_number || '-'}</td>
                <td>{r.status || '-'}</td>
                <td>{Number.isFinite(r.duration_sec) ? `${r.duration_sec}s` : '-'}</td>
                <td>{r.recording_url ? <audio controls src={r.recording_url} style={{ maxWidth: 220 }} /> : '—'}</td>
                <td>{r.transcript_url ? <a href={r.transcript_url} target="_blank" rel="noreferrer">Open</a> : '—'}</td>
                <td>
                  {r.provider_call_id &&
                    <button className="btn btn-secondary" onClick={()=>refreshRow(r)} disabled={busy === r.provider_call_id}>
                      {busy === r.provider_call_id ? 'Refreshing…' : 'Refresh'}
                    </button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '1rem' }}>
                No conversations yet. Make a call (trial: to verified numbers). Then click Refresh if needed.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
