"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/badge";
import { getPDFDocuments, getCities, type PDFDoc } from "@/lib/api";

const SV: Record<string, "active" | "pending" | "muted" | "default"> = { completed: "active", pending: "muted", failed: "pending", analyzing: "default" };

export default function DocumentsPage() {
  const [docs, setDocs] = useState<PDFDoc[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [cityFilter, setCityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { getCities().then(setCities).catch(() => {}); }, []);
  useEffect(() => {
    setLoading(true);
    getPDFDocuments({ city: cityFilter || undefined, status: statusFilter || undefined, limit: 100 })
      .then(setDocs).catch(() => setDocs([])).finally(() => setLoading(false));
  }, [cityFilter, statusFilter]);

  return (
    <div className="p-8">
      <h1 className="text-[1.5rem] font-bold text-on-surface mb-6">Documents</h1>
      <div className="flex gap-4 mb-6">
        <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="bg-white text-sm text-on-surface px-3 py-2.5 rounded-sm outline-none focus:ring-1 focus:ring-primary">
          <option value="">All Cities</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-white text-sm text-on-surface px-3 py-2.5 rounded-sm outline-none focus:ring-1 focus:ring-primary">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      <div className="bg-white rounded-sm">
        <table className="w-full text-left">
          <thead><tr className="bg-surface-low/50">
            {["Status", "Source", "City", "Type", "Pages", "Signals"].map((h) => (
              <th key={h} className="px-4 py-3 text-label-sm font-bold text-on-surface-variant tracking-widest">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="px-4 py-12 text-center text-on-surface-variant text-sm">Loading...</td></tr>
            : docs.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-on-surface-variant text-sm">No documents found.</td></tr>
            : docs.map((d, i) => (
              <tr key={i} className={`hover:bg-surface-low/30 ${i % 2 === 1 ? "bg-surface-low/20" : ""}`}>
                <td className="px-4 py-3"><Badge variant={SV[d.status] || "muted"}>{d.status.replace(/_/g, " ")}</Badge></td>
                <td className="px-4 py-3"><a href={d.source_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:text-primary-container truncate block max-w-xs">{d.source_url.split("/").pop()}</a></td>
                <td className="px-4 py-3 text-sm text-on-surface">{d.city}</td>
                <td className="px-4 py-3 text-xs uppercase tracking-wide text-on-surface-variant">{d.source_type.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-sm text-on-surface">{d.page_count ?? "\u2014"}</td>
                <td className="px-4 py-3 text-sm font-bold text-primary">{d.signals_extracted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
