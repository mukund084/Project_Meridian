"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: DashboardIcon },
  { href: "/signals", label: "Signals Explorer", icon: SignalsIcon },
  { href: "/bids", label: "Bids Explorer", icon: BidsIcon },
  { href: "/meetings", label: "Meeting\nIntelligence", icon: MeetingsIcon },
  { href: "/accounts", label: "Accounts", icon: AccountsIcon },
];

const BOTTOM_ITEMS = [
  { href: "#", label: "Help Center", icon: HelpIcon },
  { href: "#", label: "Log Out", icon: LogOutIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[250px] h-full bg-surface-low flex flex-col shrink-0">
      {/* Brand */}
      <div className="px-6 pt-6 pb-8">
        <h1 className="text-[1.75rem] font-extrabold tracking-tight text-primary leading-none">
          Meridian
        </h1>
        <p className="text-[0.65rem] uppercase tracking-[0.25em] text-primary-container font-bold mt-2 leading-relaxed">
          Canadian Procurement<br />Intelligence
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
                  : "text-on-surface-variant hover:text-primary hover:bg-surface-low"
                }
              `}
            >
              <item.icon active={active} />
              <span className="whitespace-pre-line leading-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="hidden px-4 pb-6 space-y-0.5">
        {BOTTOM_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 px-3 py-2.5 text-[0.82rem] text-on-surface-variant hover:text-primary transition-colors"
          >
            <item.icon active={false} />
            {item.label}
          </Link>
        ))}
      </div>
    </aside>
  );
}

// ── Icons (green theme) ──

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

function ContractsIcon({ active }: { active: boolean }) {
  const c = active ? "#a04100" : "#8a8a80";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke={c} strokeWidth="1.5" />
      <path d="M10 6v4l3 2" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocsIcon({ active }: { active: boolean }) {
  const c = active ? "#a04100" : "#8a8a80";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M5 2h7l5 5v11H5V2z" stroke={c} strokeWidth="1.5" />
      <path d="M12 2v5h5" stroke={c} strokeWidth="1.5" />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  const c = active ? "#a04100" : "#8a8a80";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3" stroke={c} strokeWidth="1.5" />
      <path d="M10 1v2M10 17v2M1 10h2M17 10h2M3.5 3.5l1.4 1.4M15.1 15.1l1.4 1.4M16.5 3.5l-1.4 1.4M4.9 15.1l-1.4 1.4" stroke={c} strokeWidth="1.5" />
    </svg>
  );
}

function HelpIcon({ active }: { active: boolean }) {
  const c = active ? "#a04100" : "#8a8a80";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke={c} strokeWidth="1.5" />
      <path d="M7.5 7.5a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2 2-2 3.5M10 15.5v.01" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LogOutIcon({ active }: { active: boolean }) {
  const c = active ? "#a04100" : "#8a8a80";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M7 2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7" stroke={c} strokeWidth="1.5" />
      <path d="M11 10H2M5 7l-3 3 3 3" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
