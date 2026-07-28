import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 rounded-3xl">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-800 light:bg-slate-300 rounded-xl" />
          <div className="h-4 w-64 bg-slate-800/60 light:bg-slate-200 rounded-xl" />
        </div>
        <div className="h-10 w-36 bg-slate-800 light:bg-slate-300 rounded-2xl" />
      </div>

      {/* Metrics Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-slate-800 light:bg-slate-300 rounded-lg" />
              <div className="w-10 h-10 rounded-2xl bg-slate-800 light:bg-slate-300" />
            </div>
            <div className="h-8 w-20 bg-slate-800 light:bg-slate-300 rounded-xl" />
          </div>
        ))}
      </div>

      {/* Content Table Skeleton */}
      <div className="glass-card rounded-3xl overflow-hidden p-6 space-y-4">
        <div className="h-6 w-40 bg-slate-800 light:bg-slate-300 rounded-xl mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="h-12 w-full bg-slate-900/60 light:bg-slate-200/80 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
