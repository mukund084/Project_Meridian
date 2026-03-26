"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAccounts, type Account } from "@/lib/api";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAccounts().then(setAccounts).catch(() => []).finally(() => setLoading(false));
  }, []);

  const totalBids = accounts.reduce((s, a) => s + a.total_bids, 0);
  const totalSignals = accounts.reduce((s, a) => s + a.total_signals, 0);

  if (loading) return <div className="p-10 text-on-surface-variant text-sm">Loading accounts...</div>;

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-label-sm text-on-surface-variant mb-1">Account Intelligence</p>
          <h1 className="text-[2rem] font-bold text-on-surface">Canadian Municipalities</h1>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-6 mb-8">
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

      {/* Accounts Grid */}
      <div className="grid grid-cols-3 gap-6">
        {accounts.map((a) => (
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
