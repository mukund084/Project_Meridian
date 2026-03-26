"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/badge";
import { getSignals, getSignalCategories, getSignalStats, getCities, type Signal, type CategoryOption, type SignalStat } from "@/lib/api";

const SIGNAL_TYPES = ["Legislative Intent", "Budgetary Shift", "RFX Pre-solicitation", "Contract Renewal", "Infrastructure", "Technology"];

export default function SignalsExplorerPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [stats, setStats] = useState<SignalStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.0);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    Promise.all([getSignalCategories(), getSignalStats()])
      .then(([cats, st]) => { setCategories(cats); setStats(st); })
      .catch(() => {});
  }, []);

  const fetchSignals = useCallback(() => {
    setLoading(true);
    getSignals({ city: cityFilter || undefined, category: categoryFilter || undefined, min_confidence: confidenceThreshold > 0 ? confidenceThreshold : undefined, limit: pageSize, offset: (page - 1) * pageSize })
      .then(setSignals).catch(() => setSignals([])).finally(() => setLoading(false));
  }, [cityFilter, categoryFilter, confidenceThreshold, page]);

  useEffect(() => { fetchSignals(); }, [fetchSignals]);

  const totalSignals = stats.reduce((sum, s) => sum + s.count, 0);
  const highConfidence = stats.reduce((sum, s) => sum + (s.avg_confidence >= 0.7 ? s.count : 0), 0);
  const totalValue = stats.reduce((sum, s) => sum + s.count * s.avg_score * 1000000, 0);

  return (
    <div className="p-8">
      <div className="grid grid-cols-12 gap-8">
        {/* Filter Panel */}
        <div className="col-span-3">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-label-sm text-on-surface-variant tracking-[0.2em]">Intelligence Filters</h2>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3h12M4 8h8M6 13h4" stroke="#74796f" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>

          {/* Signal Type */}
          <div className="mb-6">
            <p className="text-label-sm text-on-surface font-bold mb-3 tracking-[0.05em]">Signal Type</p>
            <div className="space-y-2">
              {SIGNAL_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-2.5 cursor-pointer group">
                  <div className={`w-4 h-4 rounded-sm flex items-center justify-center transition-colors ${selectedTypes.has(t) ? "bg-primary" : "bg-surface-low group-hover:bg-surface-high"}`}>
                    {selectedTypes.has(t) && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                  <span className="text-sm text-on-surface">{t}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Confidence */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-label-sm text-on-surface font-bold tracking-[0.05em]">Confidence Score</p>
              <span className="text-xs font-bold bg-primary text-on-primary px-2 py-0.5 rounded-sm">{confidenceThreshold.toFixed(2)}+</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" value={confidenceThreshold} onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))} className="w-full" />
            <div className="flex justify-between text-[0.6rem] text-on-surface-variant mt-1"><span>0.0</span><span>1.0</span></div>
          </div>

          {/* Category */}
          <div className="mb-6">
            <p className="text-label-sm text-on-surface font-bold mb-3 tracking-[0.05em]">Signal Category</p>
            <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className="w-full bg-white text-sm text-on-surface px-3 py-2.5 rounded-sm outline-none focus:ring-1 focus:ring-primary transition-all">
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {/* City */}
          <div className="mb-6">
            <p className="text-label-sm text-on-surface font-bold mb-3 tracking-[0.05em]">City</p>
            <input type="text" placeholder="e.g. Markham, ON" value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setPage(1); }} className="w-full bg-white text-sm text-on-surface px-3 py-2.5 rounded-sm outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/40" />
          </div>

          <button onClick={() => { setPage(1); fetchSignals(); }} className="w-full py-3 command-gradient text-on-primary text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity rounded-sm">
            Apply Intelligence Filters
          </button>
        </div>

        {/* Content */}
        <div className="col-span-9">
          <div className="grid grid-cols-3 gap-6 mb-8">
            <StatBox label="Active Signals" value={totalSignals.toLocaleString()} accent="+12% vs LY" />
            <StatBox label="High Confidence" value={String(highConfidence)} accent="Verified" />
            <StatBox label="Total Pipeline Value" value={`$${(totalValue / 1e9).toFixed(1)}B`} accent="Est. Total" accentMuted />
          </div>

          <div className="bg-white rounded-sm">
            <table className="w-full text-left">
              <thead><tr className="bg-surface-low/50">
                {["Signal Type", "Category", "Confidence", "Summary", "City", "Extracted At", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-label-sm font-bold text-on-surface-variant tracking-widest">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-on-surface-variant text-sm">Loading...</td></tr>
                : signals.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-on-surface-variant text-sm">No signals match filters.</td></tr>
                : signals.map((s, i) => (
                  <tr key={i} className={`hover:bg-surface-low/30 transition-colors ${i % 2 === 1 ? "bg-surface-low/20" : ""}`}>
                    <td className="px-4 py-4 text-sm font-semibold text-on-surface">{fmt(s.signal_type)}</td>
                    <td className="px-4 py-4"><Badge variant="active">{fmt(s.signal_category)}</Badge></td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-bold text-on-surface">{s.confidence.toFixed(2)}</span>
                      {s.confidence >= 0.8 && <span className="ml-2 text-[0.6rem] font-bold uppercase bg-primary text-on-primary px-1.5 py-0.5 rounded-sm">High</span>}
                    </td>
                    <td className="px-4 py-4 max-w-[200px] text-sm text-on-surface line-clamp-2">{s.summary.slice(0, 60)}...</td>
                    <td className="px-4 py-4 text-sm text-on-surface">{s.city}</td>
                    <td className="px-4 py-4 text-xs text-on-surface-variant">{new Date(s.extracted_at).toLocaleDateString("en-CA")}</td>
                    <td className="px-4 py-4">
                      <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-container transition-colors">
                        View Source &#x2197;
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-4 flex items-center justify-between">
              <p className="text-label-sm text-on-surface-variant tracking-wider">
                Showing {(page - 1) * pageSize + 1} to {(page - 1) * pageSize + signals.length} of {totalSignals.toLocaleString()} signals
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-on-surface-variant hover:text-primary disabled:opacity-30 transition-colors">&lsaquo;</button>
                <span className="w-8 h-8 command-gradient text-on-primary text-xs font-bold flex items-center justify-center rounded-sm">{page}</span>
                <button onClick={() => setPage((p) => p + 1)} disabled={signals.length < pageSize} className="text-on-surface-variant hover:text-primary disabled:opacity-30 transition-colors">&rsaquo;</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, accent, accentMuted }: { label: string; value: string; accent: string; accentMuted?: boolean }) {
  return (
    <div className="bg-white p-5 rounded-sm">
      <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">{label}</p>
      <div className="flex items-end gap-3">
        <p className="text-[2.2rem] font-bold text-on-surface leading-none">{value}</p>
        <span className={`text-xs font-semibold mb-1 ${accentMuted ? "text-on-surface-variant" : "text-primary-container"}`}>{accent}</span>
      </div>
    </div>
  );
}

function fmt(s: string) { return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
