interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "active" | "pending" | "muted";
}

const VARIANTS = {
  default: "bg-surface-high text-on-surface border border-surface-high",
  active: "bg-primary/15 text-primary border border-primary/25",
  pending: "bg-secondary-container text-on-secondary-fixed border border-secondary-container",
  muted: "bg-on-surface/[0.06] text-on-surface/70 border border-on-surface/10",
};

// Content-aware color map — each label gets a unique color
const CONTENT_COLORS: Record<string, string> = {
  // Source types
  agenda:        "bg-amber-100 text-amber-800 border border-amber-300",
  minutes:       "bg-sky-100 text-sky-800 border border-sky-300",
  bid_document:  "bg-violet-100 text-violet-800 border border-violet-300",

  // Signal categories
  timing:                "bg-blue-100 text-blue-800 border border-blue-300",
  budget:                "bg-emerald-100 text-emerald-800 border border-emerald-300",
  scope:                 "bg-purple-100 text-purple-800 border border-purple-300",
  "policy & regulatory": "bg-rose-100 text-rose-800 border border-rose-300",
  "policy_regulatory":   "bg-rose-100 text-rose-800 border border-rose-300",
  "decision maker":      "bg-indigo-100 text-indigo-800 border border-indigo-300",
  "decision_maker":      "bg-indigo-100 text-indigo-800 border border-indigo-300",
  geographic:            "bg-teal-100 text-teal-800 border border-teal-300",
  engagement:            "bg-pink-100 text-pink-800 border border-pink-300",
  infrastructure:        "bg-orange-100 text-orange-800 border border-orange-300",
  lifecycle:             "bg-cyan-100 text-cyan-800 border border-cyan-300",
  "incumbent / competitor": "bg-slate-200 text-slate-800 border border-slate-400",
  "incumbent_competitor":   "bg-slate-200 text-slate-800 border border-slate-400",
  risk:                  "bg-red-100 text-red-800 border border-red-300",
  political:             "bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300",
  environmental:         "bg-lime-100 text-lime-800 border border-lime-300",
  workforce:             "bg-yellow-100 text-yellow-800 border border-yellow-300",
  technology:            "bg-sky-100 text-sky-800 border border-sky-300",
  "contract structure":  "bg-stone-200 text-stone-800 border border-stone-400",
  "contract_structure":  "bg-stone-200 text-stone-800 border border-stone-400",

  // Procurement stages
  "rfp imminent":            "bg-red-200 text-red-900 border border-red-400",
  "rfp published":           "bg-orange-200 text-orange-900 border border-orange-400",
  "needs identified":        "bg-sky-100 text-sky-700 border border-sky-300",
  "study authorized":        "bg-indigo-100 text-indigo-700 border border-indigo-300",
  "budget allocated":        "bg-emerald-200 text-emerald-900 border border-emerald-400",
  "market research":         "bg-violet-100 text-violet-700 border border-violet-300",
  "specification development": "bg-amber-200 text-amber-900 border border-amber-400",
  "evaluation in progress":  "bg-blue-200 text-blue-900 border border-blue-400",
  shortlisted:               "bg-cyan-200 text-cyan-900 border border-cyan-400",
  negotiation:               "bg-pink-200 text-pink-900 border border-pink-400",
  awarded:                   "bg-indigo-200 text-indigo-900 border border-indigo-400",
  "contract execution":      "bg-teal-200 text-teal-900 border border-teal-400",
  "in progress":             "bg-blue-100 text-blue-800 border border-blue-300",
  closeout:                  "bg-stone-200 text-stone-800 border border-stone-400",

  // Bid statuses
  open:    "bg-emerald-100 text-emerald-800 border border-emerald-300",
  closed:  "bg-red-100 text-red-800 border border-red-300",

  // Bid types
  rft:     "bg-blue-100 text-blue-800 border border-blue-300",
  rfq:     "bg-violet-100 text-violet-800 border border-violet-300",
  rfp:     "bg-orange-100 text-orange-800 border border-orange-300",
  rfsq:    "bg-teal-100 text-teal-800 border border-teal-300",
  tender:  "bg-amber-100 text-amber-800 border border-amber-300",

  // Document types (meetings)
  "meeting minutes": "bg-sky-100 text-sky-800 border border-sky-300",
};

function getContentColor(text: string): string | null {
  const normalized = text.toLowerCase().trim();
  // Direct match
  if (CONTENT_COLORS[normalized]) return CONTENT_COLORS[normalized];
  // Partial match (e.g. "RFQ (Request for Quotation)" should match "rfq")
  for (const [key, val] of Object.entries(CONTENT_COLORS)) {
    if (normalized.startsWith(key) || normalized.includes(key)) return val;
  }
  return null;
}

export function Badge({ children, variant = "default" }: BadgeProps) {
  const text = typeof children === "string" ? children : "";
  const contentColor = getContentColor(text);
  const classes = contentColor || VARIANTS[variant];

  return (
    <span className={`inline-block px-3 py-1 text-[0.65rem] font-bold uppercase tracking-widest rounded-[3px] ${classes}`}>
      {children}
    </span>
  );
}
