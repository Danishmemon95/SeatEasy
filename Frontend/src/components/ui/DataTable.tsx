import type React from 'react';
import { Skeleton } from './Skeleton';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Numeric columns are right-aligned with tabular figures (§9.4). */
  align?: 'left' | 'right';
  /** Extra classes for the desktop cell, e.g. a width or truncation. */
  className?: string;
  /** Leave the column out of the stacked mobile card (e.g. the title already leads the card). */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  /** Makes rows clickable and keyboard-activatable (Enter), e.g. to open the detail page. */
  onRowClick?: (row: T) => void;
  /** Label for a row's click action, read by screen readers: `Open ${label}`. */
  getRowLabel?: (row: T) => string;
  isLoading?: boolean;
  skeletonRows?: number;
  /** Rendered in place of the rows when there are none. */
  empty?: React.ReactNode;
}

/**
 * §9.4 dashboard table: sunken caption header, 48px rows, hairline dividers,
 * paper-sunken hover, no zebra striping. Under `md` each row becomes a card
 * with caption labels, so the page never scrolls sideways.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  getRowLabel,
  isLoading = false,
  skeletonRows = 5,
  empty,
}: DataTableProps<T>) {
  const interactive = Boolean(onRowClick);
  const rowProps = (row: T) =>
    interactive
      ? {
          onClick: () => onRowClick!(row),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') onRowClick!(row);
          },
          tabIndex: 0,
          role: 'link' as const,
          'aria-label': getRowLabel ? `Open ${getRowLabel(row)}` : undefined,
        }
      : {};

  const alignClass = (c: DataTableColumn<T>) => (c.align === 'right' ? 'text-right tabular-nums' : 'text-left');
  const rowInteractiveClass = interactive
    ? 'cursor-pointer transition-colors duration-[150ms] hover:bg-[var(--paper-sunken)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:-outline-offset-2'
    : '';

  if (!isLoading && rows.length === 0 && empty) {
    return <div className="bg-[var(--paper-raised)] border border-[var(--rule)] rounded-[10px]">{empty}</div>;
  }

  return (
    <div className="bg-[var(--paper-raised)] border border-[var(--rule)] rounded-[10px] overflow-hidden">
      {/* Desktop table */}
      <table className="hidden md:table w-full border-collapse text-sm">
        <thead className="bg-[var(--paper-sunken)]">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`text-caption text-[var(--ink-muted)] font-medium px-4 h-10 border-b border-[var(--rule)] ${alignClass(c)}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: skeletonRows }, (_, i) => (
                <tr key={i} className="border-b border-[var(--rule)] last:border-b-0">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 h-12">
                      <Skeleton className={`h-3.5 ${c.align === 'right' ? 'w-12 ml-auto' : 'w-3/4'}`} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={getRowKey(row)}
                  {...rowProps(row)}
                  className={`border-b border-[var(--rule)] last:border-b-0 ${rowInteractiveClass}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 h-12 text-[var(--ink-secondary)] ${alignClass(c)} ${c.className ?? ''}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>

      {/* Mobile stacked cards */}
      <ul className="md:hidden divide-y divide-[var(--rule)]">
        {isLoading
          ? Array.from({ length: skeletonRows }, (_, i) => (
              <li key={i} className="p-4 flex flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </li>
            ))
          : rows.map((row) => (
              <li key={getRowKey(row)} {...rowProps(row)} className={`p-4 flex flex-col gap-1.5 ${rowInteractiveClass}`}>
                {columns
                  .filter((c) => !c.hideOnMobile)
                  .map((c, i) =>
                    i === 0 ? (
                      <div key={c.key} className="text-[15px] font-medium text-[var(--ink)]">
                        {c.render(row)}
                      </div>
                    ) : (
                      <div key={c.key} className="flex items-baseline justify-between gap-4 text-[13px]">
                        <span className="text-caption text-[var(--ink-muted)] shrink-0">{c.header}</span>
                        <span className={`text-[var(--ink-secondary)] text-right min-w-0 ${c.align === 'right' ? 'tabular-nums' : ''}`}>
                          {c.render(row)}
                        </span>
                      </div>
                    ),
                  )}
              </li>
            ))}
      </ul>
    </div>
  );
}
