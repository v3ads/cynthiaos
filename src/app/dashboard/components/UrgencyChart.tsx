'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface UrgencyChartProps {
  high: number;
  medium: number;
  low: number;
}

const COLORS = {
  HIGH: '#ef4444',
  MEDIUM: '#f97316',
  LOW: '#22c55e',
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const colorMap: Record<string, string> = { HIGH: '#ef4444', MEDIUM: '#f97316', LOW: '#22c55e' };
  return (
    <div className="bg-surface-elevated border border-border rounded-lg shadow-xl px-3 py-2.5">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">{label} Urgency</p>
      <p className="text-base font-bold tabular-nums" style={{ color: colorMap[label || ''] || '#fff' }}>
        {payload[0].value} lease{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

export default function UrgencyChart({ high, medium, low }: UrgencyChartProps) {
  const data = [
    { name: 'HIGH', leases: high, label: '0–30 days' },
    { name: 'MEDIUM', leases: medium, label: '31–60 days' },
    { name: 'LOW', leases: low, label: '61–90 days' },
  ];

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -24, bottom: 0 }} barSize={48}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(228 12% 22%)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: 'hsl(220 8% 42%)', fontSize: 12, fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'hsl(220 8% 42%)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(228 14% 17%)' }} />
        <Bar dataKey="leases" radius={[4, 4, 0, 0]}>
          {data.map(entry => (
            <Cell key={`cell-${entry.name}`} fill={COLORS[entry.name as keyof typeof COLORS]} opacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}