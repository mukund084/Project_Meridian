"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/badge";
import { getPDFDocuments, getCities, type PDFDoc } from "@/lib/api";

const STATUS_VARIANT: Record<string, "gold" | "crimson" | "muted" | "default"> = {
  completed: "gold",
  pending: "muted",
  failed: "crimson",
  analyzing: "default",
  downloading: "default",
  extracting_text: "default",
};

export default function DocumentsPage() {
  const [docs, setDocs] = useState<PDFDoc[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [cityFilter, setCityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCities().then(setCities).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    getPDFDocuments({
      city: cityFilter || undefined,
      status: statusFilter || undefined,
      limit: 100,
    })
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [cityFilter, statusFilter]);

  return (
    <div className="p-8">
      <h1 className="text-[1.5rem] font-bold text-slate-deep mb-6">Documents</h1>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="bg-white text-sm text-slate-deep px-3 py-2.5 border border-surface-high outline-none focus:border-slate-deep transition-colors appearance-none cursor-pointer"
        >
          <option value="">All Cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white text-sm text-slate-deep px-3 py-2.5 border border-surface-high outline-none focus:border-slate-deep transition-colors appearance-none cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="bg-white">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-surface-low">
              <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Status</th>
              <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Source</th>
              <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">City</th>
              <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Type</th>
              <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Pages</th>
              <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest text-outline">Signals</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-outline text-sm">Loading...</td></tr>
            ) : docs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-outline text-sm">No documents found.</td></tr>
            ) : (
              docs.map((d, i) => (
                <tr key={i} className="border-b border-surface-low/50 hover:bg-surface-low/30 transition-colors">
                  <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[d.status] || "muted"}>{d.status.replace(/_/g, " ")}</Badge></td>
                  <td className="px-4 py-3">
                    <a href={d.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:text-primary-container truncate block max-w-xs">
                      {d.source_url.split("/").pop() || d.source_url}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-deep">{d.city}</td>
                  <td className="px-4 py-3 text-xs uppercase tracking-wide text-outline">{d.source_type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-sm text-slate-deep">{d.page_count ?? "\u2014"}</td>
                  <td className="px-4 py-3 text-sm font-bold text-primary">{d.signals_extracted}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
