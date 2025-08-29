import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

const COLORS = {
  total: '#3b82f6',      // blue
  completed: '#10b981',  // green
  inbound: '#6366f1',    // indigo
  outbound: '#f59e0b',   // amber
  avg: '#ef4444',        // red
  transcripts: '#8b5cf6' // violet
};

function Kpi({ label, value, color }) {
  return (
    <div className="card" style={{ padding: 12, borderLeft: `5px solid ${color}` }}>
      <div className="muted" style={{ fontSize: 12, lineHeight: 1 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children, height = 260 }) {
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
    total: 0, inbound: 0, outbound: 0, completed: 0, avgDurationSec: 0, transcripts: 0
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

      {/* Compact KPI grid: auto-fit 150px min-width tiles */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <Kpi label="Total calls" value={k.total} color={COLORS.total} />
        <Kpi label="Inbound" value={k.inbound} color={COLORS.inbound} />
        <Kpi label="Outbound" value={k.outbound} color={COLORS.outbound} />
        <Kpi label="Completed" value={k.completed} color={COLORS.completed} />
        <Kpi label="Avg duration" value={`${k.avgDurationSec || 0}s`} color={COLORS.avg} />
        <Kpi label="Transcripts" value={k.transcripts} color={COLORS.transcripts} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 12, marginTop: 12 }}>
        <ChartCard title="Calls per day">
          <Line
            data={{
              labels,
              datasets: [
                { label: 'Total', data: dTotal, borderColor: COLORS.total, backgroundColor: COLORS.total, tension: 0.3 },
                { label: 'Completed', data: dCompleted, borderColor: COLORS.completed, backgroundColor: COLORS.completed, tension: 0.3 }
              ]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom' } },
              interaction: { intersect: false, mode: 'nearest' }
            }}
          />
        </ChartCard>

        <ChartCard title="Inbound vs Outbound">
          <Bar
            data={{
              labels,
              datasets: [
                { label: 'Inbound', data: dInbound, backgroundColor: COLORS.inbound, stack: 'calls' },
                { label: 'Outbound', data: dOutbound, backgroundColor: COLORS.outbound, stack: 'calls' }
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

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <ChartCard title="Average duration (s)" height={220}>
          <Line
            data={{
              labels,
              datasets: [
                { label: 'Avg duration (s)', data: dAvg, borderColor: COLORS.avg, backgroundColor: COLORS.avg, tension: 0.3 }
              ]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom' } },
              interaction: { intersect: false, mode: 'nearest' }
            }}
          />
        </ChartCard>

        <ChartCard title="Transcripts captured" height={220}>
          <Bar
            data={{
              labels: ['Last 7 days'],
              datasets: [
                { label: 'With transcript', data: [k.transcripts], backgroundColor: COLORS.transcripts },
                { label: 'Without transcript', data: [Math.max(0, (k.total || 0) - (k.transcripts || 0))], backgroundColor: '#94a3b8' }
              ]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom' } }
            }}
          />
        </ChartCard>
      </div>
    </div>
  );
}
