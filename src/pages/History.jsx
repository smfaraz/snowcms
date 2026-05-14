import React from 'react';
import { Search, PlayCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function History() {
  return (
    <div className="flex flex-col h-full relative">
      <header className="px-8 py-6 mb-4 mt-2 flex justify-between items-center sticky top-0 z-10 glass-card">
        <div>
          <h2 className="text-3xl font-light tracking-tight text-text-h">Scan History</h2>
          <p className="text-[11px] text-text-3 uppercase tracking-[0.15em] font-medium mt-2">Past Diagnostics & Audits</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-8 pb-8">
        <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-glass-border rounded-[24px] glass bg-black/10">
          <Search size={40} className="text-text-3 mb-4 opacity-50" />
          <h3 className="text-lg font-light text-text-h mb-2">History Unavailable</h3>
          <p className="text-sm text-text-2 max-w-sm mb-6">Cloud history tracking has been disabled.</p>
          <Link to="/app/scan" className="btn-primary px-6 py-3 rounded-xl font-medium text-sm inline-flex items-center gap-2">
            <PlayCircle size={18} /> Start a New Scan
          </Link>
        </div>
      </div>
    </div>
  );
}
