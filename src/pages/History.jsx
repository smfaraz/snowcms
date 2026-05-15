import React, { useState, useEffect } from 'react';
import { Search, PlayCircle, Clock, CheckCircle, Bug } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function History() {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, conflicts-high, conflicts-low

  useEffect(() => {
    try {
      const stored = localStorage.getItem('snow_history');
      if (stored) {
        setScans(JSON.parse(stored));
      }
    } catch (err) {
      console.warn('Failed to read scan history', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const sortedScans = [...scans].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
    if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    if (sortBy === 'conflicts-high') return b.conflictsCount - a.conflictsCount;
    if (sortBy === 'conflicts-low') return a.conflictsCount - b.conflictsCount;
    return 0;
  });

  return (
    <div className="flex flex-col h-full relative">
      <header className="px-4 md:px-8 py-4 md:py-6 mb-4 mt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sticky top-0 z-10 glass-card backdrop-blur-md">
        <div>
          <h2 className="text-2xl md:text-3xl font-light tracking-tight text-text-h">Scan History</h2>
          <p className="text-[10px] md:text-[11px] text-text-3 uppercase tracking-[0.15em] font-medium mt-1 md:mt-2">Past Diagnostics & Audits</p>
        </div>
        {!loading && scans.length > 0 && (
          <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto border-t md:border-t-0 border-glass-border/30 pt-3 md:pt-0">
            <span className="text-[10px] uppercase tracking-widest text-text-3 font-semibold">Sort By</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs md:text-sm glass-input rounded-xl px-3 md:px-4 py-2 text-text-1 focus:outline-none bg-black/20 border border-glass-border"
            >
              <option value="newest" className="bg-bg text-text-1">Date (Newest First)</option>
              <option value="oldest" className="bg-bg text-text-1">Date (Oldest First)</option>
              <option value="conflicts-high" className="bg-bg text-text-1">Conflicts (Highest First)</option>
              <option value="conflicts-low" className="bg-bg text-text-1">Conflicts (Lowest First)</option>
            </select>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-auto px-4 md:px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
             <div className="animate-pulse text-text-3 font-mono text-xs tracking-widest uppercase">Loading history...</div>
          </div>
        ) : scans.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-glass-border rounded-[24px] glass bg-black/10">
            <Search size={40} className="text-text-3 mb-4 opacity-50" />
            <h3 className="text-lg font-light text-text-h mb-2">No Past Scans</h3>
            <p className="text-sm text-text-2 max-w-sm mb-6">You haven't run any diagnostic scans yet.</p>
            <Link to="/app/scan" className="btn-primary px-6 py-3 rounded-xl font-medium text-sm inline-flex items-center gap-2">
              <PlayCircle size={18} /> Start a Scan
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedScans.map(scan => (
              <div key={scan.id} className="glass border border-glass-border p-4 md:p-6 rounded-[20px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-glass-surface-hover transition-colors">
                <div className="flex items-start md:items-center gap-4 md:gap-6 flex-1 min-w-0">
                  <div className={`w-10 md:w-12 h-10 md:h-12 rounded-xl flex items-center justify-center border shadow-inner shrink-0 ${
                    scan.conflictsCount > 0 ? 'bg-danger-bg text-danger border-[rgba(239,68,68,0.2)]' : 'bg-success-bg text-success border-[rgba(16,185,129,0.2)]'
                  }`}>
                    {scan.conflictsCount > 0 ? <Bug size={20} className="md:w-6 md:h-6" /> : <CheckCircle size={20} className="md:w-6 md:h-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base md:text-lg font-medium text-text-h mb-1 truncate max-w-full">{scan.instanceUrl || 'ServiceNow Instance'}</h4>
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-[11px] font-mono text-text-3">
                      <span className="flex items-center gap-1.5"><Clock size={12} /> {scan.createdAt ? new Date(scan.createdAt).toLocaleDateString() : 'Just now'}</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-black/30 border border-glass-border">{scan.stats?.businessRules || 0} BR</span>
                        <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-black/30 border border-glass-border">{scan.stats?.clientScripts || 0} CS</span>
                        <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-black/30 border border-glass-border">{scan.stats?.uiPolicies || 0} UI</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-glass-border/20 pt-3 sm:pt-0">
                   <span className="sm:hidden text-[10px] uppercase font-bold text-text-3 tracking-widest">Total Conflicts</span>
                   <div className="flex flex-col sm:items-end">
                     <div className="text-xl md:text-2xl font-light font-mono text-text-1 leading-tight">{scan.conflictsCount}</div>
                     <div className="hidden sm:block text-[10px] uppercase font-bold text-text-3 tracking-widest mt-1">Conflicts</div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
