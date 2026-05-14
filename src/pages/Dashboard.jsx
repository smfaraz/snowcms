import React, { useState, useEffect } from 'react';
import { ArrowRight, ShieldAlert, BarChart3, Clock, PlayCircle, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState({
    health: '100%',
    rulesAnalyzed: 0,
    alerts: 0,
    lastScanDate: 'Never'
  });
  const [loading, setLoading] = useState(true);
  const [hasConfig, setHasConfig] = useState(false);

  useEffect(() => {
    const config = localStorage.getItem('snow_config');
    setHasConfig(!!config);
    setLoading(false);
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto h-full flex flex-col justify-center">
      <header className="mb-12">
        <h1 className="text-4xl font-light tracking-tight mb-4 text-text-h">Instance Overview</h1>
        <p className="text-text-2 text-lg">
          Deep-scan your ServiceNow instance for logic conflicts, overlapping business rules, and hidden technical debt.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          { label: 'System Health', value: stats.health, icon: Activity, color: 'text-[#34d399]' },
          { label: 'Rules Analyzed', value: stats.rulesAnalyzed.toLocaleString(), icon: BarChart3, color: 'text-primary' },
          { label: 'Latest Alerts', value: stats.alerts.toLocaleString(), icon: ShieldAlert, color: stats.alerts > 0 ? 'text-[#f87171]' : 'text-text-3' },
          { label: 'Last Scan', value: stats.lastScanDate, icon: Clock, color: 'text-text-2' }
        ].map((stat, i) => (
          <div key={i} className="glass-card p-6 rounded-2xl group transition-all hover:border-[rgba(255,255,255,0.2)] hover:-translate-y-1">
            <div className="flex justify-between items-start mb-6">
              <span className="text-[11px] font-semibold text-text-2 uppercase tracking-widest">{stat.label}</span>
              <stat.icon className={`w-5 h-5 ${stat.color} transition-colors`} />
            </div>
            <div className="text-3xl font-light text-text-h leading-none">
               {loading ? <div className="h-9 w-16 bg-black/20 rounded animate-pulse"></div> : stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="glass flex items-center justify-between rounded-[24px] p-10 relative overflow-hidden border border-glass-border shadow-soft">
        <div className="absolute inset-0 bg-primary/5 pointer-events-none"></div>
        <div className="relative z-10 max-w-xl">
          {!hasConfig ? (
            <>
              <h2 className="text-2xl font-light mb-4 text-text-h">No Instance Connected</h2>
              <p className="text-text-2 mb-8 leading-relaxed text-sm">
                Connect your ServiceNow instance to begin analyzing business rules, client scripts, and UI policies for logical conflicts and performance issues.
              </p>
              <div className="flex items-center gap-4">
                 <Link 
                   to="/app/connect" 
                   className="inline-flex items-center gap-2 btn-primary px-6 py-3 rounded-xl font-medium text-sm"
                 >
                   Connect Instance <LinkIcon size={18} />
                 </Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-light mb-4 text-text-h">Ready to analyze?</h2>
              <p className="text-text-2 mb-8 leading-relaxed text-sm">
                Run a deep scan against your instance UI Policies, Client Scripts, and Business Rules. We use AI to detect logical loops and conflicting conditions.
              </p>
              <div className="flex items-center gap-4">
                 <Link 
                   to="/app/scan" 
                   className="inline-flex items-center gap-2 btn-primary px-6 py-3 rounded-xl font-medium text-sm"
                 >
                   Start New Scan <PlayCircle size={18} />
                 </Link>
                 <Link 
                   to="/app/history" 
                   className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm text-text-2 hover:bg-glass-surface hover:text-text-1 transition-colors border border-transparent hover:border-glass-border"
                 >
                   View History <ArrowRight size={18} />
                 </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Activity(props) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
