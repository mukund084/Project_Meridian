export function TopBar() {
  return (
    <header className="h-14 bg-surface-lowest flex items-center px-6 gap-4 shrink-0">
      <div className="flex-1" />

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
      </div>
    </header>
  );
}
