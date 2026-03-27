"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  const pageSize = 15;
  const offsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { getCities({ year: yearFilter }).then(setCities).catch(() => {}); }, [yearFilter]);

  useEffect(() => {
    const params = { city: cityFilter || undefined, status: statusFilter || undefined, year: yearFilter };
    getBidStats(params).then(setStats).catch(() => {});
  }, [cityFilter, statusFilter, yearFilter]);

  const loadBids = useCallback((reset: boolean) => {
    if (reset) {
      offsetRef.current = 0;
      setHasMore(true);
      setExpandedCard(null);
    }
    if (reset) setLoading(true); else setLoadingMore(true);
    setError(null);

    getBids({
      city: cityFilter || undefined,
      status: statusFilter || undefined,
      year: yearFilter,
      limit: pageSize,
      offset: offsetRef.current,
    })
      .then((data) => {
        if (reset) setBids(data); else setBids((prev) => [...prev, ...data]);
        if (data.length < pageSize) setHasMore(false);
        offsetRef.current += data.length;
      })
      .catch((err) => { setError(err?.message || "Failed to load bids"); if (reset) setBids([]); })
      .finally(() => { setLoading(false); setLoadingMore(false); });
  }, [cityFilter, statusFilter, yearFilter]);

  useEffect(() => { loadBids(true); }, [loadBids]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadBids(false);
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadBids]);

  const filtered = searchQuery
    ? bids.filter((b) => b.bid_name.toLowerCase().includes(searchQuery.toLowerCase()) || b.city.toLowerCase().includes(searchQuery.toLowerCase()))
    : bids;

  return (
    <div className="p-4 md:p-8 pt-16 md:pt-8">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <p className="text-label-sm text-on-surface-variant tracking-[0.2em] mb-1.5">Intelligence Explorer</p>
        <h1 className="text-[1.6rem] md:text-[2rem] font-bold text-on-surface tracking-tight">Bids &amp; Tenders</h1>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-5 mb-6 md:mb-8">
        <StatBox label="Total Bids" value={stats.total.toLocaleString()} accent="All time" accentMuted />
        <StatBox label="Open Bids" value={stats.open.toLocaleString()} accent="Active" />
        <StatBox label="Municipalities" value={stats.municipalities.toLocaleString()} accent="Coverage" accentMuted />
      </div>

      {/* Search + Filters Bar */}
      <div className="bg-white p-3 md:p-4 mb-4 md:mb-6 flex items-center gap-3 md:gap-4 flex-wrap">
        <div className="relative flex-1 min-w-0 w-full sm:w-auto sm:min-w-[180px]">
          <input
            type="text"
            placeholder="Search bids..."
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
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="px-3.5 py-2.5 text-sm font-medium bg-white border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary min-w-[150px]"
        >
          <option value="">All Cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 text-sm font-medium bg-white border border-surface-high rounded-sm text-on-surface outline-none hover:border-primary transition-colors focus:border-primary min-w-[140px]"
        >
          <option value="">All Statuses</option>
          {["Open", "Closed", "Awarded"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <span className="text-sm font-semibold text-on-surface-variant">{stats.total.toLocaleString()} results</span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-sm">{error}</div>
      )}

      {/* Loading skeleton */}
      {loading && bids.length === 0 && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-sm animate-pulse">
              <div className="flex gap-2 mb-3"><div className="h-5 w-20 bg-surface-high rounded-sm" /><div className="h-5 w-28 bg-surface-high rounded-sm" /></div>
              <div className="h-5 w-3/4 bg-surface-high rounded-sm mb-2" />
              <div className="h-4 w-full bg-surface-low rounded-sm mb-1" />
              <div className="h-4 w-2/3 bg-surface-low rounded-sm" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && !error && (
        <div className="text-center py-16 text-on-surface-variant text-sm">No bids match your filters.</div>
      )}

      {/* Bid Cards */}
      <div className="space-y-4">
        {filtered.map((b, i) => (
          <BidCard
            key={`${b.bid_url}-${i}`}
            bid={b}
            isExpanded={expandedCard === i}
            onToggle={() => setExpandedCard(expandedCard === i ? null : i)}
          />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-1" />

      {loadingMore && (
        <div className="flex items-center justify-center gap-2 py-8">
          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          <span className="text-xs text-on-surface-variant">Loading more bids...</span>
        </div>
      )}

      {!hasMore && bids.length > 0 && (
        <p className="text-center text-xs text-on-surface-variant py-6">All {bids.length} bids loaded</p>
      )}
    </div>
  );
}

/* ── Bid Card ── */
function BidCard({ bid: b, isExpanded, onToggle }: {
  bid: Bid; isExpanded: boolean; onToggle: () => void;
}) {
  const isOpen = b.bid_status.toLowerCase().includes("open");
  const planTakersCount = b.plan_takers?.length ?? 0;
  const bidsSubmittedCount = b.bids_submitted?.length ?? 0;

  return (
    <div className="bg-white rounded-sm hover:shadow-[0px_18px_40px_rgba(11,28,48,0.08)] transition-shadow duration-200">
      {/* Card header */}
      <div className="p-6 pb-0">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={isOpen ? "active" : "muted"}>{b.bid_status}</Badge>
            {b.bid_classification && <Badge variant="muted">{b.bid_classification}</Badge>}
            {b.bid_type && <Badge variant="muted">{b.bid_type}</Badge>}
          </div>
          {b.days_left && (
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <div className={`w-2 h-2 rounded-full ${isOpen ? "bg-primary" : "bg-surface-high"}`} />
              <span className="text-xs text-on-surface-variant">{b.days_left}</span>
            </div>
          )}
        </div>

        {/* Title */}
        <h3 className="text-[1.1rem] font-bold text-on-surface leading-snug mb-2">{b.bid_name}</h3>

        {/* Description */}
        {b.description && (
          <p className="text-[0.875rem] text-on-surface/80 leading-relaxed mb-3 line-clamp-2">{b.description}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-5 text-[0.8rem] text-on-surface/60 mb-4 flex-wrap">
          {b.bid_number && <span className="font-medium">Bid #: <span className="font-bold text-on-surface">{b.bid_number}</span></span>}
          <span className="font-medium">Deadline: <span className="font-bold text-on-surface">{b.bid_closing_date || "\u2014"}</span></span>
          {b.published_date && <span className="font-medium">Published: <span className="text-on-surface/80">{b.published_date}</span></span>}
          {planTakersCount > 0 && (
            <span className="font-medium">Plan Takers: <span className="font-bold text-primary">{planTakersCount}</span></span>
          )}
          {bidsSubmittedCount > 0 && (
            <span className="font-medium">Bids Submitted: <span className="font-bold text-primary">{bidsSubmittedCount}</span></span>
          )}
        </div>
      </div>

      {/* Expandable detail section */}
      {isExpanded && (
        <div className="px-6 pb-2">
          {/* Full description */}
          {b.description && (
            <div className="mb-4">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-on-surface/50 mb-1.5">Full Description</p>
              <p className="text-[0.875rem] text-on-surface/80 leading-relaxed">{b.description}</p>
            </div>
          )}

          {/* Contact Info */}
          {b.purchasing_representive && (
            <div className="bg-primary-fixed/30 border border-primary-fixed rounded-sm p-4 mb-4">
              <div className="flex items-start gap-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-primary mt-0.5 shrink-0">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <div>
                  <p className="text-[0.9rem] font-bold text-on-surface">{b.purchasing_representive.name}</p>
                  <a href={`mailto:${b.purchasing_representive.contact_email}`} className="text-[0.85rem] font-medium text-primary hover:text-primary-container transition-colors">
                    {b.purchasing_representive.contact_email}
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Detail grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-on-surface/50 mb-1">Status</p>
              <p className="text-[0.9rem] text-on-surface font-semibold">{b.bid_status}</p>
            </div>
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-on-surface/50 mb-1">Closing Date</p>
              <p className="text-[0.85rem] text-on-surface font-semibold">{b.bid_closing_date || "\u2014"}</p>
            </div>
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-on-surface/50 mb-1">Plan Takers</p>
              <p className="text-[0.9rem] text-on-surface font-bold">{planTakersCount}</p>
            </div>
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-on-surface/50 mb-1">Bids Submitted</p>
              <p className="text-[0.9rem] text-on-surface font-bold">{bidsSubmittedCount}</p>
            </div>
          </div>

          {/* Categories */}
          {b.categories && b.categories.length > 0 && (
            <div className="mb-4">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-on-surface/50 mb-2">Categories</p>
              <div className="flex flex-wrap gap-2">
                {b.categories.map((c, i) => (
                  <span key={i} className="text-[0.8rem] font-medium bg-surface-low/50 text-on-surface/70 px-2.5 py-1 rounded-sm">{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Plan Takers list */}
          {b.plan_takers && b.plan_takers.length > 0 && (
            <div className="mb-4">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-on-surface/50 mb-2">Plan Takers ({b.plan_takers.length})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {b.plan_takers.slice(0, 10).map((pt, i) => (
                  <div key={i} className="text-[0.8rem] bg-surface-low/30 px-3 py-2.5 rounded-sm">
                    <span className="font-semibold text-on-surface">{pt.company_name}</span>
                    {pt.contact_address && <span className="text-on-surface/50 ml-1">— {pt.contact_address}</span>}
                  </div>
                ))}
                {b.plan_takers.length > 10 && (
                  <span className="text-[0.8rem] font-medium text-on-surface/50 px-3 py-2">+{b.plan_takers.length - 10} more</span>
                )}
              </div>
            </div>
          )}

          {/* Bids Submitted list */}
          {b.bids_submitted && b.bids_submitted.length > 0 && (
            <div className="mb-2">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-on-surface/50 mb-2">Bids Submitted ({b.bids_submitted.length})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {b.bids_submitted.map((sub, i) => (
                  <div key={i} className="text-[0.8rem] bg-surface-low/30 px-3 py-2.5 rounded-sm flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-on-surface">{sub.company_name}</span>
                      {sub.contact_address && <span className="text-on-surface/50 ml-1">— {sub.contact_address}</span>}
                    </div>
                    {sub.result && <Badge variant={sub.result.toLowerCase() === "won" ? "active" : "muted"}>{sub.result}</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Card footer */}
      <div className="px-6 py-3 flex items-center justify-between" style={{ borderTop: "1px solid rgba(200,197,188,0.3)" }}>
        <div className="flex items-center gap-4">
          <button
            onClick={onToggle}
            className="text-xs font-bold uppercase tracking-wider text-on-surface hover:text-primary transition-colors"
          >
            {isExpanded ? "Show less" : "View more"}
          </button>
          <a
            href={b.bid_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold uppercase tracking-wider text-primary hover:text-primary-container transition-colors"
          >
            View Bid &#x2197;
          </a>
        </div>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-on-surface-variant">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="text-xs font-medium text-on-surface-variant">{b.city}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */

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
