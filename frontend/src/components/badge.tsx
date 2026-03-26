interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "active" | "pending" | "muted";
}

const VARIANTS = {
  default: "bg-surface-high text-on-surface",
  active: "bg-primary-fixed text-on-primary-fixed",
  pending: "bg-secondary-container text-on-secondary-fixed",
  muted: "bg-surface-low text-on-surface-variant",
};

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span className={`inline-block px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide rounded-[2px] ${VARIANTS[variant]}`}>
      {children}
    </span>
  );
}
