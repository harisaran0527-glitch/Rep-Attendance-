export default function StudentLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-pulse p-4 sm:p-8">
      {/* Student Profile Header Skeleton */}
      <div className="glass-card p-8 rounded-3xl space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/20" />
          <div className="space-y-2">
            <div className="h-6 w-48 bg-slate-800 light:bg-slate-300 rounded-xl" />
            <div className="h-4 w-32 bg-slate-800/60 light:bg-slate-200 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Main Percentage Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 glass-card p-8 rounded-3xl space-y-4">
          <div className="h-4 w-36 bg-slate-800 light:bg-slate-300 rounded-lg" />
          <div className="h-16 w-32 bg-slate-800 light:bg-slate-300 rounded-2xl" />
          <div className="h-4 w-full bg-slate-800/50 light:bg-slate-200 rounded-lg" />
        </div>
        <div className="glass-card p-8 rounded-3xl space-y-4">
          <div className="h-4 w-28 bg-slate-800 light:bg-slate-300 rounded-lg" />
          <div className="h-10 w-24 bg-slate-800 light:bg-slate-300 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
