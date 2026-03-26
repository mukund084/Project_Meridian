interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between mb-10">
      <div>
        <h1 className="text-headline-md text-on-primary-fixed">{title}</h1>
        {subtitle && (
          <p className="text-on-surface-variant text-body-md mt-1">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex gap-3">{children}</div>}
    </div>
  );
}
