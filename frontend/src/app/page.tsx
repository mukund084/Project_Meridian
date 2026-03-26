"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/badge";
import {
  getBids,
  getSignals,
  getSignalStats,
  getMeetings,
  getPDFDocuments,
  type Bid,
  type Signal,
  type SignalStat,
  type Meeting,
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
  const highConfidence = stats.reduce((sum, s) => {
    return sum + (s.avg_confidence >= 0.7 ? s.count : 0);
  }, 0);

  if (loading) {
    return (
      <div className="p-10">
        <div className="text-outline text-sm">Loading intelligence...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-outline font-semibold mb-1">
            Strategic Overview
          </p>
          <h1 className="text-[2.2rem] font-bold text-slate-deep leading-tight">
            Intelligence Command
          </h1>
        </div>
        <div className="flex gap-3 mt-2">
          <button className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-deep bg-surface-low hover:bg-surface-high transition-colors">
            Export Report
          </button>
          <button className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-on-primary bg-primary hover:bg-primary-container transition-colors">
            New Signal Scan
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6 mb-10">
        <StatCard label="Total Active Bids" value={bids.length} accent="+12%" />
        <StatCard label="High-Confidence Signals" value={highConfidence} accent="New Today" accentColor="text-primary-container" />
        <StatCard label="Processed Docs" value={docStats.total.toLocaleString()} accent={`${docStats.pending} Pending`} />
        <StatCard label="Upcoming Meetings" value={String(meetings.length).padStart(2, "0")} accent="Critical" accentColor="text-primary-container" />
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-12 gap-8">
        {/* Recent Intelligence Signals — left 8 cols */}
        <div className="col-span-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[1rem] font-bold text-slate-deep">
              Recent Intelligence Signals
            </h2>
            <Link href="/signals" className="text-xs font-bold uppercase tracking-wider text-outline hover:text-slate-deep transition-colors">
              View All Signals
            </Link>
          </div>

          <div className="bg-white">
            {signals.map((s, i) => (
              <div
                key={i}
                className="px-6 py-5 flex items-start justify-between hover:bg-surface-low/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="gold">
                      {formatStage(s.procurement_stage || s.signal_type)}
                    </Badge>
                    <span className="text-[0.7rem] uppercase tracking-wider text-outline">
                      Detected {formatTimeAgo(s.extracted_at)}
                    </span>
                  </div>
                  <h3 className="text-[0.95rem] font-semibold text-slate-deep mb-1">
                    {s.summary.length > 60 ? s.summary.slice(0, 60) : s.summary}
                  </h3>
                  <p className="text-sm text-outline line-clamp-1">
                    {s.raw_excerpt.slice(0, 120)}...
                  </p>
                </div>
                <div className="ml-6 text-right shrink-0">
                  <p className="text-2xl font-bold text-slate-deep">
                    {(s.confidence * 100).toFixed(0)}%
                  </p>
                  <p className="text-[0.65rem] uppercase tracking-wider text-outline">
                    Confidence
                  </p>
                </div>
              </div>
            ))}
            {signals.length === 0 && (
              <div className="px-6 py-12 text-center text-outline text-sm">
                No high-value signals detected yet.
              </div>
            )}
          </div>
        </div>

        {/* Right panel — 4 cols */}
        <div className="col-span-4 space-y-6">
          {/* Ingestion Status */}
          <div>
            <h3 className="text-[0.7rem] uppercase tracking-[0.2em] text-outline font-semibold mb-3">
              Ingestion Status
            </h3>
            <div className="bg-slate-deep p-5 text-white">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider">Pipeline Health</p>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 15l4-6 4 4 6-8" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="uppercase tracking-wider font-semibold">Extracted</span>
                    <span className="font-bold">
                      {docStats.total > 0
                        ? Math.round(((docStats.total - docStats.pending) / docStats.total) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/10">
                    <div
                      className="h-full bg-primary-container"
                      style={{
                        width: `${docStats.total > 0 ? ((docStats.total - docStats.pending) / docStats.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="uppercase tracking-wider font-semibold">Pending</span>
                    <span className="font-bold text-secondary-container">
                      {docStats.total > 0
                        ? Math.round((docStats.pending / docStats.total) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/10">
                    <div
                      className="h-full bg-secondary-container"
                      style={{
                        width: `${docStats.total > 0 ? (docStats.pending / docStats.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <p className="text-[0.7rem] text-white/50 mt-4 leading-relaxed">
                System currently processing procurement PDFs and meeting transcripts.
              </p>
            </div>
          </div>

          {/* Critical Briefings */}
          <div>
            <h3 className="text-[0.7rem] uppercase tracking-[0.2em] text-outline font-semibold mb-3">
              Critical Briefings
            </h3>
            <div className="space-y-0">
              {meetings.slice(0, 3).map((m, i) => (
                <div key={i} className="bg-white px-5 py-4 flex items-start gap-3 hover:bg-surface-low/30 transition-colors">
                  <div className="w-8 h-8 bg-surface-low flex items-center justify-center shrink-0 mt-0.5">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="5" cy="5" r="2.5" stroke="#74777f" strokeWidth="1.2" />
                      <path d="M1 14c0-2.5 2-4 5-4" stroke="#74777f" strokeWidth="1.2" />
                      <circle cx="11" cy="6" r="2" stroke="#74777f" strokeWidth="1.2" />
                      <path d="M8 14c0-2 1.5-3 4-3" stroke="#74777f" strokeWidth="1.2" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-wider text-primary-container font-bold">
                      {m.meeting_date}
                    </p>
                    <p className="text-sm font-medium text-slate-deep">
                      {m.meeting_title}
                    </p>
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

// ── Helpers ──

function StatCard({
  label,
  value,
  accent,
  accentColor = "text-primary-container",
}: {
  label: string;
  value: string | number;
  accent?: string;
  accentColor?: string;
}) {
  return (
    <div className="bg-white p-6">
      <p className="text-[0.7rem] uppercase tracking-[0.15em] text-outline font-semibold mb-3">
        {label}
      </p>
      <div className="flex items-end justify-between">
        <p className="text-[2.5rem] font-bold text-slate-deep leading-none">
          {value}
        </p>
        {accent && (
          <span className={`text-xs font-semibold ${accentColor}`}>
            {accent}
          </span>
        )}
      </div>
      {/* Gold underline accent */}
      <div className="mt-4 h-0.5 bg-secondary-container/30">
        <div className="h-full w-2/3 bg-secondary-container" />
      </div>
    </div>
  );
}

function formatStage(stage: string) {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimeAgo(dateStr: string) {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}
