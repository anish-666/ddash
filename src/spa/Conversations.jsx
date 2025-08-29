import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Conversations() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    api.conversations()
      .then(d => live && setRows(Array.isArray(d) ? d : []))
      .catch(e => live && setErr(e.message || 'Failed to load'));
    return () => { live = false; };
  }, []);

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
                <td>
                  {r.recording_url ? (
                    <audio controls src={r.recording_url} style={{ maxWidth: 220 }} />
                  ) : '—'}
                </td>
                <td>
                  {r.transcript_url ? <a href={r.transcript_url} target="_blank" rel="noreferrer">Open</a> : '—'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '1rem' }}>
                No conversations yet. Make a call and ensure Bolna webhook points to this site.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
