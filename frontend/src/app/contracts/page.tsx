"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/badge";
import { getExpiringContracts, getCities, type Bid } from "@/lib/api";

export default function ContractTrackerPage() {
  const [contracts, setContracts] = useState<Bid[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [days, setDays] = useState(90);
  const [cityFilter, setCityFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { getCities().then(setCities).catch(() => {}); }, []);

  useEffect(() => {
    setLoading(true);
    getExpiringContracts({ days, city: cityFilter || undefined, limit: 100 })
      .then(setContracts).catch(() => setContracts([])).finally(() => setLoading(false));
  }, [days, cityFilter]);

  const urgentCount = contracts.filter((c) => {
    const daysLeft = Math.ceil((new Date(c.bid_closing_date).getTime() - Date.now()) / 86400000);
    return daysLeft <= 30;
  }).length;

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-label-sm text-on-surface-variant mb-1">Contract Intelligence</p>
          <h1 className="text-[2rem] font-bold text-on-surface">Expiration Tracker</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-5 rounded-sm">
          <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">Expiring ({days}d)</p>
          <p className="text-[2.2rem] font-bold text-on-surface leading-none">{contracts.length}</p>
        </div>
        <div className="bg-white p-5 rounded-sm">
          <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">Urgent (30d)</p>
          <div className="flex items-end gap-3">
            <p className="text-[2.2rem] font-bold text-on-surface leading-none">{urgentCount}</p>
            {urgentCount > 0 && <span className="text-xs font-semibold text-primary-container mb-1">Action Required</span>}
          </div>
        </div>
        <div className="bg-white p-5 rounded-sm">
          <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">Municipalities</p>
          <p className="text-[2.2rem] font-bold text-on-surface leading-none">{new Set(contracts.map((c) => c.city)).size}</p>
        </div>
        <div className="bg-white p-5 rounded-sm">
          <p className="text-label-sm text-on-surface-variant tracking-[0.15em] mb-2">Avg Days Left</p>
          <p className="text-[2.2rem] font-bold text-on-surface leading-none">
            {contracts.length > 0 ? Math.round(contracts.reduce((s, c) => s + Math.max(0, Math.ceil((new Date(c.bid_closing_date).getTime() - Date.now()) / 86400000)), 0) / contracts.length) : "\u2014"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div>
          <p className="text-label-sm text-on-surface font-bold mb-2 tracking-[0.05em]">Time Window</p>
          <div className="flex gap-0">
            {[30, 60, 90, 180, 365].map((d) => (
              <button key={d} onClick={() => setDays(d)} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors rounded-sm ${days === d ? "command-gradient text-on-primary" : "bg-white text-on-surface-variant hover:text-primary"}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-label-sm text-on-surface font-bold mb-2 tracking-[0.05em]">City</p>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="bg-white text-sm text-on-surface px-3 py-2 rounded-sm outline-none focus:ring-1 focus:ring-primary">
            <option value="">All Cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-sm">
        <table className="w-full text-left">
          <thead><tr className="bg-surface-low/50">
            {["Urgency", "Bid Name", "City", "Closing Date", "Days Left", "Status", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 text-label-sm font-bold text-on-surface-variant tracking-widest">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-on-surface-variant text-sm">Loading...</td></tr>
            : contracts.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-on-surface-variant text-sm">No expiring contracts found.</td></tr>
            : contracts.map((c, i) => {
              const daysLeft = Math.max(0, Math.ceil((new Date(c.bid_closing_date).getTime() - Date.now()) / 86400000));
              const urgency = daysLeft <= 14 ? "critical" : daysLeft <= 30 ? "high" : daysLeft <= 60 ? "medium" : "low";
              const urgencyColors: Record<string, string> = { critical: "bg-red-500", high: "bg-orange-400", medium: "bg-primary-fixed-dim", low: "bg-primary-fixed" };
              return (
                <tr key={i} className={`hover:bg-surface-low/30 transition-colors ${i % 2 === 1 ? "bg-surface-low/20" : ""}`}>
                  <td className="px-4 py-4"><div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full ${urgencyColors[urgency]}`} /><span className="text-xs font-bold uppercase text-on-surface-variant">{urgency}</span></div></td>
                  <td className="px-4 py-4 text-sm font-medium text-on-surface max-w-xs line-clamp-2">{c.bid_name}</td>
                  <td className="px-4 py-4 text-sm text-on-surface">{c.city}</td>
                  <td className="px-4 py-4 text-sm text-on-surface">{c.bid_closing_date}</td>
                  <td className="px-4 py-4"><span className={`text-sm font-bold ${daysLeft <= 30 ? "text-primary" : "text-on-surface"}`}>{daysLeft}d</span></td>
                  <td className="px-4 py-4"><Badge variant={c.bid_status.toLowerCase().includes("open") ? "active" : "muted"}>{c.bid_status}</Badge></td>
                  <td className="px-4 py-4"><a href={c.bid_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary">View &#x2197;</a></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
