import type React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  to?: string;
}

export interface PageHeaderProps {
  /** Caption eyebrow above the title, e.g. "VENUES". */
  eyebrow?: string;
  /** The page's one serif element (§4.5, §11.2). */
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned actions; at most one primary (§9.1). */
  actions?: React.ReactNode;
  breadcrumbs?: Crumb[];
  /** Content beside the title, e.g. a status badge. */
  meta?: React.ReactNode;
}

/** The eyebrow + serif title + actions block shared by the organizer pages. */
export const PageHeader: React.FC<PageHeaderProps> = ({ eyebrow, title, description, actions, breadcrumbs, meta }) => (
  <header className="flex flex-col gap-3">
    {breadcrumbs && breadcrumbs.length > 0 && (
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center flex-wrap gap-1 text-[13px] text-[var(--ink-muted)]">
          {breadcrumbs.map((c, i) => (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
              {c.to ? (
                <Link to={c.to} className="link-underline hover:text-[var(--ink-secondary)] truncate">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-[var(--ink-secondary)] truncate">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    )}

    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div className="flex flex-col gap-1 min-w-0">
        {eyebrow && <span className="text-caption text-[var(--ink-muted)]">{eyebrow}</span>}
        <div className="flex items-center flex-wrap gap-3">
          <h1 className="font-display text-[28px] leading-[34px] md:text-[36px] md:leading-[42px] text-[var(--ink)] break-words min-w-0">
            {title}
          </h1>
          {meta}
        </div>
        {description && <div className="text-[15px] leading-6 text-[var(--ink-secondary)] mt-1">{description}</div>}
      </div>
      {actions && <div className="flex items-center flex-wrap gap-2 shrink-0">{actions}</div>}
    </div>
  </header>
);
