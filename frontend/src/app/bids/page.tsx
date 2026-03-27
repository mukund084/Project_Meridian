"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/badge";
import { getBids, getCities, getBidStats, type Bid } from "@/lib/api";

export default function BidsExplorerPage() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [cityFilter, setCityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState<number | undefined>(2026);
  const [stats, setStats] = useState({ total: 0, open: 0, municipalities: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => { getCities().then(setCities).catch(() => {}); }, []);

  useEffect(() => {
    getBidStats({ city: cityFilter || undefined, status: statusFilter || undefined, year: yearFilter })
      .then(setStats).catch(() => {});
  }, [cityFilter, statusFilter, yearFilter]);

  useEffect(() => {
    setLoading(true);
    getBids({ city: cityFilter || undefined, status: statusFilter || undefined, year: yearFilter, limit: pageSize, offset: (page - 1) * pageSize })
      .then(setBids).catch(() => setBids([])).finally(() => setLoading(false));
  }, [cityFilter, statusFilter, yearFilter, page]);

  const filtered = searchQuery ? bids.filter((b) => b.bid_name.toLowerCase().includes(searchQuery.toLowerCase())) : bids;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-label-sm text-on-surface-variant tracking-[0.2em] mb-1.5">Intelligence Explorer</p>
        <h1 className="text-[2rem] font-bold text-on-surface tracking-tight">Bids &amp; Tenders</h1>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <StatBox label="Total Bids" value={stats.total.toLocaleString()} accent="All time" accentMuted />
        <StatBox label="Open Bids" value={stats.open.toLocaleString()} accent="Active" />
        <StatBox label="Municipalities" value={stats.municipalities.toLocaleString()} accent="Coverage" accentMuted />
      </div>

      {/* Filters Row */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Year */}
          <select
            value={yearFilter ?? ""}
            onChange={(e) => { setYearFilter(e.target.value ? parseInt(e.target.value) : undefined); setPage(1); }}
            className="px-3.5 py-2.5 text-sm font-medium bg-white border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary min-w-[140px]"
          >
            <option value="">All Years</option>
            {[2025, 2026].map((y) => <option key={y} value={y}>FY {y}</option>)}
          </select>

          {/* City */}
          <select
            value={cityFilter}
            onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
            className="px-3.5 py-2.5 text-sm font-medium bg-white border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary min-w-[160px]"
          >
            <option value="">All Cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3.5 py-2.5 text-sm font-medium bg-white border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary min-w-[160px]"
          >
            <option value="">All Statuses</option>
            {["Open", "Closed", "Awarded"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search bid names..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              className="px-3.5 py-2.5 pl-9 text-sm font-medium bg-white border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary min-w-[220px] placeholder:text-outline/40"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Results Counter */}
        <div className="text-sm font-semibold text-on-surface-variant tracking-wide shrink-0">
          {stats.total.toLocaleString()} results
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-sm">
        <table className="w-full text-left">
          <thead><tr className="bg-surface-low/50">
            {["Status", "Bid Name", "City", "Classification", "Closing Date", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 text-label-sm font-bold text-on-surface-variant tracking-widest">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="px-4 py-12 text-center text-on-surface-variant text-sm">Loading...</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-on-surface-variant text-sm">No bids found.</td></tr>
            : filtered.map((b, i) => (
              <tr key={i} className={`hover:bg-surface-high/40 transition-colors ${i % 2 === 1 ? "bg-surface-low/20" : ""}`}>
                <td className="px-4 py-4"><Badge variant={b.bid_status.toLowerCase().includes("open") ? "active" : "muted"}>{b.bid_status}</Badge></td>
                <td className="px-4 py-4 max-w-[300px]">
                  <span className="text-sm font-medium text-on-surface line-clamp-2">{b.bid_name}</span>
                  {b.days_left && <span className="text-xs text-on-surface-variant block mt-0.5">{b.days_left}</span>}
                </td>
                <td className="px-4 py-4 text-sm text-on-surface">{b.city}</td>
                <td className="px-4 py-4 text-sm text-on-surface-variant">{b.bid_classification || "\u2014"}</td>
                <td className="px-4 py-4 text-sm text-on-surface">{b.bid_closing_date}</td>
                <td className="px-4 py-4"><a href={b.bid_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-container transition-colors">View &#x2197;</a></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-4 flex items-center justify-between">
          <p className="text-label-sm text-on-surface-variant tracking-wider">Page {page}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-on-surface-variant hover:text-primary disabled:opacity-30 transition-colors">&lsaquo;</button>
            <span className="w-8 h-8 command-gradient text-on-primary text-xs font-bold flex items-center justify-center rounded-sm">{page}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={bids.length < pageSize} className="text-on-surface-variant hover:text-primary disabled:opacity-30 transition-colors">&rsaquo;</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, accent, accentMuted }: { label: string; value: string | number; accent?: string; accentMuted?: boolean }) {
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
