import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse bg-surface-elevated rounded-md ${className}`} />;
}

export function TableSkeleton({ rows = 8, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            {Array.from({ length: cols }).map((_, i) => (
              <th key={`th-${i}`} className="px-4 py-3">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={`tr-${i}`}>
              {Array.from({ length: cols }).map((_, j) => (
                <td key={`td-${i}-${j}`} className="px-4 py-3">
                  <Skeleton className={`h-4 ${j === 0 ? 'w-36' : j === cols - 1 ? 'w-16' : 'w-24'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <div className="flex items-start justify-between mb-4">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <Skeleton className="w-16 h-5 rounded-full" />
      </div>
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-4 w-28" />
    </div>
  );
}