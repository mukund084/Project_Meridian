"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/badge";
import {
  getMeetings,
  getSignals,
  getCities,
  getPDFDocuments,
  type Meeting,
  type Signal,
  type PDFDoc,
} from "@/lib/api";

const FORMAT_VARIANTS: Record<string, "gold" | "crimson" | "muted" | "default"> = {
  minutes: "gold",
  agenda: "default",
  transcript: "muted",
};

export default function MeetingIntelligencePage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [criticalSignals, setCriticalSignals] = useState<Signal[]>([]);
  const [pipelineDocs, setPipelineDocs] = useState<PDFDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMeetings({ limit: 20 }),
      getCities(),
      getSignals({ limit: 3, min_score: 0.7 }),
      getPDFDocuments({ limit: 10 }),
    ])
      .then(([m, c, s, docs]) => {
        setMeetings(m);
        setCities(c);
        setCriticalSignals(s);
        setPipelineDocs(docs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalMeetings = meetings.length;
  const totalDocs = pipelineDocs.length;
  const completedDocs = pipelineDocs.filter((d) => d.status === "completed").length;
  const activePipeline = pipelineDocs.filter((d) => ["pending", "downloading", "extracting_text", "analyzing"].includes(d.status));

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
      <h1 className="text-[1.5rem] font-bold text-primary-container mb-6">
        Meeting Intelligence
      </h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6">
          <p className="text-[0.7rem] uppercase tracking-[0.15em] text-outline font-semibold mb-2">
            Annual Coverage
          </p>
          <div className="flex items-end justify-between">
            <p className="text-[2.5rem] font-bold text-slate-deep leading-none">
              {totalMeetings.toLocaleString()}
            </p>
            <Badge variant="gold">+12% YoY</Badge>
          </div>
          <p className="text-xs text-outline mt-2">Total meetings captured this year</p>
        </div>
        <div className="bg-white p-6">
          <p className="text-[0.7rem] uppercase tracking-[0.15em] text-outline font-semibold mb-2">
            Pipeline Velocity
          </p>
          <div className="flex items-end justify-between">
            <p className="text-[2.5rem] font-bold text-slate-deep leading-none">
              {totalDocs > 1000 ? `${(totalDocs / 1000).toFixed(1)}k` : totalDocs}
            </p>
            <Badge variant="gold">Processing</Badge>
          </div>
          <p className="text-xs text-outline mt-2">Total documents processed into intelligence</p>
        </div>
        <div className="bg-white p-6">
          <p className="text-[0.7rem] uppercase tracking-[0.15em] text-outline font-semibold mb-2">
            Intelligence Yield
          </p>
          <div className="flex items-end justify-between">
            <p className="text-[2.5rem] font-bold text-slate-deep leading-none">
              {completedDocs.toLocaleString()}
            </p>
            <div className="w-20 h-2 bg-surface-high">
              <div className="h-full bg-primary-container" style={{ width: `${totalDocs > 0 ? (completedDocs / totalDocs) * 100 : 0}%` }} />
            </div>
          </div>
          <p className="text-xs text-outline mt-2">Actionable signals extracted from transcripts</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-8">
        {/* Sessions Table — 8 cols */}
        <div className="col-span-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[1rem] font-bold text-slate-deep">Recent Sessions</h2>
            <button className="text-xs font-bold uppercase tracking-wider text-outline hover:text-slate-deep transition-colors">
              View Historical Archive
            </button>
          </div>

          <div className="bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-surface-low">
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Meeting Title</th>
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Jurisdiction</th>
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Date</th>
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Format</th>
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Action</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m, i) => (
                  <tr key={i} className="border-b border-surface-low/50 hover:bg-surface-low/30 transition-colors">
                    <td className="px-4 py-4 text-sm font-medium text-slate-deep">
                      {m.meeting_title}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-deep">
                      {m.city}
                    </td>
                    <td className="px-4 py-4 text-sm text-outline">
                      {formatDate(m.meeting_date)}
                    </td>
                    <td className="px-4 py-4">
                      <Badge variant={FORMAT_VARIANTS[m.document_type.toLowerCase()] || "muted"}>
                        {m.document_type}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <a
                        href={m.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-deep hover:text-primary transition-colors"
                      >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                          <path d="M4 2h7l5 5v11H4V2z" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M11 2v5h5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M8 12l2 2 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Processing Pipeline */}
          {activePipeline.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-[1rem] font-bold text-slate-deep">Processing Pipeline</h2>
                <span className="text-[0.65rem] font-bold uppercase bg-primary-container text-white px-2.5 py-1 tracking-wider">
                  Active Queue: {activePipeline.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {activePipeline.slice(0, 4).map((d, i) => {
                  const isFailed = d.status === "failed";
                  return (
                    <div key={i} className="bg-white p-4 flex items-center gap-3">
                      <div className={`w-1 h-10 ${isFailed ? "bg-primary" : "bg-primary-container"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={isFailed ? "text-primary" : "text-outline"}>
                            {isFailed ? (
                              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2" />
                            ) : (
                              <path d="M7 1v6l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            )}
                          </svg>
                          <span className="text-sm text-slate-deep font-medium truncate">
                            {d.source_url.split("/").pop()?.slice(0, 30) || "Document"}
                          </span>
                        </div>
                      </div>
                      <Badge variant={isFailed ? "crimson" : "gold"}>
                        {isFailed ? "Failed" : d.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel — 4 cols */}
        <div className="col-span-4 space-y-6">
          {/* Critical Priority */}
          <div>
            <h3 className="text-[0.7rem] uppercase tracking-[0.2em] text-outline font-semibold mb-3">
              Critical Priority
            </h3>
            <div className="bg-secondary-container p-5 space-y-5">
              {criticalSignals.length > 0 ? (
                criticalSignals.map((s, i) => (
                  <div key={i}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-[0.9rem] font-bold text-on-secondary-fixed leading-tight mb-1">
                          {s.summary.slice(0, 50)}
                        </p>
                        <p className="text-xs text-on-secondary-fixed/70">
                          {s.city}
                        </p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5">
                        <path d="M8 1l2 5h5l-4 3.5 1.5 5L8 11.5 3.5 14.5 5 9.5 1 6h5z" fill="#241a00" />
                      </svg>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {s.estimated_value && (
                        <span className="text-[0.6rem] font-bold uppercase bg-on-secondary-fixed/10 text-on-secondary-fixed px-2 py-0.5">
                          High Value: ${(s.estimated_value / 1e6).toFixed(0)}M+
                        </span>
                      )}
                      <span className="text-[0.6rem] font-bold uppercase bg-on-secondary-fixed/10 text-on-secondary-fixed px-2 py-0.5">
                        {s.signal_category.replace(/_/g, " ")}
                      </span>
                    </div>
                    {i < criticalSignals.length - 1 && <div className="h-px bg-on-secondary-fixed/10 mt-4" />}
                  </div>
                ))
              ) : (
                <p className="text-sm text-on-secondary-fixed/70">No critical briefings at this time.</p>
              )}

              <button className="w-full py-2.5 mt-2 bg-on-secondary-fixed/10 text-on-secondary-fixed text-xs font-bold uppercase tracking-wider hover:bg-on-secondary-fixed/20 transition-colors">
                Generate Summary Brief
              </button>
            </div>
          </div>

          {/* Pipeline Health */}
          <div>
            <h3 className="text-[0.7rem] uppercase tracking-[0.2em] text-outline font-semibold mb-3">
              Pipeline Health
            </h3>
            <div className="bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-deep mb-3">
                Data Ingestion
              </p>
              <div className="h-1.5 bg-surface-high">
                <div
                  className="h-full bg-slate-deep"
                  style={{ width: `${totalDocs > 0 ? (completedDocs / totalDocs) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-outline mt-2">
                {completedDocs} of {totalDocs} documents processed
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}
