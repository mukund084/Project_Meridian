"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Badge } from "@/components/badge";
import {
  getSignals, getSignalStats, getMeetings, getPDFDocuments,
  getSignalPipeline, getAccounts, getCities, getBidsClosingSoon,
  type Signal, type SignalStat, type Meeting, type PipelineStage, type Account, type Bid,
} from "@/lib/api";

export default function DashboardPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<SignalStat[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [docStats, setDocStats] = useState({ total: 0, pending: 0 });
  const [cityList, setCityList] = useState<string[]>([]);
  const [closingSoon, setClosingSoon] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const y = selectedYear;
    Promise.all([
      getSignals({ limit: 10, min_score: 0.5, year: y }),
      getSignalStats({ year: y }),
      getMeetings({ limit: 5, year: y }),
      getPDFDocuments({ limit: 200 }),
      getSignalPipeline({ year: y }),
      getAccounts({ year: y }),
      getCities({ year: y }),
      getBidsClosingSoon({ days: 30, limit: 5 }).catch(() => [] as Bid[]),
    ])
      .then(([s, st, m, docs, pipe, accts, cities, closing]) => {
        setSignals(s);
        setStats(st);
        setMeetings(m);
        const pending = docs.filter((d) => d.status === "pending").length;
        setDocStats({ total: docs.length, pending });
        setPipeline(pipe);
        setAccounts(accts);
        setCityList(cities);
        setClosingSoon(closing);
      })
      .catch((err) => setError(err?.message || "Failed to load dashboard data. Is the API running?"))
      .finally(() => setLoading(false));
  }, [selectedYear]);

  // Derive totals from accounts (accurate aggregation) instead of limited fetches
  const totalSignals = accounts.reduce((sum, a) => sum + a.total_signals, 0);
  const totalBids = accounts.reduce((sum, a) => sum + a.total_bids, 0);
  const totalOpenBids = accounts.reduce((sum, a) => sum + a.open_bids, 0);
  const totalMeetings = accounts.reduce((sum, a) => sum + a.total_meetings, 0);
  const totalCities = cityList.length;

  const hasData = accounts.length > 0;

  if (loading && !hasData) {
    return (
      <div className="p-10 flex items-center gap-3">
        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
        <span className="text-on-surface-variant text-sm">Loading intelligence...</span>
      </div>
    );
  }

  if (error && !hasData) {
    return (
      <div className="p-10">
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-sm">{error}</p>
      </div>
    );
  }

  const dailyLeads = signals.filter((s) => s.score >= 0.8).slice(0, 10);
  const pipelineWithData = pipeline.filter((p) => p.count > 0);
  const maxPipelineCount = Math.max(...pipelineWithData.map((p) => p.count), 1);
  const topCities = accounts.slice(0, 8);
  const maxCitySignals = Math.max(...topCities.map((a) => a.total_signals), 1);

  const scrollLeft = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: -400, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (carouselRef.current) {
      carouselRef.current.scrollBy({ left: 400, behavior: "smooth" });
    }
  };

  return (
    <div className={`p-4 md:p-8 pt-16 md:pt-8 ${loading ? "opacity-60 pointer-events-none" : ""} transition-opacity duration-200`}>
      {loading && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-white px-4 py-2 shadow-lg">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          <span className="text-xs text-on-surface-variant">Updating...</span>
        </div>
      )}
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-label-sm text-on-surface-variant tracking-[0.2em] mb-1.5">Strategic Overview</p>
          <h1 className="text-[2.4rem] font-bold text-on-surface leading-[1.1] tracking-tight">
            Intelligence Command
          </h1>
        </div>
        <div className="hidden gap-3 mt-2">
          <button className="px-5 py-2.5 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-on-surface-variant bg-surface-low hover:bg-surface-high transition-colors">
            Export Report
          </button>
          <button className="px-5 py-2.5 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-on-primary command-gradient hover:opacity-90 transition-opacity">
            New Signal Scan
          </button>
        </div>
      </div>

      {/* ── Year Filter ── */}
      <div className="flex items-center gap-4 mb-10">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-on-surface-variant">Fiscal Year</p>
        <div className="flex gap-0">
          {[2025, 2026].map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-4 py-1.5 text-xs font-bold transition-colors ${
                selectedYear === y
                  ? "command-gradient text-on-primary"
                  : "bg-white text-on-surface-variant hover:text-primary"
              }`}
            >
              FY {y}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 mb-8 md:mb-12">
        <Link href="/signals"><KPICard icon="signals" label="Signals" value={totalSignals.toLocaleString()} change={`${stats.length} categories`} /></Link>
        <Link href="/bids"><KPICard icon="bids" label="Bids" value={totalBids.toLocaleString()} change={`${totalOpenBids} open`} positive /></Link>
        <Link href="/meetings"><KPICard icon="meetings" label="Meetings" value={totalMeetings.toLocaleString()} change={`${totalCities} municipalities`} /></Link>
        <KPICard icon="docs" label="Documents" value={docStats.total.toLocaleString()} change={`${docStats.pending} pending`} />
      </div>

      {/* ── Daily Leads ── */}
      {dailyLeads.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[1.15rem] font-bold text-on-surface">Daily Leads</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Highest-scoring opportunities requiring attention</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                <button 
                  onClick={scrollLeft}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-low hover:bg-surface-high transition-colors text-on-surface-variant"
                  aria-label="Scroll left"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                <button 
                  onClick={scrollRight}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-low hover:bg-surface-high transition-colors text-on-surface-variant"
                  aria-label="Scroll right"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="relative">
            <div 
              ref={carouselRef} 
              className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {dailyLeads.map((s, i) => (
                <div key={i} className="min-w-[280px] max-w-[280px] md:min-w-[350px] md:max-w-[350px] snap-start shrink-0">
                  <DailyLeadCard signal={s} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Bids Closing Soon ── */}
      {closingSoon.length > 0 && (
        <section className="mb-8 md:mb-12">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[1.15rem] font-bold text-on-surface">Bids Closing Soon</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Open bids with approaching deadlines — act now</p>
            </div>
            <Link href="/bids" className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-on-surface-variant hover:text-primary transition-colors">
              View All Bids &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {closingSoon.map((b, i) => (
              <a
                key={i}
                href={b.bid_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white p-5 hover:shadow-[0px_18px_40px_rgba(160,65,0,0.12)] transition-all duration-200 group/bid"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-primary">Closing Soon</span>
                  </div>
                  {b.days_left && (
                    <span className="text-xs font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-sm">{b.days_left}</span>
                  )}
                </div>
                <h3 className="text-sm font-bold text-on-surface leading-snug mb-2 line-clamp-2 group-hover/bid:text-primary transition-colors">
                  {b.bid_name}
                </h3>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant">{b.city}</span>
                  <span className="text-[0.6rem] font-bold uppercase tracking-wider text-on-surface-variant">{b.bid_closing_date?.split(",")[0] || ""}</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── Two-column: Pipeline + Top Cities ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 mb-8 md:mb-12">
        {/* Procurement Pipeline Funnel */}
        <section className="lg:col-span-7">
          <div className="mb-5">
            <h2 className="text-[1.15rem] font-bold text-on-surface">Procurement Pipeline</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Signal distribution across procurement lifecycle stages</p>
          </div>
          <div className="bg-white p-6 hover:shadow-[0px_18px_40px_rgba(11,28,48,0.08)] transition-shadow duration-200">
            {pipelineWithData.length > 0 ? (
              <div className="space-y-2.5">
                {pipelineWithData.map((stage) => {
                  const width = Math.max((stage.count / maxPipelineCount) * 100, 8);
                  const isHot = stage.stage === "rfp_imminent" || stage.stage === "rfp_published" || stage.stage === "specification_development";
                  return (
                    <div key={stage.stage} className="group">
                      <div className="flex items-center gap-4">
                        <div className="w-[140px] shrink-0 text-right">
                          <span className={`text-xs font-medium ${isHot ? "text-primary font-bold" : "text-on-surface-variant"}`}>
                            {stage.label}
                          </span>
                        </div>
                        <div className="flex-1 h-8 bg-surface-low relative overflow-hidden">
                          <div
                            className={`h-full transition-all duration-700 ease-out flex items-center px-3 ${isHot ? "command-gradient" : "bg-primary-fixed"}`}
                            style={{ width: `${width}%` }}
                          >
                            <span className={`text-xs font-bold ${isHot ? "text-white" : "text-on-primary-fixed"}`}>
                              {stage.count}
                            </span>
                          </div>
                        </div>
                        <div className="w-[60px] shrink-0">
                          <span className="text-[0.6rem] text-on-surface-variant">
                            {stage.avg_confidence > 0 ? `${(stage.avg_confidence * 100).toFixed(0)}% conf` : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant text-center py-8">No pipeline data available.</p>
            )}

            {/* Pipeline legend */}
            <div className="flex items-center gap-6 mt-6 pt-4" style={{ borderTop: "1px solid rgba(200,197,188,0.3)" }}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 command-gradient" />
                <span className="text-[0.6rem] text-on-surface-variant uppercase tracking-wider">Hot Stages (Near RFP)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary-fixed" />
                <span className="text-[0.6rem] text-on-surface-variant uppercase tracking-wider">Other Stages</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Stack: Top Cities + Pipeline Health */}
        <div className="lg:col-span-5 flex flex-col gap-8 md:gap-12">
          {/* Top Cities by Activity */}
          <section>
            <div className="mb-5">
              <h2 className="text-[1.15rem] font-bold text-on-surface">Top Cities</h2>
              <p className="text-xs text-on-surface-variant mt-0.5">Municipalities ranked by total intelligence signals</p>
            </div>
            <div className="bg-white p-6 hover:shadow-[0px_18px_40px_rgba(11,28,48,0.08)] transition-shadow duration-200">
              {topCities.length > 0 ? (
                <div className="space-y-3">
                  {topCities.map((city, i) => {
                    const width = Math.max((city.total_signals / maxCitySignals) * 100, 12);
                    return (
                      <Link key={city.city} href={`/accounts/${encodeURIComponent(city.city)}`} className="block group">
                        <div className="flex items-center gap-3">
                          <span className="text-[0.6rem] font-bold text-on-surface-variant w-4 text-right">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-on-surface group-hover:text-primary transition-colors">{city.city}</span>
                              <span className="text-xs text-on-surface-variant">{city.total_signals} signals</span>
                            </div>
                            <div className="h-2 bg-surface-low">
                              <div className="h-full progress-gradient transition-all duration-500" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-on-surface-variant text-center py-8">No city data available.</p>
              )}

              {/* City summary */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-4" style={{ borderTop: "1px solid rgba(200,197,188,0.3)" }}>
                <div className="text-center">
                  <p className="text-lg font-bold text-on-surface">{totalCities}</p>
                  <p className="text-[0.6rem] text-on-surface-variant uppercase tracking-wider">Cities</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-on-surface">{totalBids.toLocaleString()}</p>
                  <p className="text-[0.6rem] text-on-surface-variant uppercase tracking-wider">Total Bids</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-on-surface">{totalOpenBids.toLocaleString()}</p>
                  <p className="text-[0.6rem] text-on-surface-variant uppercase tracking-wider">Open</p>
                </div>
              </div>
            </div>
          </section>

        {/* Pipeline Health */}
        <section>
            <div className="relative overflow-hidden bg-white p-6 h-full hover:shadow-[0px_18px_40px_rgba(160,65,0,0.16)] transition-shadow duration-200">
              <div className="relative flex items-center justify-between mb-5">
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-primary-container">System Status</p>
                  <p className="text-[1rem] font-bold mt-0.5 text-on-surface">Pipeline Health</p>
                </div>
                <div className="w-10 h-10 bg-primary-fixed flex items-center justify-center rounded-sm">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-primary-container">
                    <path d="M3 18l5-7 5 5 8-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
              <div className="relative space-y-4">
                <PipelineBar label="Extracted" value={docStats.total > 0 ? Math.round(((docStats.total - docStats.pending) / docStats.total) * 100) : 0} />
                <PipelineBar label="Pending" value={docStats.total > 0 ? Math.round((docStats.pending / docStats.total) * 100) : 0} />
              </div>
              <div className="relative mt-5 pt-4 flex items-center justify-between border-t border-surface-high">
                <p className="text-[0.65rem] text-on-surface-variant">{docStats.total} total documents</p>
                <p className="text-[0.65rem] text-on-surface-variant">{docStats.pending} in queue</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ── Bottom: Recent Briefings ── */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[1.15rem] font-bold text-on-surface">Recent Briefings</h2>
          <Link href="/meetings" className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-on-surface-variant hover:text-primary transition-colors">
            View All &rarr;
          </Link>
        </div>
        <div className="bg-white overflow-hidden hover:shadow-[0px_18px_40px_rgba(11,28,48,0.08)] transition-shadow duration-200">
          {meetings.slice(0, 4).map((m, i) => (
            <a
              key={i}
              href={m.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 px-5 py-4 hover:bg-surface-high/40 transition-colors group"
            >
              <div className="w-9 h-9 bg-surface-low flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 1h6l4 4v10H4V1z" stroke="#8a8a80" strokeWidth="1.2" />
                  <path d="M10 1v4h4" stroke="#8a8a80" strokeWidth="1.2" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors truncate">{m.meeting_title}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{m.city} &middot; {m.meeting_date}</p>
              </div>
              <Badge variant={m.document_type.toLowerCase() === "minutes" ? "active" : "muted"}>
                {m.document_type}
              </Badge>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── KPI Card ── */
function KPICard({ icon, label, value, change, positive }: {
  icon: string; label: string; value: string; change: string; positive?: boolean;
}) {
  const icons: Record<string, React.ReactNode> = {
    signals: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M10 2v16M6 6v10M2 9v4M14 4v12M18 7v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    bids: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M4 2h12v16l-3-2-3 2-3-2-3 2V2z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 7h6M7 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    meetings: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1 17c0-3 2.5-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    docs: (
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M5 2h7l5 5v11H5V2z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 2v5h5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  };

  return (
    <div className="bg-white p-6 hover:shadow-[0px_18px_40px_rgba(11,28,48,0.08)] transition-all duration-200 cursor-pointer group/kpi">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[0.75rem] font-bold uppercase tracking-[0.15em] text-on-surface group-hover/kpi:text-primary transition-colors">{label}</p>
        <span className="text-on-surface/40">{icons[icon]}</span>
      </div>
      <p className="text-[1.8rem] md:text-[2.5rem] font-extrabold text-on-surface leading-none tracking-tight">{value}</p>
      <p className={`text-sm font-semibold mt-2.5 ${positive ? "text-primary" : "text-on-surface/50"}`}>{change}</p>
    </div>
  );
}

/* ── Daily Lead Card ── */
function DailyLeadCard({ signal }: { signal: Signal }) {
  return (
    <div className="bg-white overflow-hidden group hover:shadow-[0px_18px_40px_rgba(11,28,48,0.08)] transition-shadow duration-200">
      {/* Gradient top accent */}
      <div className="h-1.5 progress-gradient" />

      <div className="p-6">
        {/* Lead badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[0.9rem]">&#x1F525;</span>
          <span className="text-[0.6rem] font-bold text-primary-container uppercase tracking-[0.2em]">Daily Lead</span>
          <span className="ml-auto text-xs font-bold text-on-surface">{signal.score.toFixed(2)}</span>
        </div>

        {/* Title */}
        <h3 className="text-[0.95rem] font-bold text-on-surface leading-snug mb-3 line-clamp-2">
          {signal.summary}
        </h3>

        {/* Excerpt */}
        <p className="text-[0.8rem] text-on-surface-variant leading-relaxed mb-5 line-clamp-3">
          {signal.raw_excerpt}
        </p>

        {/* Signals breakdown */}
        <div className="mb-4">
          <p className="text-[0.6rem] font-bold text-primary-container uppercase tracking-[0.2em] mb-2">Signals</p>
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="text-[0.6rem] font-bold text-primary-container mt-0.5">1.</span>
              <p className="text-[0.8rem] text-on-surface"><span className="font-semibold">Category:</span> {fmt(signal.signal_category)}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[0.6rem] font-bold text-primary-container mt-0.5">2.</span>
              <p className="text-[0.8rem] text-on-surface"><span className="font-semibold">Stage:</span> {signal.procurement_stage ? fmt(signal.procurement_stage) : "Early Detection"}</p>
            </div>
            {signal.estimated_value && (
              <div className="flex items-start gap-2">
                <span className="text-[0.6rem] font-bold text-primary-container mt-0.5">3.</span>
                <p className="text-[0.8rem] text-on-surface"><span className="font-semibold">Value:</span> ${fmtValue(signal.estimated_value)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Why it matters */}
        <div className="mb-5">
          <p className="text-[0.6rem] font-bold text-primary-container uppercase tracking-[0.2em] mb-2">Why it matters</p>
          <p className="text-[0.8rem] text-on-surface-variant leading-relaxed">
            {signal.confidence >= 0.9 ? "Very high" : "High"} confidence signal from {signal.city}
            {signal.estimated_timeline ? `. Timeline: ${signal.estimated_timeline}` : ""}.
            {" "}This indicates {getStageInsight(signal.procurement_stage)}.
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          <TagChip icon="location">{signal.city}</TagChip>
          <TagChip>{fmt(signal.signal_category)}</TagChip>
          <TagChip>{fmt(signal.source_type)}</TagChip>
        </div>
      </div>
    </div>
  );
}

/* ── Tag Chip ── */
function TagChip({ children, icon }: { children: React.ReactNode; icon?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[0.65rem] text-on-surface-variant bg-surface-low px-2 py-0.5 font-medium">
      {icon === "location" && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 1C3.3 1 2 2.3 2 4c0 2.5 3 5 3 5s3-2.5 3-5c0-1.7-1.3-3-3-3z" stroke="currentColor" strokeWidth="0.8" />
          <circle cx="5" cy="4" r="1" fill="currentColor" />
        </svg>
      )}
      {children}
    </span>
  );
}

/* ── Pipeline Bar ── */
function PipelineBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="uppercase tracking-[0.15em] font-semibold text-on-surface-variant">{label}</span>
        <span className="font-bold text-primary">{value}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-surface-low overflow-hidden">
        <div className="h-full rounded-full progress-gradient transition-all duration-700" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

/* ── Helpers ── */
function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

function fmtValue(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString();
}

function getStageInsight(stage: string | null): string {
  if (!stage) return "an early-stage opportunity worth monitoring";
  const insights: Record<string, string> = {
    needs_identified: "a newly identified need — get in early with advisory",
    study_authorized: "an authorized study — opportunity to shape requirements",
    budget_allocated: "allocated budget — funding is secured, procurement is likely",
    market_research: "active market research — the buyer is evaluating options",
    specification_development: "specs being written — critical window to influence requirements",
    rfp_imminent: "an imminent RFP — prepare your response team now",
    rfp_published: "a published RFP — respond immediately",
    evaluation_in_progress: "evaluation underway — outcome pending",
    shortlisted: "shortlisting has occurred — competitive intelligence needed",
    negotiation: "active negotiation — deal is progressing",
    awarded: "a contract award — monitor for subcontracting opportunities",
    contract_execution: "contract execution phase — delivery is underway",
    in_progress: "an active project — look for expansion or follow-on",
    closeout: "project closeout — renewal or replacement opportunity ahead",
  };
  return insights[stage] || "an active procurement opportunity";
}
