import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const DEFAULT_CALLER = import.meta.env.OUTBOUND_CALLER_ID || '(set OUTBOUND_CALLER_ID)';

/**
 * Outbound call page.  Allows the user to select an
 * agent and paste a list of phone numbers to call.  On
 * submission the numbers are sent to the backend which
 * fans out the calls through Bolna.  Results from
 * Bolna are shown in a response panel.
 */
export default function Outbound() {
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState('');
  const [numbersText, setNumbersText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    let alive = true;
    api.agents()
      .then(list => alive && setAgents(Array.isArray(list) ? list : []))
      .catch(() => alive && setAgents([]));
    return () => {
      alive = false;
    };
  }, []);

  const numbers = useMemo(
    () =>
      numbersText
        .split(/[\s,;\n]+/)
        .map(s => s.trim())
        .filter(Boolean),
    [numbersText]
  );

  async function startOutbound(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    if (numbers.length === 0) {
      setError('Add at least one phone number');
      return;
    }
    try {
      setLoading(true);
      const res = await api.outbound(numbers, agentId || undefined);
      setResult(res);
    } catch (e) {
      setError(e.message || 'Failed to start calls');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack-lg">
      <h1>Outbound Calls</h1>
      <div className="card stack">
        <form className="stack" onSubmit={startOutbound}>
          <div className="grid2">
            <div className="stack">
              <label className="label">Agent</label>
              <select className="input" value={agentId} onChange={e => setAgentId(e.target.value)}>
                <option value="">(Default)</option>
                {agents.map(a => (
                  <option key={a.provider_agent_id || a.id} value={a.provider_agent_id || a.id}>
                    {a.name || a.agent_name || a.provider_agent_id}
                  </option>
                ))}
              </select>
              <div className="muted">
                Caller ID (From): <b>{DEFAULT_CALLER}</b>
              </div>
            </div>

            <div className="stack">
              <label className="label">Phone numbers</label>
              <textarea
                className="input"
                rows={6}
                value={numbersText}
                onChange={e => setNumbersText(e.target.value)}
                placeholder="+911234567890, +919876543210"
              />
              <div className="muted">
                Count: <b>{numbers.length}</b>
              </div>
            </div>
          </div>

          {error && <div className="error">{error}</div>}
          <button className="btn btn-primary" disabled={loading} type="submit">
            {loading ? 'Starting…' : 'Start Outbound'}
          </button>
        </form>
      </div>

      {result && (
        <div className="card">
          <div className="card-title">Provider response</div>
          <pre className="pre">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
