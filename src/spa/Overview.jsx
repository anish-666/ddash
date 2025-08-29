import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Line } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';

// Register all chart.js components globally so that
// react-chartjs-2 can render charts without warnings.
Chart.register(...registerables);

/**
 * Overview dashboard.  Displays key summary metrics
 * aggregated over a configurable time window and a
 * simple line chart of calls per day.  In the absence
 * of a backing database the server generates random
 * sample data.  The window selector triggers a
 * refetch when changed.
 */
export default function Overview() {
  const [summary, setSummary] = useState(null);
  const [timeseries, setTimeseries] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [windowSize, setWindowSize] = useState('7d');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      api.analyticsSummary(windowSize),
      api.analyticsTimeseries(windowSize)
    ])
      .then(([s, t]) => {
        if (!alive) return;
        setSummary(s || {});
        setTimeseries(t || {});
      })
      .catch(err => {
        if (!alive) return;
        setError(err.message || 'Failed to fetch analytics');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [windowSize]);

  const chartData = timeseries && Array.isArray(timeseries.series)
    ? {
        labels: timeseries.series.map(item => item.date),
        datasets: [
          {
            label: 'Number of Calls',
            data: timeseries.series.map(item => item.calls || 0),
            borderColor: '#2b6cb0',
            backgroundColor: 'rgba(43,108,176,0.1)',
            tension: 0.2,
            fill: true
          }
        ]
      }
    : { labels: [], datasets: [] };

  return (
    <div className="stack-lg">
      <h1>Overview</h1>
      <div className="stack" style={{ maxWidth: '200px' }}>
        <label className="label">Window</label>
        <select className="input" value={windowSize} onChange={e => setWindowSize(e.target.value)}>
          <option value="7d">Last 7 days</option>
          <option value="14d">Last 14 days</option>
          <option value="30d">Last 30 days</option>
        </select>
      </div>
      {loading && <div>Loading…</div>}
      {error && <div className="error">{error}</div>}
      {!loading && summary && (
        <div className="grid2">
          <div className="card">
            <div className="card-title">Total Call Minutes</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{summary.total_call_minutes ?? '-'}</div>
          </div>
          <div className="card">
            <div className="card-title">Number of Calls</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{summary.number_of_calls ?? '-'}</div>
          </div>
          <div className="card">
            <div className="card-title">Average Interaction Count</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{summary.average_interaction_count ?? '-'}</div>
          </div>
          <div className="card">
            <div className="card-title">Interactions</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{summary.total_interactions ?? '-'}</div>
          </div>
        </div>
      )}
      {timeseries && timeseries.series && (
        <div className="card">
          <div className="card-title">Calls Over Time</div>
          <Line data={chartData} />
        </div>
      )}
    </div>
  );
}