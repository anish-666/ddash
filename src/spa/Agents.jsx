import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

/**
 * List the available Bolna agents.  Displays a small
 * table with the name, provider agent ID and a
 * placeholder for status.  If no agents are found
 * displays a friendly message.
 */
export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.agents()
      .then(data => {
        if (!alive) return;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.items)
            ? data.items
            : [];
        setAgents(list);
      })
      .catch(err => {
        if (!alive) return;
        setError(err.message || 'Failed to load agents');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="stack-lg">
      <h1>Agents</h1>
      {loading && <div>Loading…</div>}
      {error && <div className="error">{error}</div>}
      {!loading && agents.length === 0 && !error && <div>No agents found.</div>}
      {agents.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '0.5rem' }}>Name</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '0.5rem' }}>Agent ID</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb', padding: '0.5rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(a => (
              <tr key={a.provider_agent_id || a.id}>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f0f0f0' }}>{a.name || a.agent_name || a.provider_agent_id}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f0f0f0' }}>{a.provider_agent_id || a.id}</td>
                <td style={{ padding: '0.5rem', borderBottom: '1px solid #f0f0f0' }}>{a.active ? 'Active' : 'Inactive'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}