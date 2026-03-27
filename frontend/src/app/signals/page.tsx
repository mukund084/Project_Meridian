"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Badge } from "@/components/badge";
import { getSignals, getSignalStats, getCities, type Signal, type SignalStat } from "@/lib/api";

export default function SignalsExplorerPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<SignalStat[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.0);
  const [yearFilter, setYearFilter] = useState<number | undefined>(2026);
  const [searchQuery, setSearchQuery] = useState("");

  const pageSize = 20;
  const offsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCities({ year: yearFilter }).then(setCities).catch(() => {});
  }, [yearFilter]);

  useEffect(() => {
    getSignalStats({
      year: yearFilter,
      city: selectedCity || undefined,
      min_confidence: confidenceThreshold > 0 ? confidenceThreshold : undefined,
    }).then(setStats).catch(() => {});
  }, [yearFilter, selectedCity, confidenceThreshold]);

  // Initial load + filter change
  const loadSignals = useCallback((reset: boolean) => {
    if (reset) {
      offsetRef.current = 0;
      setHasMore(true);
      setExpandedCard(null);
    }
    if (reset) setLoading(true); else setLoadingMore(true);
    setError(null);

    getSignals({
      city: selectedCity || undefined,
      category: selectedCategory || undefined,
      year: yearFilter,
      min_confidence: confidenceThreshold > 0 ? confidenceThreshold : undefined,
      limit: pageSize,
      offset: offsetRef.current,
    })
      .then((data) => {
        if (reset) {
          setSignals(data);
        } else {
          setSignals((prev) => [...prev, ...data]);
        }
        if (data.length < pageSize) setHasMore(false);
        offsetRef.current += data.length;
      })
      .catch((err) => { setError(err?.message || "Failed to load signals"); if (reset) setSignals([]); })
      .finally(() => { setLoading(false); setLoadingMore(false); });
  }, [selectedCity, selectedCategory, yearFilter, confidenceThreshold]);

  // Reset on filter change
  useEffect(() => { loadSignals(true); }, [loadSignals]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadSignals(false);
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadSignals]);

  const filteredStats = selectedCategory
    ? stats.filter((s) => s.category === selectedCategory)
    : stats;

  const totalSignals = filteredStats.reduce((sum, s) => sum + s.count, 0);
  const highConfidence = filteredStats.reduce((sum, s) => sum + s.high_confidence_count, 0);
  const totalValue = filteredStats.reduce((sum, s) => sum + s.count * s.avg_score * 1000000, 0);

  const categoryLabels: Record<string, string> = {
    policy_regulatory: "Policy & Regulatory", scope: "Scope", budget: "Budget",
    decision_maker: "Decision Maker", geographic: "Geographic", engagement: "Engagement",
    infrastructure: "Infrastructure", lifecycle: "Lifecycle", timing: "Timing",
    incumbent_competitor: "Incumbent / Competitor", risk: "Risk", political: "Political",
    environmental: "Environmental", workforce: "Workforce", technology: "Technology",
    contract_structure: "Contract Structure",
  };

  const sortedCategories = [...stats].sort((a, b) => b.count - a.count);

  // Client-side search filter
  const displayed = searchQuery
    ? signals.filter((s) => s.summary.toLowerCase().includes(searchQuery.toLowerCase()) || s.city.toLowerCase().includes(searchQuery.toLowerCase()))
    : signals;

  const resetFilters = () => {
    setSelectedCategory("");
    setSelectedCity("");
    setConfidenceThreshold(0.0);
    setYearFilter(2026);
    setSearchQuery("");
  };

  return (
    <div className="p-4 md:p-8 pt-16 md:pt-8">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <p className="text-label-sm text-on-surface-variant tracking-[0.2em] mb-1.5">Intelligence Explorer</p>
        <h1 className="text-[1.6rem] md:text-[2rem] font-bold text-on-surface tracking-tight">Signals</h1>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5 mb-6 md:mb-8">
        <StatBox label="Active Signals" value={totalSignals.toLocaleString()} accent={`${stats.length} categories`} />
        <StatBox label="High Confidence" value={highConfidence.toLocaleString()} accent="signals" accentMuted />
        <StatBox label="Total Pipeline Value" value={`$${(totalValue / 1e9).toFixed(1)}B`} accent="Est. Total" accentMuted />
      </div>

      {/* Search + Filters Bar */}
      <div className="bg-white p-3 md:p-4 mb-4 md:mb-6 flex items-center gap-3 md:gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-0 w-full sm:w-auto sm:min-w-[180px]">
          <input
            type="text"
            placeholder="Search signals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2.5 pl-9 text-sm font-medium bg-surface-low/30 border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary placeholder:text-outline/40"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <select
          value={yearFilter ?? ""}
          onChange={(e) => setYearFilter(e.target.value ? parseInt(e.target.value) : undefined)}
          className="px-3.5 py-2.5 text-sm font-medium bg-white border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary min-w-[120px]"
        >
          <option value="">All Years</option>
          {[2025, 2026].map((y) => <option key={y} value={y}>FY {y}</option>)}
        </select>

        <select
          value={selectedCity}
          onChange={(e) => setSelectedCity(e.target.value)}
          className="px-3.5 py-2.5 text-sm font-medium bg-white border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary min-w-[150px]"
        >
          <option value="">All Cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3.5 py-2.5 text-sm font-medium bg-white border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary min-w-[200px]"
        >
          <option value="">All Categories</option>
          {sortedCategories.map((s) => (
            <option key={s.category} value={s.category}>
              {categoryLabels[s.category] || fmt(s.category)} ({s.count.toLocaleString()})
            </option>
          ))}
        </select>

        {/* Confidence */}
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-surface-high rounded-sm">
          <span className="text-[0.6rem] font-bold uppercase tracking-widest text-on-surface-variant">Conf</span>
          <input type="range" min="0" max="1" step="0.05" value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
            className="w-20"
          />
          <span className="text-xs font-bold text-primary w-8">{confidenceThreshold.toFixed(2)}</span>
        </div>

        <span className="text-sm font-semibold text-on-surface-variant">{totalSignals.toLocaleString()} results</span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-sm">{error}</div>
      )}

      {/* Loading skeleton */}
      {loading && signals.length === 0 && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-sm animate-pulse">
              <div className="flex gap-2 mb-3"><div className="h-5 w-24 bg-surface-high rounded-sm" /><div className="h-5 w-20 bg-surface-high rounded-sm" /></div>
              <div className="h-5 w-3/4 bg-surface-high rounded-sm mb-2" />
              <div className="h-4 w-full bg-surface-low rounded-sm mb-1" />
              <div className="h-4 w-2/3 bg-surface-low rounded-sm" />
            </div>
          ))}
        </div>
      )}

      {/* Signal Cards */}
      {!loading && displayed.length === 0 && !error && (
        <div className="text-center py-16 text-on-surface-variant text-sm">No signals match your filters.</div>
      )}

      <div className="space-y-4">
        {displayed.map((s, i) => (
          <SignalCard
            key={`${s.source_url}-${s.summary.slice(0, 30)}-${i}`}
            signal={s}
            isExpanded={expandedCard === i}
            onToggle={() => setExpandedCard(expandedCard === i ? null : i)}
            categoryLabel={categoryLabels[s.signal_category] || fmt(s.signal_category)}
          />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {loadingMore && (
        <div className="flex items-center justify-center gap-2 py-8">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          <span className="text-xs text-on-surface-variant">Loading more signals...</span>
        </div>
      )}

      {!hasMore && signals.length > 0 && (
        <p className="text-center text-xs text-on-surface-variant py-6">All {signals.length} signals loaded</p>
      )}
    </div>
  );
}

/* ── Signal Card ── */
function SignalCard({ signal: s, isExpanded, onToggle, categoryLabel }: {
  signal: Signal; isExpanded: boolean; onToggle: () => void; categoryLabel: string;
}) {
  const daysAgo = Math.max(0, Math.floor((Date.now() - new Date(s.extracted_at).getTime()) / 86400000));
  const timeLabel = daysAgo === 0 ? "Today" : daysAgo === 1 ? "1 day ago" : `${daysAgo} days ago`;

  return (
    <div className="bg-white rounded-sm hover:shadow-[0px_18px_40px_rgba(11,28,48,0.08)] transition-shadow duration-200">
      {/* Card header */}
      <div className="p-6 pb-0">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="active">{fmt(s.source_type)}</Badge>
            <Badge variant="muted">{categoryLabel}</Badge>
            {s.procurement_stage && (
              <Badge variant={s.procurement_stage.includes("rfp") ? "active" : "muted"}>
                {fmt(s.procurement_stage)}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <div className={`w-2 h-2 rounded-full ${s.score >= 0.9 ? "bg-primary" : s.score >= 0.7 ? "bg-primary-fixed-dim" : "bg-surface-high"}`} />
            <span className="text-xs text-on-surface-variant">{timeLabel}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-[1rem] font-bold text-on-surface leading-snug mb-2">
          {s.city}: {fmt(s.signal_category)}
        </h3>

        {/* Summary */}
        <p className="text-sm text-on-surface-variant leading-relaxed mb-3">{s.summary}</p>

        {/* Meta row */}
        <div className="flex items-center gap-4 text-xs text-on-surface-variant mb-4">
          <span>Extracted: {new Date(s.extracted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          {s.estimated_value && <span className="font-semibold text-primary-container">Value: ${fmtValue(s.estimated_value)}</span>}
          <span>Confidence: <span className="font-bold text-on-surface">{(s.confidence * 100).toFixed(0)}%</span></span>
          <span>Score: <span className="font-bold text-on-surface">{s.score.toFixed(2)}</span></span>
        </div>
      </div>

      {/* Expandable insight section */}
      {isExpanded && (
        <div className="px-6 pb-2">
          {/* Why it matters box */}
          <div className="bg-primary-fixed/30 border border-primary-fixed rounded-sm p-4 mb-4">
            <div className="flex items-start gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-primary-container mt-0.5 shrink-0">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              <p className="text-sm text-on-surface leading-relaxed">
                {s.confidence >= 0.9 ? "Very high" : s.confidence >= 0.7 ? "High" : "Moderate"} confidence signal from <span className="font-semibold">{s.city}</span>.
                {s.estimated_timeline ? ` Timeline: ${s.estimated_timeline}.` : ""}
                {" "}{getStageInsight(s.procurement_stage)}
                {s.estimated_value ? ` Estimated value: $${fmtValue(s.estimated_value)}.` : ""}
              </p>
            </div>
          </div>

          {/* Source excerpt */}
          {s.raw_excerpt && (
            <div className="mb-4">
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-1.5">Source Excerpt</p>
              <p className="text-sm text-on-surface-variant leading-relaxed italic">{s.raw_excerpt}</p>
            </div>
          )}

          {/* Detail grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-2 text-sm">
            <div>
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-on-surface-variant mb-0.5">Type</p>
              <p className="text-on-surface font-medium">{fmt(s.signal_type)}</p>
            </div>
            <div>
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-on-surface-variant mb-0.5">Stage</p>
              <p className="text-on-surface font-medium">{s.procurement_stage ? fmt(s.procurement_stage) : "Unknown"}</p>
            </div>
            {s.estimated_timeline && (
              <div>
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-on-surface-variant mb-0.5">Timeline</p>
                <p className="text-on-surface font-medium">{s.estimated_timeline}</p>
              </div>
            )}
            {s.estimated_value && (
              <div>
                <p className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-on-surface-variant mb-0.5">Est. Value</p>
                <p className="text-primary-container font-bold">${fmtValue(s.estimated_value)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Card footer actions */}
      <div className="px-6 py-3 flex items-center justify-between" style={{ borderTop: "1px solid rgba(200,197,188,0.3)" }}>
        <div className="flex items-center gap-4">
          <button
            onClick={onToggle}
            className="text-xs font-bold uppercase tracking-wider text-on-surface hover:text-primary transition-colors"
          >
            {isExpanded ? "Show less" : "View more"}
          </button>
          <a
            href={s.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-container transition-colors"
          >
            Source &#x2197;
          </a>
        </div>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-on-surface-variant">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="text-xs font-medium text-on-surface-variant">{s.city}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */

function getStageInsight(stage: string | null): string {
  if (!stage) return "An early-stage opportunity worth monitoring.";
  const insights: Record<string, string> = {
    needs_identified: "A newly identified need — get in early with advisory services.",
    study_authorized: "An authorized study — opportunity to shape requirements.",
    budget_allocated: "Budget is allocated — funding is secured, procurement is likely.",
    market_research: "Active market research — the buyer is evaluating options.",
    specification_development: "Specs are being written — critical window to influence requirements.",
    rfp_imminent: "An imminent RFP — prepare your response team now.",
    rfp_published: "A published RFP — respond immediately.",
    evaluation_in_progress: "Evaluation is underway — outcome pending.",
    shortlisted: "Shortlisting has occurred — competitive intelligence needed.",
    negotiation: "Active negotiation — deal is progressing.",
    awarded: "A contract has been awarded — monitor for subcontracting opportunities.",
    contract_execution: "Contract execution phase — delivery is underway.",
    in_progress: "An active project — look for expansion or follow-on work.",
    closeout: "Project closeout — renewal or replacement opportunity ahead.",
  };
  return insights[stage] || "An active procurement opportunity.";
}

function fmtValue(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString();
}

function StatBox({ label, value, accent, accentMuted }: { label: string; value: string; accent: string; accentMuted?: boolean }) {
  return (
    <div className="bg-white p-5 hover:shadow-[0px_18px_40px_rgba(11,28,48,0.08)] transition-shadow duration-200">
      <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">{label}</p>
      <div className="flex items-end gap-3">
        <p className="text-[2.2rem] font-bold text-on-surface leading-none">{value}</p>
        <span className={`text-xs font-semibold mb-1 ${accentMuted ? "text-on-surface-variant" : "text-primary-container"}`}>{accent}</span>
      </div>
    </div>
  );
}

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
