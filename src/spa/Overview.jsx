import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

function Kpi({ label, value, sub }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
      {sub ? <div className="muted" style={{ fontSize: 12 }}>{sub}</div> : null}
    </div>
  );
}

function ChartCard({ title, children, height=280 }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="card-title">{title}</div>
      <div style={{ height, position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}

export default function Overview() {
  const [sum, setSum] = useState(null);
  const [ts, setTs] = useState(null);
  const [err, setErr] = useState('');

  async function load() {
    setErr('');
    try {
      const [s, t] = await Promise.all([
        api.analyticsSummary('7d'),
        api.analyticsTimeseries('7d')
      ]);
      setSum(s);
      setTs(t);
    } catch (e) {
      setErr(e.message || 'Failed to load analytics');
    }
  }

  useEffect(() => { load(); }, []);

  const k = sum?.totals || {
    total: 0, inbound: 0, outbound: 0, completed: 0, avgDurationSec: 0, recordings: 0, transcripts: 0
  };

  const labels = ts?.labels || [];
  const dTotal = ts?.total || [];
  const dInbound = ts?.inbound || [];
  const dOutbound = ts?.outbound || [];
  const dCompleted = ts?.completed || [];
  const dAvg = ts?.avgDuration || [];

  return (
    <div className="stack-lg">
      <h1>Overview</h1>
      {err && <div className="error">{err}</div>}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 12 }}>
        <Kpi label="Total calls" value={k.total} />
        <Kpi label="Inbound" value={k.inbound} />
        <Kpi label="Outbound" value={k.outbound} />
        <Kpi label="Completed" value={k.completed} />
        <Kpi label="Avg duration" value={`${k.avgDurationSec || 0}s`} />
        <Kpi label="Transcripts" value={k.transcripts} sub={`${k.transcripts}/${k.total || 0}`} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <ChartCard title="Calls per day">
          <Line
            data={{
              labels,
              datasets: [
                { label: 'Total', data: dTotal, borderWidth: 2, tension: 0.3 },
                { label: 'Completed', data: dCompleted, borderWidth: 2, tension: 0.3 }
              ]
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
          />
        </ChartCard>

        <ChartCard title="Inbound vs Outbound">
          <Bar
            data={{
              labels,
              datasets: [
                { label: 'Inbound', data: dInbound, stack: 'calls' },
                { label: 'Outbound', data: dOutbound, stack: 'calls' }
              ]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom' } },
              scales: { x: { stacked: true }, y: { stacked: true } }
            }}
          />
        </ChartCard>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <ChartCard title="Average duration (s)" height={220}>
          <Line
            data={{ labels, datasets: [{ label: 'Avg duration (s)', data: dAvg, borderWidth: 2, tension: 0.3 }] }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
          />
        </ChartCard>

        <ChartCard title="Transcripts captured" height={220}>
          <Bar
            data={{
              labels: ['Last 7 days'],
              datasets: [
                { label: 'With transcript', data: [k.transcripts] },
                { label: 'Without transcript', data: [Math.max(0, (k.total||0) - (k.transcripts||0))] }
              ]
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
          />
        </ChartCard>
      </div>
    </div>
  );
}
