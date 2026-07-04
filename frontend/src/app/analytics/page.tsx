'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { MessageSquare, Users, Clock, TrendingUp, RefreshCw, ArrowUpRight } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { analyticsAPI } from '@/lib/api';
import toast from 'react-hot-toast';

const AGENT_COLORS: Record<string, string> = {
  billing:   '#F59E0B',
  technical: '#3B82F6',
  product:   '#10B981',
  complaint: '#EF4444',
  faq:       '#8B5CF6',
};

const PALETTE = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#06B6D4'];

function StatCard({
  icon: Icon, label, value, sub, trend, color = '#6366F1'
}: {
  icon: any; label: string; value: string | number; sub?: string; trend?: string; color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5 card-hover"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: `${color}15` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
            style={{ background: '#10B98115', color: '#10B981' }}>
            <ArrowUpRight className="w-3 h-3" />
            {trend}
          </div>
        )}
      </div>
      <p className="text-2xl font-semibold mb-0.5" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
        {value}
      </p>
      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-disabled)' }}>{sub}</p>}
    </motion.div>
  );
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2.5 rounded-xl text-xs shadow-lg"
      style={{
        background: 'var(--bg-overlay)',
        border: '1px solid var(--border-default)',
        boxShadow: 'var(--shadow-lg)'
      }}>
      {label && <p className="mb-1.5 font-medium" style={{ color: 'var(--text-tertiary)' }}>{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-medium" style={{ color: p.color || p.fill }}>
          {p.name}: <span style={{ color: 'var(--text-primary)' }}>{p.value}</span>
        </p>
      ))}
    </div>
  );
};

function SkeletonCard() {
  return (
    <div className="card p-5">
      <div className="skeleton w-9 h-9 rounded-lg mb-4" />
      <div className="skeleton h-7 w-20 rounded mb-2" />
      <div className="skeleton h-4 w-28 rounded" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="card p-5">
      <div className="skeleton h-4 w-32 rounded mb-6" />
      <div className="skeleton rounded-xl" style={{ height: 200 }} />
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await analyticsAPI.get();
      setData(res.data);
    } catch {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <AppLayout>
      <div className="h-full overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-7">
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Analytics
              </h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                Platform performance and usage insights
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="btn btn-secondary btn-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2"><SkeletonChart /></div>
                <SkeletonChart />
              </div>
            </div>
          ) : data ? (
            <div className="space-y-5">
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={MessageSquare}
                  label="Total Chats"
                  value={data.total_chats.toLocaleString()}
                  color="#6366F1"
                />
                <StatCard
                  icon={Users}
                  label="Total Users"
                  value={data.total_users.toLocaleString()}
                  color="#10B981"
                />
                <StatCard
                  icon={Clock}
                  label="Avg Response"
                  value={`${(data.avg_response_time_ms / 1000).toFixed(1)}s`}
                  color="#3B82F6"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Top Agent"
                  value={data.agent_usage[0]?.agent
                    ? data.agent_usage[0].agent.charAt(0).toUpperCase() + data.agent_usage[0].agent.slice(1)
                    : '—'}
                  sub={data.agent_usage[0] ? `${data.agent_usage[0].percentage}% of queries` : ''}
                  color="#F59E0B"
                />
              </div>

              {/* Charts row 1 */}
              <div className="grid lg:grid-cols-3 gap-4">
                {/* Line chart */}
                <div className="card p-5 lg:col-span-2">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Conversations over time
                    </h3>
                    <span className="text-xs" style={{ color: 'var(--text-disabled)' }}>Last 30 days</span>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data.chats_per_day}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: 'var(--text-disabled)', fontSize: 10 }}
                        tickFormatter={(v) => v.slice(5)}
                        interval="preserveStartEnd"
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: 'var(--text-disabled)', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="count"
                        name="Chats"
                        stroke="#6366F1"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#6366F1', strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Pie chart */}
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
                    Agent distribution
                  </h3>
                  {data.agent_usage.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie
                            data={data.agent_usage}
                            dataKey="count"
                            nameKey="agent"
                            cx="50%" cy="50%"
                            innerRadius={40} outerRadius={60}
                            paddingAngle={3}
                          >
                            {data.agent_usage.map((e: any, i: number) => (
                              <Cell key={e.agent} fill={AGENT_COLORS[e.agent] || PALETTE[i % PALETTE.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2 mt-3">
                        {data.agent_usage.map((a: any, i: number) => (
                          <div key={a.agent} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: AGENT_COLORS[a.agent] || PALETTE[i % PALETTE.length] }} />
                              <span className="text-xs capitalize" style={{ color: 'var(--text-secondary)' }}>{a.agent}</span>
                            </div>
                            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                              {a.percentage}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-40 flex items-center justify-center">
                      <p className="text-sm" style={{ color: 'var(--text-disabled)' }}>No data yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Charts row 2 */}
              <div className="grid lg:grid-cols-2 gap-4">
                {/* Intent bar */}
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
                    Intent distribution
                  </h3>
                  {data.most_common_intents.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={data.most_common_intents} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: 'var(--text-disabled)', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis
                          dataKey="intent"
                          type="category"
                          tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={68}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="count" name="Queries" radius={[0, 4, 4, 0]}>
                          {data.most_common_intents.map((e: any, i: number) => (
                            <Cell key={e.intent} fill={AGENT_COLORS[e.intent] || PALETTE[i % PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-40 flex items-center justify-center">
                      <p className="text-sm" style={{ color: 'var(--text-disabled)' }}>No data yet</p>
                    </div>
                  )}
                </div>

                {/* Agent bar */}
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)' }}>
                    Agent usage count
                  </h3>
                  {data.agent_usage.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={data.agent_usage}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="agent" tick={{ fill: 'var(--text-disabled)', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'var(--text-disabled)', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="count" name="Uses" radius={[4, 4, 0, 0]}>
                          {data.agent_usage.map((e: any, i: number) => (
                            <Cell key={e.agent} fill={AGENT_COLORS[e.agent] || PALETTE[i % PALETTE.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-40 flex items-center justify-center">
                      <p className="text-sm" style={{ color: 'var(--text-disabled)' }}>No data yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p style={{ color: 'var(--text-tertiary)' }}>Failed to load analytics</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
