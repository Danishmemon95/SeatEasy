import type React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Pagination as PaginationMeta } from '../../types/catalog.types';
import { Button } from './Button';

export interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  /** Plural noun for the total, e.g. "venues". */
  noun: string;
}

/** "Page 2 of 5 · 43 venues" with previous / next. Hidden when everything fits on one page. */
export const Pagination: React.FC<PaginationProps> = ({ pagination, onPageChange, noun }) => {
  const { page, totalPages, total } = pagination;
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 pt-4">
      <span className="text-[13px] text-[var(--ink-muted)] tabular-nums">
        Page {page} of {totalPages} · {total} {noun}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          leftIcon={<ChevronLeft className="w-4 h-4" />}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          rightIcon={<ChevronRight className="w-4 h-4" />}
        >
          Next
        </Button>
      </div>
    </nav>
  );
};
