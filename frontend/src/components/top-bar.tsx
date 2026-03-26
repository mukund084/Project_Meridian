"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { globalSearch, type SearchResult } from "@/lib/api";

export function TopBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSearch(val: string) {
    setQuery(val);
    if (val.length < 2) { setResults([]); setOpen(false); return; }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setLoading(true);
      globalSearch(val)
        .then((r) => { setResults(r); setOpen(true); })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
  }

  const typeIcons: Record<string, string> = { bid: "B", signal: "S", meeting: "M" };
  const typeColors: Record<string, string> = {
    bid: "bg-primary-fixed text-on-primary-fixed",
    signal: "bg-primary text-on-primary",
    meeting: "bg-secondary-container text-on-secondary-fixed",
  };

  return (
    <header className="h-14 bg-white flex items-center px-6 gap-4 shrink-0">
      {/* Search */}
      <div ref={ref} className="relative flex-1 max-w-2xl">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="text-outline shrink-0">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search bids, signals, meetings..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            className="w-full bg-transparent text-sm text-on-surface placeholder:text-outline/50 outline-none py-2"
          />
          {loading && <span className="text-xs text-outline animate-pulse">...</span>}
        </div>

        {/* Dropdown */}
        {open && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white shadow-[0px_20px_40px_rgba(11,28,48,0.06)] z-50 max-h-80 overflow-y-auto">
            {results.map((r, i) => (
              <a
                key={i}
                href={r.url}
                target={r.type === "bid" || r.type === "meeting" ? "_blank" : undefined}
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-surface-low transition-colors"
              >
                <span className={`w-6 h-6 flex items-center justify-center text-[0.6rem] font-bold rounded-sm ${typeColors[r.type]}`}>
                  {typeIcons[r.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface font-medium truncate">{r.title}</p>
                  <p className="text-xs text-on-surface-variant">{r.city} {r.meta && `\u2014 ${r.meta}`}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4 ml-auto">
        <button className="relative text-outline hover:text-primary transition-colors">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2a5 5 0 0 0-5 5v3l-1.5 2h13L15 10V7a5 5 0 0 0-5-5zM8.5 17a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <button className="text-outline hover:text-primary transition-colors">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 1v2M10 17v2M1 10h2M17 10h2M3.5 3.5l1.4 1.4M15.1 15.1l1.4 1.4M16.5 3.5l-1.4 1.4M4.9 15.1l-1.4 1.4" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <div className="w-8 h-8 command-gradient flex items-center justify-center rounded-sm">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="5.5" r="3" stroke="white" strokeWidth="1.5" />
            <path d="M2 14.5c0-3 2.5-5 6-5s6 2 6 5" stroke="white" strokeWidth="1.5" />
          </svg>
        </div>
      </div>
    </header>
  );
}
