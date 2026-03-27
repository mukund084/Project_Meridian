"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getAccounts, type Account } from "@/lib/api";

type SortOption = "score" | "signals" | "open_bids" | "name";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<number | undefined>(2026);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("score");

  useEffect(() => {
    setLoading(true);
    setError(null);
    getAccounts({ year: yearFilter })
      .then(setAccounts)
      .catch((err) => setError(err?.message || "Failed to load accounts"))
      .finally(() => setLoading(false));
  }, [yearFilter]);

  const totalBids = accounts.reduce((s, a) => s + a.total_bids, 0);
  const totalSignals = accounts.reduce((s, a) => s + a.total_signals, 0);

  const displayed = useMemo(() => {
    let result = accounts;

    // Filter by search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) => a.city.toLowerCase().includes(q));
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "score":
          return b.avg_score - a.avg_score;
        case "signals":
          return b.total_signals - a.total_signals;
        case "open_bids":
          return b.open_bids - a.open_bids;
        case "name":
          return a.city.localeCompare(b.city);
        default:
          return 0;
      }
    });

    return result;
  }, [accounts, searchQuery, sortBy]);

  if (loading && accounts.length === 0) return <div className="p-10 text-on-surface-variant text-sm">Loading accounts...</div>;

  if (error && accounts.length === 0) return (
    <div className="p-10">
      <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-sm">{error}</p>
    </div>
  );

  return (
    <div className={`p-4 md:p-8 pt-16 md:pt-8 ${loading ? "opacity-60 pointer-events-none" : ""} transition-opacity duration-200`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6 md:mb-8">
        <div>
          <p className="text-label-sm text-on-surface-variant mb-1">Account Intelligence</p>
          <h1 className="text-[1.6rem] md:text-[2rem] font-bold text-on-surface">Canadian Municipalities</h1>
        </div>
        <select
          value={yearFilter ?? ""}
          onChange={(e) => setYearFilter(e.target.value ? parseInt(e.target.value) : undefined)}
          className="px-3.5 py-2.5 text-sm font-medium bg-white border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary min-w-[140px]"
        >
          <option value="">All Years</option>
          {[2025, 2026].map((y) => <option key={y} value={y}>FY {y}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
        <div className="bg-white p-5 rounded-sm">
          <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">Total Accounts</p>
          <p className="text-[2.2rem] font-bold text-on-surface leading-none">{accounts.length}</p>
        </div>
        <div className="bg-white p-5 rounded-sm">
          <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">Total Bids</p>
          <p className="text-[2.2rem] font-bold text-on-surface leading-none">{totalBids.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-sm">
          <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">Total Signals</p>
          <p className="text-[2.2rem] font-bold text-on-surface leading-none">{totalSignals.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-sm">
          <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">Coverage</p>
          <p className="text-[2.2rem] font-bold text-on-surface leading-none">{accounts.length}</p>
          <p className="text-xs text-on-surface-variant mt-1">municipalities tracked</p>
        </div>
      </div>

      {/* Search + Sort Bar */}
      <div className="bg-white p-3 md:p-4 mb-4 md:mb-6 flex items-center gap-3 md:gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-0 w-full sm:w-auto sm:min-w-[180px]">
          <input
            type="text"
            placeholder="Search cities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3.5 py-2.5 pl-9 text-sm font-medium bg-surface-low/30 border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary placeholder:text-outline/40"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="px-3.5 py-2.5 text-sm font-medium bg-white border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary min-w-[180px]"
        >
          <option value="score">Score (High→Low)</option>
          <option value="signals">Signals (High→Low)</option>
          <option value="open_bids">Open Bids (High→Low)</option>
          <option value="name">Name (A→Z)</option>
        </select>

        <span className="text-sm font-semibold text-on-surface-variant">{displayed.length} results</span>
      </div>

      {/* Empty state */}
      {displayed.length === 0 && !error && (
        <div className="text-center py-16 text-on-surface-variant text-sm">No accounts match your search.</div>
      )}

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {displayed.map((a) => (
          <Link key={a.city} href={`/accounts/${encodeURIComponent(a.city)}`} className="bg-white p-6 rounded-sm hover:bg-surface-low/30 transition-colors group">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-[1.1rem] font-bold text-on-surface group-hover:text-primary transition-colors">{a.city}</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">Municipality Account</p>
              </div>
              {/* Signal Score Indicator */}
              <div className="w-10 h-10 command-gradient flex items-center justify-center rounded-sm">
                <span className="text-on-primary text-xs font-bold">{(a.avg_score * 100).toFixed(0)}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xl font-bold text-on-surface">{a.total_bids}</p>
                <p className="text-[0.6rem] uppercase tracking-widest text-on-surface-variant">Bids</p>
              </div>
              <div>
                <p className="text-xl font-bold text-on-surface">{a.total_signals}</p>
                <p className="text-[0.6rem] uppercase tracking-widest text-on-surface-variant">Signals</p>
              </div>
              <div>
                <p className="text-xl font-bold text-on-surface">{a.total_meetings}</p>
                <p className="text-[0.6rem] uppercase tracking-widest text-on-surface-variant">Meetings</p>
              </div>
            </div>
            {a.open_bids > 0 && (
              <div className="mt-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-primary-fixed-dim rounded-full" />
                <span className="text-xs font-semibold text-primary-container">{a.open_bids} open bids</span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
