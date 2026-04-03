'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

export default function Pagination({ page, totalPages, total, perPage, onPageChange, onPerPageChange }: PaginationProps) {
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-muted tabular-nums">
          {start}–{end} of {total}
        </span>
        <select
          value={perPage}
          onChange={e => onPerPageChange(Number(e.target.value))}
          className="bg-surface-elevated border border-border rounded-md text-sm text-text-secondary px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/50"
        >
          {[5, 10, 20, 50].map(n => (
            <option key={`per-page-${n}`} value={n}>{n} / page</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-text-muted text-sm">…</span>
          ) : (
            <button
              key={`page-${p}`}
              onClick={() => onPageChange(p as number)}
              className={`w-8 h-8 rounded-md text-sm transition-colors ${page === p ? 'bg-accent text-background font-semibold' : 'text-text-secondary hover:bg-surface-elevated'}`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}