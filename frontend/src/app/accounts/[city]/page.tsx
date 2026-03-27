"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/badge";
import { getAccount, type AccountDetail } from "@/lib/api";

export default function AccountDetailPage() {
  const params = useParams();
  const city = decodeURIComponent(params.city as string);
  const [data, setData] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"signals" | "bids" | "meetings" | "contacts">("signals");

  useEffect(() => {
    getAccount(city).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [city]);

  if (loading) return <div className="p-10 text-on-surface-variant text-sm">Loading account...</div>;
  if (!data) return <div className="p-10 text-on-surface-variant text-sm">Account not found.</div>;

  const s = data.summary;

  return (
    <div className="p-4 md:p-8 pt-16 md:pt-8">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Link href="/accounts" className="text-xs text-on-surface-variant hover:text-primary transition-colors">&larr; Accounts</Link>
      </div>
      <div className="flex items-start justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-[1.5rem] md:text-[2rem] font-bold text-on-surface">{data.city}</h1>
          <p className="text-xs md:text-sm text-on-surface-variant">Municipality Account Profile</p>
        </div>
        <div className="w-12 h-12 md:w-14 md:h-14 command-gradient flex items-center justify-center rounded-sm">
          <span className="text-on-primary font-bold text-base md:text-lg">{(s.avg_score * 100).toFixed(0)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
        {[
          { label: "Bids", value: s.total_bids },
          { label: "Open Bids", value: s.open_bids },
          { label: "Signals", value: s.total_signals },
          { label: "Meetings", value: s.total_meetings },
          { label: "Contacts", value: s.contacts_found },
        ].map((item) => (
          <div key={item.label} className="bg-white p-4 rounded-sm text-center">
            <p className="text-2xl font-bold text-on-surface">{item.value}</p>
            <p className="text-label-sm text-on-surface-variant tracking-wider mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-6 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {(["signals", "bids", "meetings", "contacts"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 md:px-5 py-2.5 text-[0.65rem] md:text-xs font-bold uppercase tracking-wider transition-colors rounded-sm whitespace-nowrap shrink-0 ${
              activeTab === tab ? "command-gradient text-on-primary" : "bg-surface-low text-on-surface-variant hover:text-primary"
            }`}
          >
            {tab} ({tab === "signals" ? s.total_signals : tab === "bids" ? s.total_bids : tab === "meetings" ? s.total_meetings : s.contacts_found})
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-sm overflow-x-auto">
        {activeTab === "signals" && (
          <table className="w-full text-left">
            <thead><tr className="bg-surface-low/50">
              {["Signal", "Category", "Score", "Confidence", "Stage"].map((h) => (
                <th key={h} className="px-4 py-3 text-label-sm font-bold text-on-surface-variant tracking-widest">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.signals.slice(0, 20).map((sig, i) => (
                <tr key={i} className={`hover:bg-surface-low/30 ${i % 2 === 1 ? "bg-surface-low/20" : ""}`}>
                  <td className="px-4 py-3 text-sm text-on-surface max-w-xs">{sig.summary.slice(0, 80)}</td>
                  <td className="px-4 py-3"><Badge variant="active">{sig.signal_category.replace(/_/g, " ")}</Badge></td>
                  <td className="px-4 py-3 text-sm font-bold text-on-surface">{(sig.score * 100).toFixed(0)}</td>
                  <td className="px-4 py-3 text-sm text-on-surface">{(sig.confidence * 100).toFixed(0)}%</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{sig.procurement_stage?.replace(/_/g, " ") || "\u2014"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === "bids" && (
          <table className="w-full text-left">
            <thead><tr className="bg-surface-low/50">
              {["Status", "Bid Name", "Closing Date", "Link"].map((h) => (
                <th key={h} className="px-4 py-3 text-label-sm font-bold text-on-surface-variant tracking-widest">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.bids.slice(0, 20).map((b, i) => (
                <tr key={i} className={`hover:bg-surface-low/30 ${i % 2 === 1 ? "bg-surface-low/20" : ""}`}>
                  <td className="px-4 py-3"><Badge variant={b.bid_status.toLowerCase().includes("open") ? "active" : "muted"}>{b.bid_status}</Badge></td>
                  <td className="px-4 py-3 text-sm text-on-surface max-w-sm line-clamp-2">{b.bid_name}</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{b.bid_closing_date}</td>
                  <td className="px-4 py-3"><a href={b.bid_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary">View &#x2197;</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === "meetings" && (
          <table className="w-full text-left">
            <thead><tr className="bg-surface-low/50">
              {["Title", "Date", "Type", "Document"].map((h) => (
                <th key={h} className="px-4 py-3 text-label-sm font-bold text-on-surface-variant tracking-widest">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {data.meetings.slice(0, 20).map((m, i) => (
                <tr key={i} className={`hover:bg-surface-low/30 ${i % 2 === 1 ? "bg-surface-low/20" : ""}`}>
                  <td className="px-4 py-3 text-sm font-medium text-on-surface">{m.meeting_title}</td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">{m.meeting_date}</td>
                  <td className="px-4 py-3"><Badge variant="muted">{m.document_type}</Badge></td>
                  <td className="px-4 py-3"><a href={m.pdf_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary">View PDF &#x2197;</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === "contacts" && (
          <div className="p-6">
            {data.contacts.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No contacts found for this municipality yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                {data.contacts.map((c, i) => (
                  <div key={i} className="bg-surface-low p-4 rounded-sm flex items-center gap-4">
                    <div className="w-10 h-10 command-gradient flex items-center justify-center rounded-sm shrink-0">
                      <span className="text-on-primary text-sm font-bold">{c.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">{c.name}</p>
                      <p className="text-xs text-primary">{c.contact_email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
