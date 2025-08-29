import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * Campaign creation page.  For now campaigns are a
 * convenient wrapper around batch outbound calls.  The
 * user can set a name, choose an agent, upload a CSV
 * of phone numbers or paste numbers manually.  When
 * submitted the numbers are fanned out to the
 * outbound API.  Additional scheduling fields are
 * present but unused – they are shown to anticipate
 * future enhancements such as scheduling and rate
 * limiting.
 */
export default function Campaigns() {
  const [agents, setAgents] = useState([]);
  const [name, setName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [numbersText, setNumbersText] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    api.agents()
      .then(list => alive && setAgents(Array.isArray(list) ? list : []))
      .catch(() => alive && setAgents([]));
    return () => {
      alive = false;
    };
  }, []);

  function parseCsv(text) {
    const lines = text.trim().split(/[\n\r]+/);
    const nums = [];
    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length > 0) {
        const phone = parts[0].trim();
        if (phone) nums.push(phone);
      }
    }
    return nums;
  }

  useEffect(() => {
    if (csvFile) {
      const reader = new FileReader();
      reader.onload = e => {
        const text = e.target.result;
        setNumbersText(parseCsv(text).join('\n'));
      };
      reader.readAsText(csvFile);
    }
  }, [csvFile]);

  const numbers = useMemo(
    () =>
      numbersText
        .split(/[\s,;\n]+/)
        .map(s => s.trim())
        .filter(Boolean),
    [numbersText]
  );

  async function createCampaign(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!name) {
      setError('Campaign name required');
      return;
    }
    if (numbers.length === 0) {
      setError('Add at least one phone number');
      return;
    }
    try {
      setLoading(true);
      const res = await api.outbound(numbers, agentId || undefined);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stack-lg">
      <h1>Campaigns</h1>
      <div className="card stack">
        <form className="stack" onSubmit={createCampaign}>
          <label className="label">Campaign Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Campaign name" />

          <label className="label">Agent</label>
          <select className="input" value={agentId} onChange={e => setAgentId(e.target.value)}>
            <option value="">(Default)</option>
            {agents.map(a => (
              <option key={a.provider_agent_id || a.id} value={a.provider_agent_id || a.id}>
                {a.name || a.agent_name || a.provider_agent_id}
              </option>
            ))}
          </select>

          <label className="label">Upload CSV of leads (first column must be phone)</label>
          <input className="input" type="file" accept=".csv" onChange={e => setCsvFile(e.target.files[0])} />

          <label className="label">Or paste phone numbers</label>
          <textarea
            className="input"
            rows={5}
            value={numbersText}
            onChange={e => setNumbersText(e.target.value)}
            placeholder="+919999999999\n+911234567890"
          />
          <div className="muted">
            Count: <b>{numbers.length}</b>
          </div>

          {error && <div className="error">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Starting…' : 'Create Campaign'}
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