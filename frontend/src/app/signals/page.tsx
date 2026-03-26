"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/badge";
import { getSignals, getSignalStats, getCities, type Signal, type SignalStat } from "@/lib/api";

export default function SignalsExplorerPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [stats, setStats] = useState<SignalStat[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.0);
  const [yearFilter, setYearFilter] = useState<number | undefined>(2026);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    getCities({ year: yearFilter }).then(setCities).catch(() => {});
  }, [yearFilter]);

  useEffect(() => {
    getSignalStats({ year: yearFilter }).then(setStats).catch(() => {});
  }, [yearFilter]);

  const fetchSignals = useCallback(() => {
    setLoading(true);
    // When multiple categories or cities are selected, we pass the first one to the API
    // and filter the rest client-side (API supports single filters)
    const cityParam = selectedCities.size === 1 ? [...selectedCities][0] : undefined;
    const catParam = selectedCategories.size === 1 ? [...selectedCategories][0] : undefined;

    getSignals({
      city: cityParam,
      category: catParam,
      year: yearFilter,
      min_confidence: confidenceThreshold > 0 ? confidenceThreshold : undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
      .then(setSignals)
      .catch(() => setSignals([]))
      .finally(() => setLoading(false));
  }, [selectedCities, selectedCategories, yearFilter, confidenceThreshold, page]);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  const totalSignals = stats.reduce((sum, s) => sum + s.count, 0);
  const highConfidence = stats.reduce((sum, s) => sum + (s.avg_confidence >= 0.7 ? s.count : 0), 0);
  const totalValue = stats.reduce((sum, s) => sum + s.count * s.avg_score * 1000000, 0);

  function toggleSet<T>(set: Set<T>, val: T): Set<T> {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    return next;
  }

  // Category labels
  const categoryLabels: Record<string, string> = {
    policy_regulatory: "Policy & Regulatory",
    scope: "Scope",
    budget: "Budget",
    decision_maker: "Decision Maker",
    geographic: "Geographic",
    engagement: "Engagement",
    infrastructure: "Infrastructure",
    lifecycle: "Lifecycle",
    timing: "Timing",
    incumbent_competitor: "Incumbent / Competitor",
    risk: "Risk",
    political: "Political",
    environmental: "Environmental",
    workforce: "Workforce",
    technology: "Technology",
    contract_structure: "Contract Structure",
  };

  // Sorted categories by count
  const sortedCategories = [...stats].sort((a, b) => b.count - a.count);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-label-sm text-on-surface-variant tracking-[0.2em] mb-1.5">Intelligence Explorer</p>
        <h1 className="text-[2rem] font-bold text-on-surface tracking-tight">Signals</h1>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <StatBox label="Active Signals" value={totalSignals.toLocaleString()} accent={`${stats.length} categories`} />
        <StatBox label="High Confidence" value={highConfidence.toLocaleString()} accent="≥ 0.70" />
        <StatBox label="Total Pipeline Value" value={`$${(totalValue / 1e9).toFixed(1)}B`} accent="Est. Total" accentMuted />
      </div>

      {/* Filter Toggles */}
      <div className="mb-8 space-y-5">
        {/* Row 1: Year */}
        <div className="flex items-center gap-3">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-on-surface-variant w-[80px] shrink-0">Year</span>
          <div className="flex flex-wrap gap-1.5">
            {[undefined, 2024, 2025, 2026].map((y) => (
              <button
                key={y ?? "all"}
                onClick={() => { setYearFilter(y); setPage(1); }}
                className={`px-3.5 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider transition-all ${
                  yearFilter === y
                    ? "command-gradient text-on-primary"
                    : "bg-white text-on-surface-variant hover:text-primary hover:bg-surface-low"
                }`}
              >
                {y ?? "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Cities */}
        <div className="flex items-start gap-3">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-on-surface-variant w-[80px] shrink-0 mt-1.5">City</span>
          <div className="flex flex-wrap gap-1.5">
            {cities.map((c) => (
              <button
                key={c}
                onClick={() => { setSelectedCities(toggleSet(selectedCities, c)); setPage(1); }}
                className={`px-3 py-1.5 text-[0.65rem] font-semibold transition-all ${
                  selectedCities.has(c)
                    ? "command-gradient text-on-primary"
                    : "bg-white text-on-surface-variant hover:text-primary hover:bg-surface-low"
                }`}
              >
                {c}
              </button>
            ))}
            {selectedCities.size > 0 && (
              <button
                onClick={() => { setSelectedCities(new Set()); setPage(1); }}
                className="px-3 py-1.5 text-[0.65rem] font-bold text-primary hover:text-primary-container transition-colors"
              >
                Clear ✕
              </button>
            )}
          </div>
        </div>

        {/* Row 3: Categories */}
        <div className="flex items-start gap-3">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-on-surface-variant w-[80px] shrink-0 mt-1.5">Category</span>
          <div className="flex flex-wrap gap-1.5">
            {sortedCategories.map((s) => (
              <button
                key={s.category}
                onClick={() => { setSelectedCategories(toggleSet(selectedCategories, s.category)); setPage(1); }}
                className={`px-3 py-1.5 text-[0.65rem] font-semibold transition-all inline-flex items-center gap-1.5 ${
                  selectedCategories.has(s.category)
                    ? "command-gradient text-on-primary"
                    : "bg-white text-on-surface-variant hover:text-primary hover:bg-surface-low"
                }`}
              >
                {categoryLabels[s.category] || fmt(s.category)}
                <span className={`text-[0.55rem] ${selectedCategories.has(s.category) ? "text-white/60" : "text-outline"}`}>
                  {s.count.toLocaleString()}
                </span>
              </button>
            ))}
            {selectedCategories.size > 0 && (
              <button
                onClick={() => { setSelectedCategories(new Set()); setPage(1); }}
                className="px-3 py-1.5 text-[0.65rem] font-bold text-primary hover:text-primary-container transition-colors"
              >
                Clear ✕
              </button>
            )}
          </div>
        </div>

        {/* Row 4: Confidence */}
        <div className="flex items-center gap-3">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.15em] text-on-surface-variant w-[80px] shrink-0">Confidence</span>
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => { setConfidenceThreshold(parseFloat(e.target.value)); setPage(1); }}
              className="flex-1"
            />
            <span className="text-xs font-bold bg-primary text-on-primary px-2.5 py-1 min-w-[52px] text-center">{confidenceThreshold.toFixed(2)}+</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-surface-low/50">
              {["Signal Type", "Category", "Confidence", "Summary", "City", "Extracted At", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-label-sm font-bold text-on-surface-variant tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-on-surface-variant text-sm">Loading...</td></tr>
            ) : signals.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-on-surface-variant text-sm">No signals match filters.</td></tr>
            ) : (
              signals.map((s, i) => (
                <tr key={i} className={`hover:bg-surface-low/30 transition-colors ${i % 2 === 1 ? "bg-surface-low/20" : ""}`}>
                  <td className="px-4 py-4 text-sm font-semibold text-on-surface">{fmt(s.signal_type)}</td>
                  <td className="px-4 py-4"><Badge variant="active">{fmt(s.signal_category)}</Badge></td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-surface-high">
                        <div
                          className={`h-full ${s.confidence >= 0.8 ? "command-gradient" : "bg-primary-fixed-dim"}`}
                          style={{ width: `${s.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-on-surface">{s.confidence.toFixed(2)}</span>
                      {s.confidence >= 0.8 && <span className="text-[0.55rem] font-bold uppercase bg-primary text-on-primary px-1.5 py-0.5">High</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4 max-w-[220px] text-sm text-on-surface line-clamp-2">{s.summary.slice(0, 80)}...</td>
                  <td className="px-4 py-4 text-sm text-on-surface">{s.city}</td>
                  <td className="px-4 py-4 text-xs text-on-surface-variant">{new Date(s.extracted_at).toLocaleDateString("en-CA")}</td>
                  <td className="px-4 py-4">
                    <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-container transition-colors">
                      View Source &#x2197;
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="px-4 py-4 flex items-center justify-between">
          <p className="text-label-sm text-on-surface-variant tracking-wider">
            Showing {(page - 1) * pageSize + 1} to {(page - 1) * pageSize + signals.length} of {totalSignals.toLocaleString()} signals
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-on-surface-variant hover:text-primary disabled:opacity-30 transition-colors">&lsaquo;</button>
            <span className="w-8 h-8 command-gradient text-on-primary text-xs font-bold flex items-center justify-center">{page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={signals.length < pageSize} className="text-on-surface-variant hover:text-primary disabled:opacity-30 transition-colors">&rsaquo;</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, accent, accentMuted }: { label: string; value: string; accent: string; accentMuted?: boolean }) {
  return (
    <div className="bg-white p-5">
      <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">{label}</p>
      <div className="flex items-end gap-3">
        <p className="text-[2.2rem] font-bold text-on-surface leading-none">{value}</p>
        <span className={`text-xs font-semibold mb-1 ${accentMuted ? "text-on-surface-variant" : "text-primary-container"}`}>{accent}</span>
      </div>
    </div>
  );
}

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
