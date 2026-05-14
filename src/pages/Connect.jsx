import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Lock, User, Loader2 } from 'lucide-react';

export default function Connect() {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleConnect = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
      
      const req = await fetch('/api/analysis/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formattedUrl, username, password })
      });
      const res = await req.json();

      if (!req.ok || !res.success) {
        throw new Error(res.error || 'Failed to connect with instance');
      }

      const config = { url: formattedUrl, username, password };
      localStorage.setItem('snow_config', JSON.stringify(config));

      navigate('/app/scan');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-md relative z-10 glass-card rounded-[24px] p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-light tracking-tight mb-2 text-text-h">Connect Instance</h2>
          <p className="text-text-2 text-sm max-w-sm mx-auto">Link your ServiceNow instance to begin AI-powered deep scanning.</p>
        </div>

        <div className="relative">
             <form onSubmit={handleConnect} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-widest font-semibold text-text-2">Instance URL</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-3 group-focus-within:text-primary transition-colors">
                    <Server size={14} />
                  </div>
                  <input 
                    type="url" 
                    required
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://dev12345.service-now.com"
                    className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-sm font-mono text-text-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-widest font-semibold text-text-2">Username</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-3 group-focus-within:text-primary transition-colors">
                    <User size={14} />
                  </div>
                  <input 
                    type="text" 
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-sm font-mono text-text-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] uppercase tracking-widest font-semibold text-text-2">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-3 group-focus-within:text-primary transition-colors">
                    <Lock size={14} />
                  </div>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-sm font-mono text-text-1"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-danger-bg border border-[rgba(239,68,68,0.3)] text-[#f87171] text-sm font-medium flex items-start gap-2 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
                  <span className="text-lg leading-none shrink-0">!</span>
                  <span>{error}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 btn-primary py-3 rounded-xl text-sm font-semibold mt-6"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Connect Instance'}
              </button>
            </form>
        </div>
      </div>
    </div>
  );
}
