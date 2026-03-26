"use client";

interface TopBarProps {
  placeholder?: string;
}

export function TopBar({ placeholder = "Search procurement data..." }: TopBarProps) {
  return (
    <header className="h-14 bg-white flex items-center px-6 gap-4 shrink-0 border-b border-surface-low">
      {/* Search */}
      <div className="flex items-center gap-2 flex-1 max-w-2xl">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-outline shrink-0">
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-on-surface placeholder:text-outline/50 outline-none py-2"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Notification bell */}
        <button className="relative text-outline hover:text-slate-deep transition-colors">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2a5 5 0 0 0-5 5v3l-1.5 2h13L15 10V7a5 5 0 0 0-5-5zM8.5 17a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>

        {/* Settings gear */}
        <button className="text-outline hover:text-slate-deep transition-colors">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 1v2M10 17v2M1 10h2M17 10h2M3.5 3.5l1.4 1.4M15.1 15.1l1.4 1.4M16.5 3.5l-1.4 1.4M4.9 15.1l-1.4 1.4" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 bg-slate-deep flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="5.5" r="3" stroke="white" strokeWidth="1.5" />
            <path d="M2 14.5c0-3 2.5-5 6-5s6 2 6 5" stroke="white" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
    </header>
  );
}
