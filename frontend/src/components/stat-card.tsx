interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: boolean;
}

export function StatCard({ label, value, subtitle, accent }: StatCardProps) {
  return (
    <div className="bg-surface-lowest p-6">
      <p className="text-on-surface-variant text-xs uppercase tracking-widest mb-2">
        {label}
      </p>
      <p className={`text-display-lg ${accent ? "text-primary" : "text-on-surface"}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-on-surface-variant text-body-md mt-1">{subtitle}</p>
      )}
    </div>
  );
}
