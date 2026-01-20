import React from 'react';

interface SkeletonLoaderProps {
  width?: string;
  height?: string;
  className?: string;
  borderRadius?: string;
}

// Base Skeleton Component
const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = '20px',
  className = '',
  borderRadius = '0.75rem'
}) => {
  return (
    <div
      className={`animate-skeleton bg-slate-200 dark:bg-slate-700 ${className}`}
      style={{ width, height, borderRadius }}
      role="status"
      aria-label="Cargando..."
    />
  );
};

// Card Skeleton - For dashboard module cards
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 ${className}`}>
    {/* Icon placeholder */}
    <div className="w-16 h-16 rounded-2xl animate-skeleton bg-slate-200 dark:bg-slate-700 mb-6" />

    {/* Title */}
    <div className="h-7 w-3/4 animate-skeleton bg-slate-200 dark:bg-slate-700 rounded-lg mb-2" />

    {/* Subtitle */}
    <div className="h-4 w-1/2 animate-skeleton bg-slate-200 dark:bg-slate-700 rounded-lg mb-4" />

    {/* Description lines */}
    <div className="space-y-2 mb-6">
      <div className="h-4 w-full animate-skeleton bg-slate-200 dark:bg-slate-700 rounded" />
      <div className="h-4 w-5/6 animate-skeleton bg-slate-200 dark:bg-slate-700 rounded" />
    </div>

    {/* Footer */}
    <div className="flex justify-between items-center pt-6 border-t border-slate-100 dark:border-slate-700/50">
      <div className="h-6 w-24 animate-skeleton bg-slate-200 dark:bg-slate-700 rounded-lg" />
      <div className="h-4 w-4 animate-skeleton bg-slate-200 dark:bg-slate-700 rounded" />
    </div>
  </div>
);

// List Skeleton - For lists of items
export const SkeletonList: React.FC<{ count?: number; className?: string }> = ({ count = 5, className = '' }) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full animate-skeleton bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

        {/* Content */}
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 animate-skeleton bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-1/2 animate-skeleton bg-slate-200 dark:bg-slate-700 rounded" />
        </div>

        {/* Action */}
        <div className="h-8 w-20 animate-skeleton bg-slate-200 dark:bg-slate-700 rounded-lg flex-shrink-0" />
      </div>
    ))}
  </div>
);

// Table Row Skeleton
export const SkeletonTableRow: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
  <tr className="border-b border-slate-100 dark:border-slate-700">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className={`h-4 animate-skeleton bg-slate-200 dark:bg-slate-700 rounded ${i === 0 ? 'w-32' : 'w-20'}`} />
      </td>
    ))}
  </tr>
);

// Table Skeleton
export const SkeletonTable: React.FC<{ rows?: number; columns?: number; className?: string }> = ({
  rows = 5,
  columns = 5,
  className = ''
}) => (
  <div className={`bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 ${className}`}>
    <table className="w-full">
      <thead className="bg-slate-50 dark:bg-slate-900/50">
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} className="px-4 py-3 text-left">
              <div className="h-3 w-20 animate-skeleton bg-slate-300 dark:bg-slate-600 rounded" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonTableRow key={i} columns={columns} />
        ))}
      </tbody>
    </table>
  </div>
);

// Chart Skeleton
export const SkeletonChart: React.FC<{ height?: string; className?: string }> = ({
  height = '300px',
  className = ''
}) => (
  <div
    className={`bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 ${className}`}
    style={{ height }}
  >
    {/* Chart Title */}
    <div className="h-5 w-40 animate-skeleton bg-slate-200 dark:bg-slate-700 rounded mb-4" />

    {/* Chart Area */}
    <div className="flex items-end justify-between gap-2 h-[calc(100%-60px)]">
      {[40, 65, 45, 80, 55, 70, 50, 75, 60, 85].map((h, i) => (
        <div
          key={i}
          className="flex-1 animate-skeleton bg-slate-200 dark:bg-slate-700 rounded-t"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>

    {/* X-axis labels */}
    <div className="flex justify-between mt-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-3 w-8 animate-skeleton bg-slate-200 dark:bg-slate-700 rounded" />
      ))}
    </div>
  </div>
);

// Stats Card Skeleton
export const SkeletonStats: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 ${className}`}>
    <div className="flex items-center justify-between mb-4">
      <div className="h-4 w-24 animate-skeleton bg-slate-200 dark:bg-slate-700 rounded" />
      <div className="w-10 h-10 rounded-lg animate-skeleton bg-slate-200 dark:bg-slate-700" />
    </div>
    <div className="h-8 w-20 animate-skeleton bg-slate-200 dark:bg-slate-700 rounded mb-2" />
    <div className="h-3 w-32 animate-skeleton bg-slate-200 dark:bg-slate-700 rounded" />
  </div>
);

// Dashboard Grid Skeleton
export const SkeletonDashboardGrid: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export default SkeletonLoader;