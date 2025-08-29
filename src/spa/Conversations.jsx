import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

const OUTBOUND_CALLER = import.meta.env.VITE_OUTBOUND_CALLER_ID || '';

export default function Conversations() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState('');
  const [openText, setOpenText] = useState(null);

  // NEW: batch import
  const [idsText, setIdsText] = useState('');
  const ids = useMemo(() =>
    idsText.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean),
    [idsText]
  );

  async function load() {
    setErr('');
    try { setRows(await api.conversations()); }
    catch (e) { setErr(e.message || 'Failed to load'); }
  }

  useEffect(() => { load(); }, []);

  function directionOf(r) {
    if (!OUTBOUND_CALLER) return '';
    if (r.from_number === OUTBOUND_CALLER) return 'Outbound';
    if (r.to_number === OUTBOUND_CALLER) return 'Inbound';
    return '';
  }

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const fields = [
        r.to_number || '',
        r.from_number || '',
        r.status || '',
        (r.provider_call_id || '')
      ].join(' ').toLowerCase();
      return fields.includes(q);
    });
  }, [rows, filter]);

  async function refreshRow(r) {
    if (!r.provider_call_id) return;
    setBusy(r.provider_call_id);
    try {
      const base = import.meta.env.VITE_API_BASE || '/.netlify/functions';
      const res = await fetch(`${base}/provider-poll?id=${encodeURIComponent(r.provider_call_id)}`, { credentials: 'include' });
      const json = await res.json().catch(() => null);
      console.groupCollapsed('Provider poll', r.provider_call_id);
      console.log(json);
      console.groupEnd();
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function refreshAllPending() {
    const pending = rows.filter(r =>
      (!r.recording_url && !r.transcript_text && !r.transcript_url) ||
      (r.status && r.status.toLowerCase() !== 'completed')
    );
    if (pending.length === 0) return;

    setBusy('__all__');
    try {
      const base = import.meta.env.VITE_API_BASE || '/.netlify/functions';
      for (const r of pending) {
        if (!r.provider_call_id) continue;
        await fetch(`${base}/provider-poll?id=${encodeURIComponent(r.provider_call_id)}`, { credentials: 'include' });
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function syncRecent() {
    setSyncing(true);
    try {
      const base = import.meta.env.VITE_API_BASE || '/.netlify/functions';
      await fetch(`${base}/provider-sync?minutes=240`, { credentials: 'include' });
      await load();
    } finally {
      setSyncing(false);
    }
  }

  // NEW: Import many execution IDs at once
  async function importIds(e) {
    e.preventDefault();
    if (ids.length === 0) return;
    setBusy('__import__');
    try {
      const base = import.meta.env.VITE_API_BASE || '/.netlify/functions';
      const res = await fetch(`${base}/provider-import`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      const json = await res.json().catch(() => null);
      console.groupCollapsed('Provider import result');
      console.log(json);
      console.groupEnd();
      setIdsText('');
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack-lg">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1>Conversations</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input"
            placeholder="Filter by number or status…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ width: 240 }}
          />
          <button className="btn" onClick={refreshAllPending} disabled={busy === '__all__'}>
            {busy === '__all__' ? 'Refreshing…' : 'Refresh all pending'}
          </button>
          <button className="btn btn-secondary" onClick={syncRecent} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync recent'}
          </button>
        </div>
      </div>

      {OUTBOUND_CALLER ? (
        <div className="muted">Caller ID: <b>{OUTBOUND_CALLER}</b> — Direction is inferred using this number.</div>
      ) : (
        <div className="muted">Set <b>VITE_OUTBOUND_CALLER_ID</b> to show Inbound/Outbound direction.</div>
      )}

      {/* NEW: Import panel */}
      <div className="card stack">
        <div className="card-title">Import inbound by Execution ID (one per line or separated by spaces)</div>
        <form className="stack" onSubmit={importIds}>
          <textarea
            className="input"
            rows={3}
            placeholder="18c99837-29bb-47e9-9420-9c7b7b07e23e"
            value={idsText}
            onChange={e => setIdsText(e.target.value)}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="muted">Count: <b>{ids.length}</b></div>
            <button className="btn" type="submit" disabled={busy === '__import__' || ids.length === 0}>
              {busy === '__import__' ? 'Importing…' : 'Import'}
            </button>
          </div>
        </form>
      </div>

      {err && <div className="error">{err}</div>}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Direction</th>
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
            {filtered.map(r => {
              const dir = directionOf(r);
              const isBusy = busy === r.provider_call_id;
              return (
                <tr key={r.id}>
                  <td>{r.started_at ? new Date(r.started_at).toLocaleString() : new Date(r.created_at).toLocaleString()}</td>
                  <td>
                    {dir ? (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: dir === 'Outbound' ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)',
                          color: dir === 'Outbound' ? '#1d4ed8' : '#065f46',
                          fontSize: 12,
                          fontWeight: 600
                        }}
                      >
                        {dir}
                      </span>
                    ) : '—'}
                  </td>
                  <td>{r.to_number || '-'}</td>
                  <td>{r.from_number || '-'}</td>
                  <td>{r.status || '-'}</td>
                  <td>{Number.isFinite(r.duration_sec) ? `${r.duration_sec}s` : '-'}</td>
                  <td>
                    {r.recording_url
                      ? <audio controls src={r.recording_url} style={{ maxWidth: 220 }} />
                      : '—'}
                  </td>
                  <td>
                    {r.transcript_url ? (
                      <a href={r.transcript_url} target="_blank" rel="noreferrer">Open</a>
                    ) : r.transcript_text ? (
                      <button className="btn" onClick={() => setOpenText(r.transcript_text)}>View</button>
                    ) : '—'}
                  </td>
                  <td>
                    {r.provider_call_id &&
                      <button className="btn btn-secondary" onClick={() => refreshRow(r)} disabled={isBusy}>
                        {isBusy ? 'Refreshing…' : 'Refresh'}
                      </button>}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '1rem' }}>
                  {rows.length === 0
                    ? 'No conversations yet. Paste Inbound Execution IDs above or make a call.'
                    : 'No results for this filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openText && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
          }}
          onClick={() => setOpenText(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 640, width: '100%', maxHeight: '80vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-title">Transcript</div>
            <pre className="pre" style={{ whiteSpace: 'pre-wrap' }}>{openText}</pre>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setOpenText(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
