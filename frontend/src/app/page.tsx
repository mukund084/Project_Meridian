"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/badge";
import {
  getBids, getSignals, getSignalStats, getMeetings, getPDFDocuments,
  type Bid, type Signal, type SignalStat, type Meeting,
} from "@/lib/api";

export default function DashboardPage() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<SignalStat[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [docStats, setDocStats] = useState({ total: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getBids({ limit: 10 }),
      getSignals({ limit: 5, min_score: 0.5 }),
      getSignalStats(),
      getMeetings({ limit: 5 }),
      getPDFDocuments({ limit: 200 }),
    ])
      .then(([b, s, st, m, docs]) => {
        setBids(b);
        setSignals(s);
        setStats(st);
        setMeetings(m);
        const pending = docs.filter((d) => d.status === "pending").length;
        setDocStats({ total: docs.length, pending });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalSignals = stats.reduce((sum, s) => sum + s.count, 0);
  const highConfidence = stats.reduce((sum, s) => sum + (s.avg_confidence >= 0.7 ? s.count : 0), 0);

  if (loading) {
    return <div className="p-10"><div className="text-on-surface-variant text-sm">Loading intelligence...</div></div>;
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-label-sm text-on-surface-variant mb-1">Strategic Overview</p>
          <h1 className="text-[2.2rem] font-bold text-on-surface leading-tight">
            Intelligence Command
          </h1>
        </div>
        <div className="flex gap-3 mt-2">
          <button className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-on-surface bg-surface-low hover:bg-surface-high transition-colors rounded-sm">
            Export Report
          </button>
          <button className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-on-primary command-gradient hover:opacity-90 transition-opacity rounded-sm">
            New Signal Scan
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6 mb-10">
        <DashStatCard label="Total Active Bids" value={bids.length} accent="+12%" />
        <DashStatCard label="High-Confidence Signals" value={highConfidence} accent="New Today" accentType="active" />
        <DashStatCard label="Processed Docs" value={docStats.total.toLocaleString()} accent={`${docStats.pending} Pending`} />
        <DashStatCard label="Upcoming Meetings" value={String(meetings.length).padStart(2, "0")} accent="Active" accentType="active" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-8">
        {/* Recent Signals */}
        <div className="col-span-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[1rem] font-bold text-on-surface">Recent Intelligence Signals</h2>
            <Link href="/signals" className="text-label-sm text-on-surface-variant hover:text-primary transition-colors tracking-wider">
              View All Signals
            </Link>
          </div>
          <div className="bg-white rounded-sm">
            {signals.map((s, i) => (
              <div key={i} className="px-6 py-5 flex items-start justify-between hover:bg-surface-low/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="active">{formatStage(s.procurement_stage || s.signal_type)}</Badge>
                    <span className="text-label-sm text-on-surface-variant tracking-wider">
                      Detected {formatTimeAgo(s.extracted_at)}
                    </span>
                  </div>
                  <h3 className="text-[0.95rem] font-semibold text-on-surface mb-1">
                    {s.summary.length > 65 ? s.summary.slice(0, 65) + "\u2026" : s.summary}
                  </h3>
                  <p className="text-sm text-on-surface-variant line-clamp-1">{s.raw_excerpt.slice(0, 120)}...</p>
                </div>
                <div className="ml-6 text-right shrink-0">
                  <p className="text-2xl font-bold text-on-surface">{(s.confidence * 100).toFixed(0)}%</p>
                  <p className="text-label-sm text-on-surface-variant tracking-wider">Confidence</p>
                </div>
              </div>
            ))}
            {signals.length === 0 && (
              <div className="px-6 py-12 text-center text-on-surface-variant text-sm">No high-value signals detected.</div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="col-span-4 space-y-6">
          {/* Ingestion Status */}
          <div>
            <h3 className="text-label-sm text-on-surface-variant tracking-[0.2em] mb-3">Ingestion Status</h3>
            <div className="command-gradient p-5 text-white rounded-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider">Pipeline Health</p>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 15l4-6 4 4 6-8" stroke="#6ddc96" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="space-y-3">
                <ProgressRow label="Extracted" value={docStats.total > 0 ? Math.round(((docStats.total - docStats.pending) / docStats.total) * 100) : 0} color="bg-primary-fixed-dim" />
                <ProgressRow label="Pending" value={docStats.total > 0 ? Math.round((docStats.pending / docStats.total) * 100) : 0} color="bg-secondary-container" />
              </div>
              <p className="text-[0.7rem] text-white/50 mt-4 leading-relaxed">
                Processing procurement PDFs and meeting transcripts across Canadian municipalities.
              </p>
            </div>
          </div>

          {/* Critical Briefings */}
          <div>
            <h3 className="text-label-sm text-on-surface-variant tracking-[0.2em] mb-3">Critical Briefings</h3>
            <div className="space-y-0">
              {meetings.slice(0, 3).map((m, i) => (
                <div key={i} className="bg-white px-5 py-4 flex items-start gap-3 hover:bg-surface-low/30 transition-colors rounded-sm">
                  <div className="w-8 h-8 bg-primary-fixed/30 flex items-center justify-center shrink-0 mt-0.5 rounded-sm">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="5" cy="5" r="2.5" stroke="#00331b" strokeWidth="1.2" />
                      <path d="M1 13c0-2.5 2-4 5-4" stroke="#00331b" strokeWidth="1.2" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-label-sm text-primary font-bold tracking-wider">{m.meeting_date}</p>
                    <p className="text-sm font-medium text-on-surface">{m.meeting_title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashStatCard({ label, value, accent, accentType = "default" }: {
  label: string; value: string | number; accent?: string; accentType?: string;
}) {
  return (
    <div className="bg-white p-6 rounded-sm">
      <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-3">{label}</p>
      <div className="flex items-end justify-between">
        <p className="text-[2.5rem] font-bold text-on-surface leading-none">{value}</p>
        {accent && (
          <span className={`text-xs font-semibold ${accentType === "active" ? "text-primary-container" : "text-on-surface-variant"}`}>
            {accent}
          </span>
        )}
      </div>
      <div className="mt-4 h-0.5 bg-primary-fixed/20"><div className="h-full w-2/3 progress-gradient" /></div>
    </div>
  );
}

function ProgressRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="uppercase tracking-wider font-semibold">{label}</span>
        <span className="font-bold">{value}%</span>
      </div>
      <div className="h-2 bg-white/10 rounded-sm"><div className={`h-full ${color} rounded-sm`} style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function formatStage(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

function formatTimeAgo(d: string) {
  try {
    const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000);
    if (h < 1) return "Just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch { return ""; }
}
