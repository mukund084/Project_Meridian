"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/badge";
import { getBids, getCities, type Bid } from "@/lib/api";

export default function BidsExplorerPage() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [cityFilter, setCityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState<number | undefined>(2026);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => { getCities({ year: yearFilter }).then(setCities).catch(() => {}); }, [yearFilter]);

  useEffect(() => {
    setLoading(true);
    getBids({ city: cityFilter || undefined, status: statusFilter || undefined, year: yearFilter, limit: pageSize, offset: (page - 1) * pageSize })
      .then(setBids).catch(() => setBids([])).finally(() => setLoading(false));
  }, [cityFilter, statusFilter, yearFilter, page]);

  const filtered = searchQuery ? bids.filter((b) => b.bid_name.toLowerCase().includes(searchQuery.toLowerCase())) : bids;
  const openCount = bids.filter((b) => b.bid_status.toLowerCase().includes("open")).length;

  return (
    <div className="p-8">
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-3">
          <h2 className="text-label-sm text-on-surface-variant tracking-[0.2em] mb-6">Bid Filters</h2>
          <div className="mb-6">
            <p className="text-label-sm text-on-surface font-bold mb-3 tracking-[0.05em]">Status</p>
            <div className="space-y-1">
              {["", "Open", "Closed", "Awarded"].map((s) => (
                <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }} className={`w-full text-left px-3 py-2 text-sm rounded-sm transition-colors ${statusFilter === s ? "command-gradient text-on-primary font-semibold" : "text-on-surface hover:bg-surface-low"}`}>
                  {s || "All Statuses"}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-6">
            <p className="text-label-sm text-on-surface font-bold mb-3 tracking-[0.05em]">City</p>
            <select value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setPage(1); }} className="w-full bg-white text-sm text-on-surface px-3 py-2.5 rounded-sm outline-none focus:ring-1 focus:ring-primary transition-all">
              <option value="">All Cities</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="mb-6">
            <p className="text-label-sm text-on-surface font-bold mb-3 tracking-[0.05em]">Search</p>
            <input type="text" placeholder="Search bid names..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white text-sm text-on-surface px-3 py-2.5 rounded-sm outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-outline/40" />
          </div>
          <div className="mb-6">
            <p className="text-label-sm text-on-surface font-bold mb-3 tracking-[0.05em]">Fiscal Year</p>
            <div className="flex gap-0">
              {[undefined, 2024, 2025, 2026].map((y) => (
                <button
                  key={y ?? "all"}
                  onClick={() => { setYearFilter(y); setPage(1); }}
                  className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors ${yearFilter === y ? "command-gradient text-on-primary" : "bg-white text-on-surface-variant hover:text-primary"}`}
                >
                  {y ?? "All"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-9">
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-5 rounded-sm">
              <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">Total Bids</p>
              <p className="text-[2.2rem] font-bold text-on-surface leading-none">{bids.length}</p>
            </div>
            <div className="bg-white p-5 rounded-sm">
              <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">Open Bids</p>
              <div className="flex items-end gap-3"><p className="text-[2.2rem] font-bold text-on-surface leading-none">{openCount}</p><span className="text-xs font-semibold text-primary-container mb-1">Active</span></div>
            </div>
            <div className="bg-white p-5 rounded-sm">
              <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">Municipalities</p>
              <p className="text-[2.2rem] font-bold text-on-surface leading-none">{cities.length}</p>
            </div>
          </div>

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
                  <tr key={i} className={`hover:bg-surface-low/30 transition-colors ${i % 2 === 1 ? "bg-surface-low/20" : ""}`}>
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
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-on-surface-variant hover:text-primary disabled:opacity-30">&lsaquo;</button>
                <span className="w-8 h-8 command-gradient text-on-primary text-xs font-bold flex items-center justify-center rounded-sm">{page}</span>
                <button onClick={() => setPage((p) => p + 1)} disabled={bids.length < pageSize} className="text-on-surface-variant hover:text-primary disabled:opacity-30">&rsaquo;</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
