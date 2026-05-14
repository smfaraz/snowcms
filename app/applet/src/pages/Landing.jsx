import React, { useState, useEffect } from 'react';
import { ArrowRight, BrainCircuit, BugIcon, ShieldAlert, Server } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';

export default function Landing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      // If user is already logged in, maybe we don't automatically redirect,
      // but if they click "Go to App", we can route them.
    });
    return unsub;
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      if (!auth.currentUser) {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
      navigate('/app');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-1 font-sans selection:bg-primary-glow overflow-x-hidden relative">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#ec4899]/5 rounded-full blur-[120px] pointer-events-none translate-y-1/2 -translate-x-1/3"></div>

      <nav className="px-8 py-6 flex items-center justify-between relative z-10 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 border border-glass-border px-4 py-2 rounded-full glass bg-black/20">
          <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary-glow)]"></div>
          <span className="text-lg font-medium tracking-wide text-text-h">SNOW Analytics</span>
        </div>
        <div>
          <button onClick={handleLogin} disabled={loading} className="btn-secondary px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:bg-glass-surface flex items-center gap-2">
            {auth.currentUser ? 'Go to App' : 'Sign In'} {loading && <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full ml-2"></span>}
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 relative z-10 pt-20 pb-32">
        <div className="text-center max-w-4xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold tracking-widest uppercase mb-8 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
            <BrainCircuit size={14} /> Powered by Gemini AI
          </div>
          <h1 className="text-5xl md:text-7xl font-light tracking-tight text-text-h mb-8 leading-tight">
            Stop Guessing. <br /> <span className="font-medium text-transparent bg-clip-text bg-gradient-to-r from-primary via-[#ec4899] to-[#f59e0b]">Start Scanning.</span>
          </h1>
          <p className="text-xl text-text-2 font-light leading-relaxed mb-12 max-w-2xl mx-auto">
            Deep-scan your ServiceNow instance for logic conflicts, overlapping business rules, and hidden technical debt before they break production.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
             <button onClick={handleLogin} disabled={loading} className="btn-primary px-8 py-4 rounded-full text-lg font-medium flex items-center gap-3 w-full sm:w-auto justify-center shadow-[0_0_30px_rgba(139,92,246,0.3)]">
               Get Started for Free <ArrowRight size={20} />
             </button>
             <button onClick={() => document.getElementById('features').scrollIntoView({behavior: 'smooth'})} className="btn-secondary px-8 py-4 rounded-full text-lg font-medium w-full sm:w-auto justify-center">
               View Features
             </button>
          </div>
          {error && <p className="text-danger mt-4 text-sm bg-danger-bg p-3 border border-danger/30 rounded-xl inline-block">{error}</p>}
        </div>

        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-20 border-t border-glass-border relative">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
           <div className="glass p-10 rounded-3xl border border-glass-border hover:-translate-y-2 transition-transform duration-300 bg-black/20 relative overflow-hidden group">
             <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
             <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary mb-6 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
               <BugIcon size={28} />
             </div>
             <h3 className="text-2xl font-medium text-text-h mb-4">Conflict Resolution</h3>
             <p className="text-text-2 leading-relaxed font-light">Static analysis automatically detects overlapping Business Rules and Client Scripts that cause silent failures.</p>
           </div>
           
           <div className="glass p-10 rounded-3xl border border-glass-border hover:-translate-y-2 transition-transform duration-300 bg-black/20 relative overflow-hidden group">
             <div className="absolute inset-0 bg-[#ec4899]/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
             <div className="w-14 h-14 rounded-2xl bg-[#ec4899]/20 flex items-center justify-center text-[#ec4899] mb-6 shadow-[0_0_20px_rgba(236,72,153,0.2)]">
               <BrainCircuit size={28} />
             </div>
             <h3 className="text-2xl font-medium text-text-h mb-4">AI Logic Probes</h3>
             <p className="text-text-2 leading-relaxed font-light">Uses Google's Gemini AI to deeply analyze code execution flow across multiple tables and rules simultaneously.</p>
           </div>
           
           <div className="glass p-10 rounded-3xl border border-glass-border hover:-translate-y-2 transition-transform duration-300 bg-black/20 relative overflow-hidden group">
             <div className="absolute inset-0 bg-[#34d399]/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
             <div className="w-14 h-14 rounded-2xl bg-[#34d399]/20 flex items-center justify-center text-[#34d399] mb-6 shadow-[0_0_20px_rgba(52,211,153,0.2)]">
               <ShieldAlert size={28} />
             </div>
             <h3 className="text-2xl font-medium text-text-h mb-4">Audit &amp; Compliance</h3>
             <p className="text-text-2 leading-relaxed font-light">Maintain a complete historical record of instance health and tech debt to ensure your ServiceNow deployment scales.</p>
           </div>
        </div>
      </main>
    </div>
  );
}
