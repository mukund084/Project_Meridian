"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/badge";
import {
  getSignals,
  getSignalCategories,
  getSignalStats,
  getCities,
  type Signal,
  type CategoryOption,
  type SignalStat,
} from "@/lib/api";

const SIGNAL_TYPES = [
  "Legislative Intent",
  "Budgetary Shift",
  "RFX Pre-solicitation",
  "Contract Renewal",
  "Infrastructure",
  "Technology",
];

export default function SignalsExplorerPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [stats, setStats] = useState<SignalStat[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.0);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    Promise.all([getSignalCategories(), getCities(), getSignalStats()])
      .then(([cats, c, st]) => {
        setCategories(cats);
        setCities(c);
        setStats(st);
      })
      .catch(() => {});
  }, []);

  const fetchSignals = useCallback(() => {
    setLoading(true);
    getSignals({
      city: cityFilter || undefined,
      category: categoryFilter || undefined,
      min_confidence: confidenceThreshold > 0 ? confidenceThreshold : undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
      .then(setSignals)
      .catch(() => setSignals([]))
      .finally(() => setLoading(false));
  }, [cityFilter, categoryFilter, confidenceThreshold, page]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  const totalSignals = stats.reduce((sum, s) => sum + s.count, 0);
  const highConfidence = stats.reduce((sum, s) => sum + (s.avg_confidence >= 0.7 ? s.count : 0), 0);
  const totalValue = stats.reduce((sum, s) => sum + s.count * s.avg_score * 1000000, 0);

  const toggleType = (t: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  return (
    <div className="p-8">
      <div className="grid grid-cols-12 gap-8">
        {/* Left Filter Panel */}
        <div className="col-span-3">
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-[0.75rem] uppercase tracking-[0.2em] text-outline font-bold">
              Intelligence Filters
            </h2>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3h12M4 8h8M6 13h4" stroke="#74777f" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Signal Type */}
          <div className="mb-6">
            <p className="text-[0.7rem] uppercase tracking-[0.15em] text-slate-deep font-bold mb-3">
              Signal Type
            </p>
            <div className="space-y-2">
              {SIGNAL_TYPES.map((t) => (
                <label key={t} className="flex items-center gap-2.5 cursor-pointer group">
                  <div
                    className={`w-4 h-4 border-2 flex items-center justify-center transition-colors ${
                      selectedTypes.has(t)
                        ? "bg-slate-deep border-slate-deep"
                        : "border-outline group-hover:border-slate-deep"
                    }`}
                  >
                    {selectedTypes.has(t) && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-slate-deep">{t}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Confidence Score */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[0.7rem] uppercase tracking-[0.15em] text-slate-deep font-bold">
                Confidence Score
              </p>
              <span className="text-xs font-bold bg-slate-deep text-white px-2 py-0.5">
                {confidenceThreshold.toFixed(2)}+
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
              className="w-full accent-slate-deep h-1 bg-surface-high appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-slate-deep [&::-webkit-slider-thumb]:rounded-full"
            />
            <div className="flex justify-between text-[0.65rem] text-outline mt-1">
              <span>0.0</span>
              <span>1.0</span>
            </div>
          </div>

          {/* Signal Category */}
          <div className="mb-6">
            <p className="text-[0.7rem] uppercase tracking-[0.15em] text-slate-deep font-bold mb-3">
              Signal Category
            </p>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="w-full bg-white text-sm text-slate-deep px-3 py-2.5 border border-surface-high outline-none focus:border-slate-deep transition-colors appearance-none cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* City */}
          <div className="mb-6">
            <p className="text-[0.7rem] uppercase tracking-[0.15em] text-slate-deep font-bold mb-3">
              City
            </p>
            <div className="relative">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                <circle cx="7" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
                <path d="M7 8v4M4 10h6" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              <input
                type="text"
                placeholder="e.g. Washington D.C."
                value={cityFilter}
                onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
                className="w-full bg-white text-sm text-slate-deep pl-9 pr-3 py-2.5 border border-surface-high outline-none focus:border-slate-deep transition-colors placeholder:text-outline/40"
              />
            </div>
          </div>

          {/* Apply Button */}
          <button
            onClick={() => { setPage(1); fetchSignals(); }}
            className="w-full py-3 bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-colors"
          >
            Apply Intelligence Filters
          </button>
        </div>

        {/* Right Content */}
        <div className="col-span-9">
          {/* Stat Cards */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-5">
              <p className="text-[0.7rem] uppercase tracking-[0.15em] text-outline font-semibold mb-2">Active Signals</p>
              <div className="flex items-end gap-3">
                <p className="text-[2.2rem] font-bold text-slate-deep leading-none">{totalSignals.toLocaleString()}</p>
                <span className="text-xs font-semibold text-primary-container mb-1">+12% vs LY</span>
              </div>
            </div>
            <div className="bg-white p-5">
              <p className="text-[0.7rem] uppercase tracking-[0.15em] text-outline font-semibold mb-2">High Confidence</p>
              <div className="flex items-end gap-3">
                <p className="text-[2.2rem] font-bold text-slate-deep leading-none">{highConfidence}</p>
                <span className="text-xs font-semibold text-primary-container mb-1">Verified</span>
              </div>
            </div>
            <div className="bg-white p-5">
              <p className="text-[0.7rem] uppercase tracking-[0.15em] text-outline font-semibold mb-2">Total Pipeline Value</p>
              <div className="flex items-end gap-3">
                <p className="text-[2.2rem] font-bold text-slate-deep leading-none">
                  ${(totalValue / 1e9).toFixed(1)}B
                </p>
                <span className="text-xs text-outline mb-1">Est. Total</span>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-surface-low">
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Signal Type</th>
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Category</th>
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Confidence</th>
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Summary</th>
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">City</th>
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Extracted At</th>
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-outline text-sm">Loading signals...</td>
                  </tr>
                ) : signals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-outline text-sm">No signals match your filters.</td>
                  </tr>
                ) : (
                  signals.map((s, i) => (
                    <tr key={i} className="border-b border-surface-low/50 hover:bg-surface-low/30 transition-colors">
                      <td className="px-4 py-4">
                        <span className="text-sm font-semibold text-slate-deep">
                          {formatLabel(s.signal_type)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="gold">{formatLabel(s.signal_category)}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-deep">{s.confidence.toFixed(2)}</span>
                          {s.confidence >= 0.8 && (
                            <span className="text-[0.6rem] font-bold uppercase bg-slate-deep text-white px-1.5 py-0.5">High</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 max-w-[200px]">
                        <span className="text-sm text-slate-deep line-clamp-2">{s.summary.slice(0, 60)}...</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-slate-deep">{s.city}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs text-outline">
                          {new Date(s.extracted_at).toLocaleDateString("en-CA")}<br />
                          {new Date(s.extracted_at).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <a
                          href={s.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold uppercase tracking-wider text-slate-deep hover:text-primary transition-colors flex items-center gap-1"
                        >
                          View Source
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M4 2h6v6M10 2L4 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-4 py-4 flex items-center justify-between border-t border-surface-low">
              <p className="text-xs uppercase tracking-wider text-outline font-semibold">
                Showing {(page - 1) * pageSize + 1} to {(page - 1) * pageSize + signals.length} of {totalSignals.toLocaleString()} Intelligence Signals
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="text-outline hover:text-slate-deep disabled:opacity-30 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <span className="w-8 h-8 bg-slate-deep text-white text-xs font-bold flex items-center justify-center">
                  {page}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={signals.length < pageSize}
                  className="text-outline hover:text-slate-deep disabled:opacity-30 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
