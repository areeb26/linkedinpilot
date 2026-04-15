import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const data = [
  { name: "Mon", connections: 45, accepted: 32, messages: 85, replies: 24, opportunities: 12 },
  { name: "Tue", connections: 52, accepted: 38, messages: 92, replies: 28, opportunities: 15 },
  { name: "Wed", connections: 48, accepted: 35, messages: 88, replies: 26, opportunities: 14 },
  { name: "Thu", connections: 65, accepted: 42, messages: 110, replies: 35, opportunities: 18 },
  { name: "Fri", connections: 58, accepted: 40, messages: 105, replies: 32, opportunities: 16 },
  { name: "Sat", connections: 35, accepted: 25, messages: 70, replies: 18, opportunities: 8 },
  { name: "Sun", connections: 40, accepted: 28, messages: 75, replies: 20, opportunities: 10 },
];

const ActivityChart = () => {
  return (
    <div className="bg-card p-6 rounded-xl border border-border/60 shadow-sm animate-slide-up stagger-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-foreground text-lg font-semibold tracking-tight">Activity Overview</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Your outreach performance over the last 7 days</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {[
            { label: 'Connections', color: 'bg-primary' },
            { label: 'Accepted', color: 'bg-warning' },
            { label: 'Messages', color: 'bg-orange-500' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="oklch(var(--border))" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'oklch(var(--muted-foreground))', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'oklch(var(--card))',
                border: '1px solid oklch(var(--border))',
                borderRadius: '8px',
                color: 'oklch(var(--foreground))'
              }}
              itemStyle={{ fontSize: '12px' }}
            />
            <Area
              type="monotone"
              dataKey="connections"
              stroke="oklch(var(--primary))"
              fill="oklch(var(--primary))"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="accepted"
              stroke="oklch(var(--warning))"
              fill="oklch(var(--warning))"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="messages"
              stroke="#f97316"
              fill="#f97316"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="replies"
              stroke="#ec4899"
              fill="#ec4899"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="opportunities"
              stroke="oklch(var(--accent))"
              fill="oklch(var(--accent))"
              fillOpacity={0.15}
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ActivityChart;