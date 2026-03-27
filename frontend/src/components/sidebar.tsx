"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/signals", label: "Signals Explorer", icon: SignalsIcon },
  { href: "/bids", label: "Bids Explorer", icon: BidsIcon },
  { href: "/meetings", label: "Meeting Intelligence", icon: MeetingsIcon },
  { href: "/accounts", label: "Accounts", icon: AccountsIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Prevent body scroll when menu is open on mobile
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile hamburger button — fixed top-left */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden w-10 h-10 bg-white shadow-md flex items-center justify-center rounded-sm"
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="#1c1c19" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-50 md:z-auto
        w-[250px] h-full bg-surface-low flex flex-col shrink-0
        transition-transform duration-200 ease-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Close button — mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 md:hidden w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-on-surface"
          aria-label="Close menu"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Brand */}
        <div className="px-6 pt-7 pb-8">
          <h1 className="text-[2.1rem] font-extrabold tracking-tight text-primary leading-none">
            Meridian
          </h1>
          <div className="w-8 h-[3px] bg-primary/40 rounded-full mt-3 mb-2.5" />
          <p className="text-[0.7rem] font-semibold text-on-surface/60 tracking-[0.08em] leading-snug">
            Canadian Procurement<br />Intelligence Platform
          </p>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 px-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 text-[0.82rem] font-medium transition-colors
                  ${active
                    ? "bg-primary-fixed/30 text-primary font-semibold"
                    : "text-on-surface hover:text-primary hover:bg-surface-low"
                  }
                `}
              >
                <item.icon active={active} />
                <span className="leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

// ── Icons ──

function DashboardIcon({ active }: { active: boolean }) {
  const c = active ? "#a04100" : "#8a8a80";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="7" height="7" rx="1" stroke={c} strokeWidth="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1" stroke={c} strokeWidth="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1" stroke={c} strokeWidth="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1" stroke={c} strokeWidth="1.5" />
    </svg>
  );
}

function SignalsIcon({ active }: { active: boolean }) {
  const c = active ? "#a04100" : "#8a8a80";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2v16M6 6v10M2 9v4M14 4v12M18 7v6" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BidsIcon({ active }: { active: boolean }) {
  const c = active ? "#a04100" : "#8a8a80";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M4 2h12v16l-3-2-3 2-3-2-3 2V2z" stroke={c} strokeWidth="1.5" />
      <path d="M7 7h6M7 10h4" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MeetingsIcon({ active }: { active: boolean }) {
  const c = active ? "#a04100" : "#8a8a80";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="7" cy="7" r="3" stroke={c} strokeWidth="1.5" />
      <circle cx="14" cy="9" r="2.5" stroke={c} strokeWidth="1.5" />
      <path d="M1 17c0-3 2.5-5 6-5s6 2 6 5M12 17c0-2 1.5-3.5 4-3.5S20 15 20 17" stroke={c} strokeWidth="1.5" />
    </svg>
  );
}

function AccountsIcon({ active }: { active: boolean }) {
  const c = active ? "#a04100" : "#8a8a80";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4" width="16" height="12" rx="1" stroke={c} strokeWidth="1.5" />
      <path d="M2 8h16" stroke={c} strokeWidth="1.5" />
      <path d="M7 4V2M13 4V2" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
