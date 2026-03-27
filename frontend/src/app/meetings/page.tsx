"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/badge";
import {
  getCities,
  getMeetings,
  getMeetingStats,
  getPDFDocuments,
  getSignals,
  type Meeting,
  type PDFDoc,
  type Signal,
} from "@/lib/api";

export default function MeetingIntelligencePage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [critical, setCritical] = useState<Signal[]>([]);
  const [pipeline, setPipeline] = useState<PDFDoc[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [stats, setStats] = useState({ total_meetings: 0, total_docs: 0, completed_docs: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<number | undefined>(2026);
  const [cityFilter, setCityFilter] = useState("");
  const [documentTypeFilter, setDocumentTypeFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const pageSize = 12;

  useEffect(() => {
    Promise.all([
      getMeetings({ limit: pageSize, offset: (page - 1) * pageSize, year: yearFilter, city: cityFilter || undefined }),
      getSignals({ limit: 3, min_score: 0.7, year: yearFilter, city: cityFilter || undefined }),
      getPDFDocuments({ limit: 40, city: cityFilter || undefined }),
      getMeetingStats({ year: yearFilter }),
      getCities({ year: yearFilter }),
    ])
      .then(([meetingData, signalData, documentData, statData, cityData]) => {
        setMeetings(meetingData);
        setCritical(signalData);
        setPipeline(documentData);
        setStats(statData);
        setCities(cityData);
        setError(null);
      })
      .catch((err) => setError(err?.message || "Failed to load meetings"))
      .finally(() => setLoading(false));
  }, [cityFilter, page, yearFilter]);

  const activePipe = pipeline.filter((doc) => ["pending", "downloading", "extracting_text", "analyzing"].includes(doc.status));
  const pendingDocs = Math.max(stats.total_docs - stats.completed_docs, 0);
  const completionRate = stats.total_docs > 0 ? Math.round((stats.completed_docs / stats.total_docs) * 100) : 0;
  const documentTypes = Array.from(new Set(meetings.map((meeting) => meeting.document_type))).sort();

  const displayedMeetings = meetings.filter((meeting) => {
    const matchesType = !documentTypeFilter || meeting.document_type === documentTypeFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      meeting.meeting_title.toLowerCase().includes(query) ||
      meeting.city.toLowerCase().includes(query) ||
      meeting.document_type.toLowerCase().includes(query);
    return matchesType && matchesQuery;
  });

  if (loading && meetings.length === 0) {
    return (
      <div className="p-10">
        <div className="text-on-surface-variant text-sm">Loading...</div>
      </div>
    );
  }

  if (error && meetings.length === 0) {
    return (
      <div className="p-10">
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={`p-4 md:p-8 pt-16 md:pt-8 ${loading ? "opacity-60 pointer-events-none" : ""} transition-opacity duration-200`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6 md:mb-8">
        <div>
          <p className="text-label-sm text-on-surface-variant tracking-[0.2em] mb-1.5">Intelligence Explorer</p>
          <h1 className="text-[1.6rem] md:text-[2rem] font-bold text-on-surface tracking-tight">Meeting Intelligence</h1>
        </div>
        <select
          value={yearFilter ?? ""}
          onChange={(e) => {
            setLoading(true);
            setError(null);
            setYearFilter(e.target.value ? parseInt(e.target.value, 10) : undefined);
            setPage(1);
          }}
          className="px-3.5 py-2.5 text-sm font-medium bg-white border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary min-w-[140px]"
        >
          <option value="">All Years</option>
          {[2025, 2026].map((year) => (
            <option key={year} value={year}>
              FY {year}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5 mb-6 md:mb-8">
        <StatBox label="Annual Coverage" value={stats.total_meetings.toLocaleString()} accent="captured" accentMuted />
        <StatBox
          label="Processing Pipeline"
          value={stats.total_docs > 1000 ? `${(stats.total_docs / 1000).toFixed(1)}k` : stats.total_docs.toLocaleString()}
          accent={`${activePipe.length} active`}
        />
        <StatBox label="Intelligence Yield" value={stats.completed_docs.toLocaleString()} accent={`${completionRate}% complete`} accentMuted />
      </div>

      <div className="bg-white p-3 md:p-4 mb-6 md:mb-8 flex items-center gap-3 md:gap-4 flex-wrap">
        <div className="relative flex-1 min-w-0 w-full sm:w-auto sm:min-w-[220px]">
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2.5 pl-9 text-sm font-medium bg-surface-low/30 border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary placeholder:text-outline/40"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <select
          value={cityFilter}
          onChange={(e) => {
            setLoading(true);
            setError(null);
            setCityFilter(e.target.value);
            setPage(1);
          }}
          className="px-3.5 py-2.5 text-sm font-medium bg-white border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary min-w-[150px]"
        >
          <option value="">All Cities</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>

        <select
          value={documentTypeFilter}
          onChange={(e) => setDocumentTypeFilter(e.target.value)}
          className="px-3.5 py-2.5 text-sm font-medium bg-white border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary min-w-[160px]"
        >
          <option value="">All Formats</option>
          {documentTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <span className="text-sm font-semibold text-on-surface-variant">{displayedMeetings.length.toLocaleString()} sessions</span>
      </div>

      {error && <div className="mb-6 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-sm">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8 mb-8 md:mb-10">
        <section className="xl:col-span-7">
          <SectionHeading
            title="Critical Priority"
            subtitle="Highest-confidence municipal signals surfaced from recent meeting intelligence."
          />
          <div className="bg-white p-5 md:p-6 hover:shadow-[0px_18px_40px_rgba(11,28,48,0.08)] transition-shadow duration-200">
            {critical.length > 0 ? (
              <div className="space-y-5">
                {critical.map((signal, index) => (
                  <PrioritySignal key={`${signal.source_url}-${index}`} signal={signal} isLast={index === critical.length - 1} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">No critical briefings for the current selection.</p>
            )}
          </div>
        </section>

        <div className="xl:col-span-5 space-y-6">
          <section>
            <SectionHeading
              title="Pipeline Health"
              subtitle="Document processing status for the current ingestion flow."
            />
            <div className="bg-white p-5 md:p-6 hover:shadow-[0px_18px_40px_rgba(11,28,48,0.08)] transition-shadow duration-200">
              <div className="grid grid-cols-3 gap-3 mb-5">
                <HealthMetric label="Processed" value={stats.completed_docs.toLocaleString()} />
                <HealthMetric label="Pending" value={pendingDocs.toLocaleString()} />
                <HealthMetric label="Active" value={activePipe.length.toLocaleString()} />
              </div>
              <PipelineRow label="Processed" value={`${completionRate}%`} progress={completionRate} />
              <PipelineRow
                label="Pending"
                value={`${stats.total_docs > 0 ? Math.round((pendingDocs / stats.total_docs) * 100) : 0}%`}
                progress={stats.total_docs > 0 ? (pendingDocs / stats.total_docs) * 100 : 0}
                muted
              />
              <div className="mt-4 pt-4 flex items-center justify-between text-xs text-on-surface-variant" style={{ borderTop: "1px solid rgba(200,197,188,0.3)" }}>
                <span>{stats.total_docs.toLocaleString()} total documents tracked</span>
                <span>{cityFilter || "All municipalities"}</span>
              </div>
            </div>
          </section>

          <section>
            <SectionHeading
              title="Active Queue"
              subtitle="Files currently moving through download, extraction, or analysis."
            />
            <div className="space-y-3">
              {activePipe.length > 0 ? (
                activePipe.slice(0, 4).map((doc, index) => (
                  <QueueCard key={`${doc.source_url}-${index}`} doc={doc} />
                ))
              ) : (
                <div className="bg-white p-5 text-sm text-on-surface-variant">No active documents in the queue right now.</div>
              )}
            </div>
          </section>
        </div>
      </div>

      <section>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[1rem] md:text-[1.15rem] font-bold text-on-surface">Recent Sessions</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Agenda and minutes captured across municipalities in the current feed.</p>
          </div>
          <button className="text-label-sm text-on-surface-variant hover:text-primary transition-colors tracking-wider text-left sm:text-right">
            View Historical Archive
          </button>
        </div>

        {displayedMeetings.length === 0 ? (
          <div className="bg-white p-8 text-center text-sm text-on-surface-variant">No sessions match your filters.</div>
        ) : (
          <div className="space-y-4">
            {displayedMeetings.map((meeting, index) => (
              <MeetingCard key={`${meeting.pdf_url}-${index}`} meeting={meeting} />
            ))}
          </div>
        )}

        <div className="mt-6 bg-white px-4 py-4 flex items-center justify-between rounded-sm">
          <p className="text-label-sm text-on-surface-variant tracking-wider">
            Page {page} · {displayedMeetings.length} sessions shown
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
                setPage((current) => Math.max(1, current - 1));
              }}
              disabled={page === 1}
              className="text-on-surface-variant hover:text-primary disabled:opacity-30 transition-colors"
            >
              &lsaquo;
            </button>
            <span className="w-8 h-8 command-gradient text-on-primary text-xs font-bold flex items-center justify-center rounded-sm">
              {page}
            </span>
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
                setPage((current) => current + 1);
              }}
              disabled={meetings.length < pageSize}
              className="text-on-surface-variant hover:text-primary disabled:opacity-30 transition-colors"
            >
              &rsaquo;
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <div className="bg-white rounded-sm hover:shadow-[0px_18px_40px_rgba(11,28,48,0.08)] transition-shadow duration-200">
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge>{meeting.document_type}</Badge>
            <span className="inline-block px-3 py-1 text-[0.65rem] font-bold uppercase tracking-widest rounded-[3px] bg-primary-fixed/25 text-primary-container border border-primary-fixed-dim/20">
              {fmtMonth(meeting.meeting_date)}
            </span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-fixed/25 border border-primary-fixed-dim/20 rounded-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-primary-container">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-[0.8rem] font-bold text-on-surface">{meeting.city}</span>
          </div>
        </div>

        <h3 className="text-[1.05rem] font-bold text-on-surface leading-snug mb-4">{meeting.meeting_title}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetaItem label="Jurisdiction" value={meeting.city} />
          <MetaItem label="Meeting Date" value={fmtDate(meeting.meeting_date)} />
          <MetaItem label="Record Type" value={meeting.document_type} />
        </div>
      </div>

      <div className="px-6 py-3 flex items-center justify-between gap-3" style={{ borderTop: "1px solid rgba(200,197,188,0.3)" }}>
        <span className="text-xs text-on-surface-variant">Municipal record captured for intelligence review</span>
        <a
          href={meeting.pdf_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-container transition-colors"
        >
          Open Document &#x2197;
        </a>
      </div>
    </div>
  );
}

function PrioritySignal({ signal, isLast }: { signal: Signal; isLast: boolean }) {
  return (
    <div className={!isLast ? "pb-5" : undefined} style={!isLast ? { borderBottom: "1px solid rgba(200,197,188,0.3)" } : undefined}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge variant="muted">{fmt(signal.signal_category)}</Badge>
            {signal.procurement_stage && (
              <Badge variant={signal.procurement_stage.includes("rfp") ? "active" : "muted"}>{fmt(signal.procurement_stage)}</Badge>
            )}
            {signal.estimated_value && (
              <span className="inline-block px-3 py-1 text-[0.65rem] font-bold uppercase tracking-widest rounded-[3px] bg-primary-fixed/25 text-primary-container border border-primary-fixed-dim/20">
                Value: ${fmtValue(signal.estimated_value)}
              </span>
            )}
          </div>

          <p className="text-[0.98rem] font-bold text-on-surface leading-snug">{signal.summary}</p>

          <div className="flex items-center gap-4 mt-3 text-xs text-on-surface-variant flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-primary-container">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              {signal.city}
            </span>
            <span>Captured {fmtDate(signal.extracted_at)}</span>
            <span>Confidence {(signal.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>

        <span className="shrink-0 inline-flex items-center justify-center px-2.5 py-1 text-[0.72rem] font-bold rounded-[3px] bg-primary/10 text-primary border border-primary/15">
          {signal.score.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function QueueCard({ doc }: { doc: PDFDoc }) {
  return (
    <div className="bg-white p-4 flex items-center gap-3 rounded-sm hover:shadow-[0px_18px_40px_rgba(11,28,48,0.08)] transition-shadow duration-200">
      <div className={`w-1 h-10 rounded-sm ${doc.status === "failed" ? "bg-red-500" : "progress-gradient"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-on-surface font-medium truncate">{doc.source_url.split("/").pop()?.slice(0, 42) || "Meeting document"}</p>
        <p className="text-xs text-on-surface-variant mt-1">{doc.city}</p>
      </div>
      <Badge variant={doc.status === "failed" ? "pending" : "active"}>{fmt(doc.status)}</Badge>
    </div>
  );
}

function StatBox({
  label,
  value,
  accent,
  accentMuted,
}: {
  label: string;
  value: string | number;
  accent?: string;
  accentMuted?: boolean;
}) {
  return (
    <div className="bg-white p-5 rounded-sm hover:shadow-[0px_18px_40px_rgba(11,28,48,0.08)] transition-shadow duration-200">
      <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">{label}</p>
      <div className="flex items-end gap-3">
        <p className="text-[2.2rem] font-bold text-on-surface leading-none">{value}</p>
        {accent && <span className={`text-xs font-semibold mb-1 ${accentMuted ? "text-on-surface-variant" : "text-primary-container"}`}>{accent}</span>}
      </div>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[1rem] md:text-[1.15rem] font-bold text-on-surface">{title}</h2>
      <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>
    </div>
  );
}

function HealthMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-low/40 px-3 py-3 rounded-sm">
      <p className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-on-surface-variant mb-1">{label}</p>
      <p className="text-[1.1rem] font-bold text-on-surface">{value}</p>
    </div>
  );
}

function PipelineRow({
  label,
  value,
  progress,
  muted,
}: {
  label: string;
  value: string;
  progress: number;
  muted?: boolean;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.7rem] font-bold uppercase tracking-[0.15em] text-on-surface">{label}</span>
        <span className="text-[0.75rem] font-semibold text-on-surface-variant">{value}</span>
      </div>
      <div className="h-2 bg-surface-low overflow-hidden rounded-sm">
        <div
          className={`h-full rounded-sm ${muted ? "bg-primary-fixed-dim/60" : "progress-gradient"}`}
          style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
        />
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-on-surface/50 mb-1">{label}</p>
      <p className="text-[0.9rem] text-on-surface font-semibold">{value}</p>
    </div>
  );
}

function fmtDate(value: string) {
  try {
    return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return value;
  }
}

function fmtMonth(value: string) {
  try {
    return new Date(value).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return value;
  }
}

function fmtValue(value: number) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return value.toLocaleString();
}

function fmt(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
