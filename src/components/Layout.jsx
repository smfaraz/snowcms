import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Sun, Moon, Activity, LayoutDashboard, Settings as SettingsIcon, Link as LinkIcon, LogOut, Clock } from 'lucide-react';

export default function Layout() {
  const [config, setConfig] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('snow_config');
      if (stored) {
        setConfig(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  };

  const handleDisconnect = () => {
    localStorage.removeItem('snow_config');
    setConfig(null);
    navigate('/');
  };

  const navItems = [
    { label: 'Dashboard', path: '/app', icon: LayoutDashboard },
    { label: 'Scanner', path: '/app/scan', icon: Activity },
    { label: 'History', path: '/app/history', icon: Clock },
    { label: 'Settings', path: '/app/settings', icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen overflow-hidden text-text-1 selection:bg-primary-glow font-sans">
      {/* Sidebar - Liquid Glass feel */}
      <aside className="w-64 glass flex flex-col m-4 mr-2 rounded-2xl overflow-hidden shrink-0">
        <div className="p-6 border-b border-glass-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/app')}>
              <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary-glow)]"></div>
              <h1 className="text-xl font-medium tracking-wide text-text-h">
                SNOW
              </h1>
            </div>
            <button onClick={toggleTheme} className="w-8 h-8 flex items-center justify-center rounded-xl text-text-2 hover:text-text-1 hover:bg-glass-surface-hover border border-transparent hover:border-glass-border transition-all" aria-label="Toggle Theme">
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-glass-surface text-text-h shadow-[0_2px_8px_rgba(0,0,0,0.2)] border border-glass-border' 
                    : 'text-text-2 hover:bg-glass-surface hover:text-text-1 border border-transparent'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-glass-border space-y-3 bg-black/5 dark:bg-black/20">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.1em] text-text-3 font-semibold">Status</span>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider border ${
              config ? 'bg-success-bg text-[#34d399] border-[#10b981]/30' : 'bg-warning-bg text-warning border-warning/30'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${config ? 'bg-[#34d399] shadow-[0_0_8px_#34d399]' : 'bg-warning shadow-[0_0_8px_var(--color-warning)]'}`}></div>
              {config ? 'Connected' : 'Offline'}
            </div>
          </div>
          
          {config ? (
            <button 
              onClick={handleDisconnect}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-glass-border text-xs text-text-2 hover:bg-glass-surface hover:text-text-1 transition-colors"
            >
              <LogOut size={14} /> Disconnect
            </button>
          ) : (
            <Link 
              to="/app/connect"
              className="w-full flex items-center justify-center gap-2 py-2.5 btn-primary rounded-xl text-xs font-medium"
            >
              <span>Connect Instance</span>
              <LinkIcon size={14} />
            </Link>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative p-4 pl-2">
        <Outlet />
      </main>
    </div>
  );
}
