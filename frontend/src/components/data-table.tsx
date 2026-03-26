interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
}

export function DataTable<T>({ columns, data, emptyMessage = "No data available" }: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="bg-surface-lowest p-12 text-center">
        <p className="text-on-surface-variant text-body-md">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-lowest overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-surface-low">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant"
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className="transition-colors hover:bg-surface-low"
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-sm text-on-surface">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
