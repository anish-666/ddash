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
    <div className="card" style={{ padding: 10, borderLeft: `4px solid ${color}`, minHeight: 64 }}>
      <div className="muted" style={{ fontSize: 12, lineHeight: 1 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

function ChartCard({ title, children, height = 200 }) {
  return (
    <div className="card" style={{ padding: 10 }}>
      <div className="card-title" style={{ marginBottom: 6 }}>{title}</div>
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
    <div className="stack-lg" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <h1>Overview</h1>
      {err && <div className="error">{err}</div>}

      {/* Compact KPI grid: 3 per row on desktop, auto-wrap on smaller screens */}
      <div
        className="grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 10
        }}
      >
        <Kpi label="Total calls" value={k.total} color={COLORS.total} />
        <Kpi label="Inbound" value={k.inbound} color={COLORS.inbound} />
        <Kpi label="Outbound" value={k.outbound} color={COLORS.outbound} />
        <Kpi label="Completed" value={k.completed} color={COLORS.completed} />
        <Kpi label="Avg duration" value={`${k.avgDurationSec || 0}s`} color={COLORS.avg} />
        <Kpi label="Transcripts" value={k.transcripts} color={COLORS.transcripts} />
      </div>

      {/* Charts row: line + stacked bars */}
   <div
  className="grid"
  style={{
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
    marginTop: 10
  }}
>
  <ChartCard title="Calls per day" height={200}>
    <Line
      data={{
        labels,
        datasets: [
          { label: 'Total', data: dTotal, borderColor: COLORS.total, backgroundColor: COLORS.total, tension: 0.3, pointRadius: 2, borderWidth: 2 },
          { label: 'Completed', data: dCompleted, borderColor: COLORS.completed, backgroundColor: COLORS.completed, tension: 0.3, pointRadius: 2, borderWidth: 2 }
        ]
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        interaction: { intersect: false, mode: 'nearest' },
        scales: { y: { ticks: { precision: 0 } } }
      }}
    />
  </ChartCard>

  <ChartCard title="Inbound vs Outbound" height={200}>
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
        scales: {
          x: { stacked: true },
          y: { stacked: true, ticks: { precision: 0 } }
        }
      }}
    />
  </ChartCard>
</div>

      {/* Second row: smaller charts */}
      <div
        className="grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginTop: 10
        }}
      >
        <ChartCard title="Average duration (s)" height={180}>
          <Line
            data={{
              labels,
              datasets: [
                { label: 'Avg duration (s)', data: dAvg, borderColor: COLORS.avg, backgroundColor: COLORS.avg, tension: 0.3, pointRadius: 2, borderWidth: 2 }
              ]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom' } },
              interaction: { intersect: false, mode: 'nearest' },
              scales: { y: { ticks: { precision: 0 } } }
            }}
          />
        </ChartCard>

        <ChartCard title="Transcripts captured" height={180}>
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
              plugins: { legend: { position: 'bottom' } },
              scales: { y: { ticks: { precision: 0 } } }
            }}
          />
        </ChartCard>
      </div>
    </div>
  );
}
