import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Trash2 } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('snow_config');
    if (stored) {
      try {
        setConfig(JSON.parse(stored));
      } catch(e) {}
    }
  }, []);

  const handleClearInstance = () => {
    localStorage.removeItem('snow_config');
    setConfig(null);
  };

  return (
    <div className="flex flex-col h-full relative">
      <header className="px-8 py-6 mb-4 mt-2 sticky top-0 z-10">
        <h2 className="text-3xl font-light tracking-tight text-text-h">Settings</h2>
        <p className="text-[11px] text-text-3 uppercase tracking-[0.15em] font-medium mt-2">Preferences & Connections</p>
      </header>

      <div className="flex-1 overflow-auto px-8 pb-8 space-y-8 max-w-4xl">
        {/* Instance Connection */}
        <section>
          <h3 className="text-sm font-semibold text-text-2 mb-4 uppercase tracking-widest pl-2 border-l-2 border-primary">Active Instance</h3>
          <div className="glass border border-glass-border p-8 rounded-[24px]">
            {config ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-success-bg flex items-center justify-center text-success border border-[rgba(16,185,129,0.3)] shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                    <Server size={24} />
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-text-h">Connected</h4>
                    <p className="text-[11px] text-text-3 uppercase tracking-widest font-mono mt-1">Authenticated to ServiceNow</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-black/5 dark:bg-black/30 border border-glass-border rounded-xl p-4">
                    <span className="block text-[10px] uppercase text-text-3 font-bold tracking-widest mb-1">Instance URL</span>
                    <span className="text-sm font-mono text-text-1">{config.url}</span>
                  </div>
                  <div className="bg-black/5 dark:bg-black/30 border border-glass-border rounded-xl p-4">
                    <span className="block text-[10px] uppercase text-text-3 font-bold tracking-widest mb-1">Username</span>
                    <span className="text-sm font-mono text-text-1">{config.username}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-[rgba(255,255,255,0.08)] flex justify-end">
                  <button 
                    onClick={handleClearInstance}
                    className="flex items-center gap-2 px-4 py-2 text-danger hover:bg-danger-bg rounded-lg text-sm font-medium transition-colors border border-transparent hover:border-[rgba(239,68,68,0.3)]"
                  >
                    <Trash2 size={16} /> Unlink Instance
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Server size={40} className="text-text-3 mb-4 opacity-50" />
                <h4 className="text-lg font-light text-text-h mb-2">No Instance Connected</h4>
                <p className="text-sm text-text-2 mb-6 max-w-sm">Connect a ServiceNow instance to perform diagnostics.</p>
                <button
                  onClick={() => navigate('/app/connect')}
                  className="btn-primary px-6 py-3 rounded-xl text-sm font-medium"
                >
                  Connect Now
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
