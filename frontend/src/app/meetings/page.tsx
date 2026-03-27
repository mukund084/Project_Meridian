"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/badge";
import { getMeetings, getSignals, getPDFDocuments, getMeetingStats, type Meeting, type Signal, type PDFDoc } from "@/lib/api";

export default function MeetingIntelligencePage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [critical, setCritical] = useState<Signal[]>([]);
  const [pipeline, setPipeline] = useState<PDFDoc[]>([]);
  const [stats, setStats] = useState({ total_meetings: 0, total_docs: 0, completed_docs: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMeetings({ limit: 20 }), 
      getSignals({ limit: 3, min_score: 0.7 }), 
      getPDFDocuments({ limit: 40 }),
      getMeetingStats()
    ])
      .then(([m, s, d, st]) => { setMeetings(m); setCritical(s); setPipeline(d); setStats(st); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const activePipe = pipeline.filter((d) => ["pending", "downloading", "extracting_text", "analyzing"].includes(d.status));

  if (loading) return <div className="p-10"><div className="text-on-surface-variant text-sm">Loading...</div></div>;

  return (
    <div className="p-8">
      <h1 className="text-[1.5rem] font-bold text-primary mb-6">Meeting Intelligence</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-sm hover:shadow-[0px_18px_40px_rgba(11,28,48,0.08)] transition-shadow duration-200">
          <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">Annual Coverage</p>
          <div className="flex items-end justify-between">
            <p className="text-[2.5rem] font-bold text-on-surface leading-none">{stats.total_meetings.toLocaleString()}</p>
            <Badge variant="active">+12% YoY</Badge>
          </div>
          <p className="text-xs text-on-surface-variant mt-2">Total meetings captured this year</p>
        </div>
        <div className="bg-white p-6 rounded-sm hover:shadow-[0px_18px_40px_rgba(11,28,48,0.08)] transition-shadow duration-200">
          <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">Pipeline Velocity</p>
          <div className="flex items-end justify-between">
            <p className="text-[2.5rem] font-bold text-on-surface leading-none">{stats.total_docs > 1000 ? `${(stats.total_docs / 1000).toFixed(1)}k` : stats.total_docs.toLocaleString()}</p>
            <Badge variant="pending">Processing</Badge>
          </div>
          <p className="text-xs text-on-surface-variant mt-2">Documents processed into intelligence</p>
        </div>
        <div className="bg-white p-6 rounded-sm hover:shadow-[0px_18px_40px_rgba(11,28,48,0.08)] transition-shadow duration-200">
          <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">Intelligence Yield</p>
          <div className="flex items-end justify-between">
            <p className="text-[2.5rem] font-bold text-on-surface leading-none">{stats.completed_docs.toLocaleString()}</p>
            <div className="w-20 h-2 bg-surface-high rounded-sm"><div className="h-full progress-gradient rounded-sm" style={{ width: `${stats.total_docs > 0 ? (stats.completed_docs / stats.total_docs) * 100 : 0}%` }} /></div>
          </div>
          <p className="text-xs text-on-surface-variant mt-2">Signals extracted from transcripts</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Sessions Table */}
        <div className="col-span-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[1rem] font-bold text-on-surface">Recent Sessions</h2>
            <button className="text-label-sm text-on-surface-variant hover:text-primary transition-colors tracking-wider">View Historical Archive</button>
          </div>
          <div className="bg-white rounded-sm">
            <table className="w-full text-left">
              <thead><tr className="bg-surface-low/50">
                {["Meeting Title", "Jurisdiction", "Date", "Format", "Action"].map((h) => (
                  <th key={h} className="px-4 py-3 text-label-sm font-bold text-on-surface-variant tracking-widest">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {meetings.map((m, i) => (
                  <tr key={i} className={`hover:bg-surface-low/30 transition-colors ${i % 2 === 1 ? "bg-surface-low/20" : ""}`}>
                    <td className="px-4 py-4 text-sm font-medium text-on-surface">{m.meeting_title}</td>
                    <td className="px-4 py-4 text-sm text-on-surface">{m.city}</td>
                    <td className="px-4 py-4 text-sm text-on-surface-variant">{fmtDate(m.meeting_date)}</td>
                    <td className="px-4 py-4"><Badge variant={m.document_type.toLowerCase() === "minutes" ? "active" : "muted"}>{m.document_type}</Badge></td>
                    <td className="px-4 py-4">
                      <a href={m.pdf_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-container transition-colors">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 2h7l5 5v11H4V2z" stroke="currentColor" strokeWidth="1.5" /><path d="M11 2v5h5M8 12l2 2 2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pipeline */}
          {activePipe.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-[1rem] font-bold text-on-surface">Processing Pipeline</h2>
                <span className="text-label-sm font-bold command-gradient text-on-primary px-2.5 py-1 rounded-sm tracking-wider">Active Queue: {activePipe.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {activePipe.slice(0, 4).map((d, i) => (
                  <div key={i} className="bg-white p-4 flex items-center gap-3 rounded-sm">
                    <div className={`w-1 h-10 rounded-sm ${d.status === "failed" ? "bg-red-500" : "progress-gradient"}`} />
                    <span className="text-sm text-on-surface font-medium truncate flex-1">{d.source_url.split("/").pop()?.slice(0, 30)}</span>
                    <Badge variant={d.status === "failed" ? "pending" : "active"}>{d.status.replace(/_/g, " ")}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="col-span-4 space-y-6">
          <div className="mt-[50px]">
            <h3 className="text-label-sm text-on-surface-variant tracking-[0.2em] mb-3">Critical Priority</h3>
            <div className="bg-primary-fixed p-5 rounded-sm space-y-4">
              {critical.length > 0 ? critical.map((s, i) => (
                <div key={i}>
                  <div className="flex items-start justify-between">
                    <div><p className="text-[0.9rem] font-bold text-on-primary-fixed leading-tight mb-1">{s.summary.slice(0, 55)}</p><p className="text-xs text-on-primary-fixed/70">{s.city}</p></div>
                    <span className="text-on-primary-fixed">&#9733;</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {s.estimated_value && <span className="text-[0.6rem] font-bold uppercase bg-on-primary-fixed/10 text-on-primary-fixed px-2 py-0.5 rounded-sm">Value: ${(s.estimated_value / 1e6).toFixed(0)}M+</span>}
                    <span className="text-[0.6rem] font-bold uppercase bg-on-primary-fixed/10 text-on-primary-fixed px-2 py-0.5 rounded-sm">{s.signal_category.replace(/_/g, " ")}</span>
                  </div>
                  {i < critical.length - 1 && <div className="h-px bg-on-primary-fixed/10 mt-3" />}
                </div>
              )) : <p className="text-sm text-on-primary-fixed/70">No critical briefings.</p>}
              <button className="hidden w-full py-2.5 mt-2 bg-on-primary-fixed/10 text-on-primary-fixed text-xs font-bold uppercase tracking-wider hover:bg-on-primary-fixed/20 transition-colors rounded-sm">Generate Summary Brief</button>
            </div>
          </div>
          <div>
            <h3 className="text-label-sm text-on-surface-variant tracking-[0.2em] mb-3">Pipeline Health</h3>
            <div className="bg-white p-5 rounded-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-on-surface mb-3">Data Ingestion</p>
              <div className="h-1.5 bg-surface-high rounded-sm"><div className="h-full progress-gradient rounded-sm" style={{ width: `${stats.total_docs > 0 ? (stats.completed_docs / stats.total_docs) * 100 : 0}%` }} /></div>
              <p className="text-xs text-on-surface-variant mt-2">{stats.completed_docs.toLocaleString()} of {stats.total_docs.toLocaleString()} documents processed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtDate(d: string) { try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return d; } }
