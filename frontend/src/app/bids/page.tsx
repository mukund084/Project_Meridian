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
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    getCities().then(setCities).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    getBids({
      city: cityFilter || undefined,
      status: statusFilter || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
      .then(setBids)
      .catch(() => setBids([]))
      .finally(() => setLoading(false));
  }, [cityFilter, statusFilter, page]);

  const filteredBids = searchQuery
    ? bids.filter((b) => b.bid_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : bids;

  const openCount = bids.filter((b) => b.bid_status.toLowerCase().includes("open")).length;
  const closedCount = bids.filter((b) => b.bid_status.toLowerCase().includes("closed")).length;

  return (
    <div className="p-8">
      <div className="grid grid-cols-12 gap-8">
        {/* Left Filter Panel */}
        <div className="col-span-3">
          <h2 className="text-[0.75rem] uppercase tracking-[0.2em] text-outline font-bold mb-6">
            Bid Filters
          </h2>

          {/* Status */}
          <div className="mb-6">
            <p className="text-[0.7rem] uppercase tracking-[0.15em] text-slate-deep font-bold mb-3">
              Bid Status
            </p>
            <div className="space-y-2">
              {["", "Open", "Closed", "Awarded"].map((s) => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    statusFilter === s
                      ? "bg-slate-deep text-white font-semibold"
                      : "text-slate-deep hover:bg-surface-low"
                  }`}
                >
                  {s || "All Statuses"}
                </button>
              ))}
            </div>
          </div>

          {/* City */}
          <div className="mb-6">
            <p className="text-[0.7rem] uppercase tracking-[0.15em] text-slate-deep font-bold mb-3">
              City
            </p>
            <select
              value={cityFilter}
              onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
              className="w-full bg-white text-sm text-slate-deep px-3 py-2.5 border border-surface-high outline-none focus:border-slate-deep transition-colors appearance-none cursor-pointer"
            >
              <option value="">All Cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="mb-6">
            <p className="text-[0.7rem] uppercase tracking-[0.15em] text-slate-deep font-bold mb-3">
              Search
            </p>
            <input
              type="text"
              placeholder="Search bid names..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-sm text-slate-deep px-3 py-2.5 border border-surface-high outline-none focus:border-slate-deep transition-colors placeholder:text-outline/40"
            />
          </div>
        </div>

        {/* Right Content */}
        <div className="col-span-9">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-5">
              <p className="text-[0.7rem] uppercase tracking-[0.15em] text-outline font-semibold mb-2">Total Bids</p>
              <p className="text-[2.2rem] font-bold text-slate-deep leading-none">{bids.length}</p>
            </div>
            <div className="bg-white p-5">
              <p className="text-[0.7rem] uppercase tracking-[0.15em] text-outline font-semibold mb-2">Open</p>
              <div className="flex items-end gap-3">
                <p className="text-[2.2rem] font-bold text-slate-deep leading-none">{openCount}</p>
                <span className="text-xs font-semibold text-primary-container mb-1">Active</span>
              </div>
            </div>
            <div className="bg-white p-5">
              <p className="text-[0.7rem] uppercase tracking-[0.15em] text-outline font-semibold mb-2">Closed</p>
              <p className="text-[2.2rem] font-bold text-slate-deep leading-none">{closedCount}</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-surface-low">
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Status</th>
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Bid Name</th>
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">City</th>
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Classification</th>
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Closing Date</th>
                  <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-outline text-sm">Loading bids...</td>
                  </tr>
                ) : filteredBids.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-outline text-sm">No bids match your filters.</td>
                  </tr>
                ) : (
                  filteredBids.map((b, i) => (
                    <tr key={i} className="border-b border-surface-low/50 hover:bg-surface-low/30 transition-colors">
                      <td className="px-4 py-4">
                        <Badge variant={b.bid_status.toLowerCase().includes("open") ? "crimson" : "muted"}>
                          {b.bid_status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 max-w-[300px]">
                        <span className="text-sm font-medium text-slate-deep line-clamp-2">{b.bid_name}</span>
                        {b.days_left && (
                          <span className="text-xs text-outline block mt-0.5">{b.days_left}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-deep">{b.city}</td>
                      <td className="px-4 py-4 text-sm text-outline">{b.bid_classification || "\u2014"}</td>
                      <td className="px-4 py-4 text-sm text-slate-deep">{b.bid_closing_date}</td>
                      <td className="px-4 py-4">
                        <a
                          href={b.bid_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold uppercase tracking-wider text-slate-deep hover:text-primary transition-colors flex items-center gap-1"
                        >
                          View
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
                Page {page}
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
                  disabled={bids.length < pageSize}
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
