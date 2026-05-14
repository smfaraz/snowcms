import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Fingerprint, BugIcon, PlayCircle, Loader2, BrainCircuit, ShieldAlert } from 'lucide-react';

import { GoogleGenAI } from '@google/genai';

export default function Scanner() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [selectedTable, setSelectedTable] = useState('');

  const getConfig = () => {
    try {
      const stored = localStorage.getItem('snow_config');
      if (!stored) return null;
      return JSON.parse(stored);
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!getConfig()) {
      navigate('/app/connect');
    }
  }, [navigate]);

  const runAnalysis = async () => {
    const config = getConfig();
    if (!config) return navigate('/app/connect');

    setLoading(true);
    setError('');
    setData(null);

    try {
      const req = await fetch('/api/analysis/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const res = await req.json();
      
      if (!req.ok) throw new Error(res.error || 'Request failed');
      
      setData(res);
      
      // Auto select first table if exists
      const tables = Array.from(new Set([
        ...Object.keys(res.brByTable || {}),
        ...Object.keys(res.upByTable || {}),
        ...Object.keys(res.csByTable || {})
      ])).sort();
      if (tables.length > 0) setSelectedTable(tables[0]);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const runAILogicProbe = async () => {
    if (!selectedTable || !data) return;
    setAiLoading(true);
    setAiResult('');

    try {
      const context = {
        table: selectedTable,
        businessRules: (data.brByTable[selectedTable] || []).map(r => ({ name: r.name, when: r.when, script: r.script })),
        uiPolicies: (data.upByTable[selectedTable] || []).map(p => ({ desc: p.short_description, conditions: p.conditions, script_true: p.script_true })),
        clientScripts: (data.csByTable[selectedTable] || []).map(s => ({ name: s.name, type: s.type, script: s.script })),
        scriptIncludes: (data.scriptIncludes || []).slice(0, 10).map(i => ({ name: i.name, script: i.script })) 
      };

      const prompt = `Analyze the following ServiceNow components for the table "${selectedTable}". 
Look for LOGIC CONFLICTS, RECURSIVE LOOPS, or RACE CONDITIONS.

DATA:
${JSON.stringify(context, null, 2)}

IMPORTANT: Your output MUST be formatted as polished HTML designed to match a dark modern UI (Tailwind-like structure). DO NOT use markdown code blocks (\`\`\`html), just output raw HTML. No inline styles, prefer using tailwind utility classes.

For each conflict found, generate this precise structure using standard utility classes from the new global theme:
<div class="mb-6 glass border-[rgba(239,68,68,0.3)] border-l-[3px] border-l-[#ef4444] p-6 rounded-[20px] bg-black/20">
  <div class="flex justify-between items-start mb-4">
    <h3 class="font-medium text-lg text-white/[0.9]">[Conflict Name]</h3>
    <span class="text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-full border bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30">[Severity]</span>
  </div>
  <p class="text-sm text-white/[0.65] font-light leading-relaxed mt-2"><strong class="text-white/[0.9]">Dev:</strong> [Tech Detail]</p>
  <p class="text-sm text-white/[0.65] font-light leading-relaxed mt-2"><strong class="text-white/[0.9]">Impact:</strong> [Plain English]</p>
  <div class="mt-5 pt-4 border-t border-[rgba(255,255,255,0.08)]">
    <div class="text-[10px] uppercase font-bold text-white/[0.4] tracking-widest mb-3">Involved Components:</div>
    <ul class="space-y-2">
      <li class="flex gap-3 text-xs font-mono items-center bg-black/20 p-2.5 rounded-lg border border-[rgba(255,255,255,0.08)] text-white/[0.65]">[Component Name]</li>
    </ul>
  </div>
</div>

If no conflicts are found, return <div class="p-6 border border-[rgba(255,255,255,0.08)] glass rounded-[20px] text-sm text-center text-white/[0.4]">No complex logical conflicts found in ${selectedTable}. Excellent job!</div>.`;

      // Initialize Gemini. In Vite/esbuild environments the API key is injected natively.
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "$GEMINI_API_KEY") {
        throw new Error("API_KEY_INVALID");
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: [{ parts: [{ text: prompt }] }]
      });

      const aiOutput = response.text.replace(/^\`\`\`(?:html)?/, '').replace(/\`\`\`$/, '');
      setAiResult(aiOutput);
    } catch (err) {
      console.error(err);
      if (err.message && (err.message.includes('API_KEY_INVALID') || err.message.includes('API key not valid'))) {
        setAiResult(`<div class="text-destructive font-medium p-4 border border-destructive/20 bg-destructive/10 rounded-lg flex flex-col gap-2">
          <strong>AI Analysis Requires a Valid API Key</strong>
          <span class="text-sm text-destructive/80">Please check or select your AI Studio API key in the 'Settings &gt; Secrets' panel.</span>
        </div>`);
      } else {
        setAiResult(`<div class="text-destructive font-medium p-4 border border-destructive/20 bg-destructive/10 rounded-lg">AI Analysis Error: ${err.message}</div>`);
      }
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      <header className="px-8 py-6 mb-4 mt-2 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h2 className="text-3xl font-light tracking-tight text-text-h">System Scanner</h2>
          <p className="text-[11px] text-text-3 uppercase tracking-[0.15em] font-medium mt-2">Rule Conflict Diagnostics</p>
        </div>
        <button 
          onClick={runAnalysis}
          disabled={loading}
          className="flex items-center gap-2 btn-primary px-6 py-3 rounded-xl font-medium text-sm hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <PlayCircle size={18} />}
          {data ? 'Rescan Instance' : 'Execute Diagnostic Scan'}
        </button>
      </header>

      <div className="flex-1 overflow-auto px-8 pb-8 space-y-8">
        {error && (
          <div className="p-4 bg-danger-bg border border-[rgba(239,68,68,0.3)] rounded-xl text-[#f87171] flex gap-3 text-sm font-medium shadow-[0_0_15px_rgba(239,68,68,0.15)]">
            <AlertTriangle size={18} />
            {error}
          </div>
        )}

        {!data && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-glass-border rounded-[24px] glass bg-black/10">
            <ShieldAlert size={40} className="text-text-3 mb-4 opacity-50" />
            <h3 className="text-lg font-light text-text-h mb-2">No Active Scan Data</h3>
            <p className="text-sm text-text-2 max-w-sm">Execute a diagnostic scan to fetch and analyze scripts, UI policies, and business rules from your instance.</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-64 space-y-6">
            <div className="relative">
              <Loader2 className="w-12 h-12 animate-spin text-primary relative z-10" />
              <div className="absolute inset-0 bg-primary-glow blur-xl rounded-full"></div>
            </div>
            <p className="text-[11px] font-mono tracking-widest uppercase text-text-2 animate-pulse">Retrieving payload...</p>
          </div>
        )}

        {data && (
          <>
            {/* Stats Overview Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Business Rules', value: data.stats.businessRules, color: 'text-primary' },
                { label: 'UI Policies', value: data.stats.uiPolicies, color: 'text-[#ec4899]' },
                { label: 'Client Scripts', value: data.stats.clientScripts, color: 'text-[#f59e0b]' },
                { label: 'Conflicts Found', value: data.conflicts.length, color: 'text-[#ef4444]' }
              ].map((stat, i) => (
                <div key={i} className="glass border border-glass-border p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
                  <span className="text-[10px] uppercase tracking-widest text-text-3 font-semibold mb-3">{stat.label}</span>
                  <div className={`text-4xl font-light font-mono ${stat.color} leading-none text-shadow-sm`}>{stat.value}</div>
                  <div className="absolute bottom-0 right-0 w-24 h-24 bg-current opacity-5 rounded-full blur-2xl -mr-4 -mb-4 transition-transform group-hover:scale-150"></div>
                </div>
              ))}
            </div>

            {/* AI Probe Panel */}
            <div className="glass border-glass-border rounded-[24px] overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
              <div className="px-6 py-5 border-b border-glass-border bg-black/20 flex flex-wrap items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.3)]">
                    <BrainCircuit size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-text-h">AI Logic Probe</h3>
                    <p className="text-[11px] text-text-2 uppercase tracking-wide mt-1">Deep dive into a specific table's logic flows via Gemini.</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <select 
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="text-sm glass-input rounded-xl px-4 py-2 text-text-1 font-mono focus:outline-none"
                  >
                    {Array.from(new Set([
                      ...Object.keys(data.brByTable || {}),
                      ...Object.keys(data.upByTable || {}),
                      ...Object.keys(data.csByTable || {})
                    ])).sort().map(t => (
                      <option key={t} value={t} className="bg-bg text-text-1">{t}</option>
                    ))}
                  </select>
                  
                  <button 
                    onClick={runAILogicProbe}
                    disabled={aiLoading || !selectedTable}
                    className="btn-secondary px-5 py-2 rounded-xl text-[11px] font-semibold uppercase tracking-wider disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
                    {aiLoading ? 'Probing...' : 'Run root cause analysis'}
                  </button>
                </div>
              </div>
              
              {aiResult && (
                <div className="p-8 bg-black/40 prose prose-invert max-w-none text-sm relative z-10" dangerouslySetInnerHTML={{ __html: aiResult }}></div>
              )}
            </div>

            {/* Static Conflict List */}
            <div className="space-y-6 mt-10">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-3 border-b border-glass-border pb-4">Static Rule Conflicts</h3>
              
              {data.conflicts.length === 0 ? (
                <div className="p-6 border border-glass-border glass rounded-[20px] text-sm text-text-3 font-mono text-center">
                  No strict structural conflicts detected via static analysis. AI Probe recommended.
                </div>
              ) : (
                <div className="grid gap-6">
                  {data.conflicts.map((c, i) => (
                    <div key={i} className="glass border-l-[3px] p-6 rounded-[20px] hover:bg-glass-surface-hover transition-colors relative overflow-hidden" style={{ borderLeftColor: c.severity === 'High' ? 'var(--color-danger)' : c.severity === 'Medium' ? 'var(--color-warning)' : 'var(--color-primary)' }}>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <BugIcon size={18} className={c.severity === 'High' ? 'text-danger' : c.severity === 'Medium' ? 'text-warning' : 'text-primary'} />
                          <h4 className="text-lg font-medium text-text-1">{c.type}</h4>
                        </div>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-full border ${c.severity === 'High' ? 'bg-danger-bg text-danger border-[rgba(239,68,68,0.3)]' : c.severity === 'Medium' ? 'bg-warning-bg text-warning border-[rgba(245,158,11,0.3)]' : 'bg-[rgba(139,92,246,0.1)] text-primary border-[rgba(139,92,246,0.3)]'}`}>
                          {c.severity} Severity
                        </span>
                      </div>
                      
                      <div className="mb-6 text-[11px] font-mono text-text-2 bg-black/30 px-3 py-1.5 inline-block rounded-md border border-glass-border">
                        Target Table: <span className="text-text-h font-semibold">{c.table}</span>
                      </div>
                      
                      <div className="space-y-5 text-sm">
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-text-3 tracking-widest mb-1.5">Developer Details</span>
                          <p className="text-text-1 font-light leading-relaxed">{c.description.dev || c.description}</p>
                        </div>
                        <div className="bg-glass-surface p-4 rounded-xl border border-glass-border shadow-inner">
                          <span className="block text-[10px] uppercase font-bold text-text-3 tracking-widest mb-1.5">Plain English Impact</span>
                          <p className="text-text-1/90 leading-relaxed">{c.description.plain || c.description}</p>
                        </div>
                        
                        {(c.impactUnresolved || c.impactResolved) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            {c.impactUnresolved && (
                              <div className="p-4 bg-danger-bg/50 border border-[rgba(239,68,68,0.2)] rounded-xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-danger"></div>
                                <span className="block text-[10px] uppercase font-bold text-danger tracking-widest mb-1.5 pl-2">If Ignored</span>
                                <p className="text-xs text-[#fca5a5] pl-2">{c.impactUnresolved}</p>
                              </div>
                            )}
                            {c.impactResolved && (
                              <div className="p-4 bg-success-bg/50 border border-[rgba(16,185,129,0.2)] rounded-xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-success"></div>
                                <span className="block text-[10px] uppercase font-bold text-success tracking-widest mb-1.5 pl-2">If Fixed</span>
                                <p className="text-xs text-[#6ee7b7] pl-2">{c.impactResolved}</p>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="mt-6 pt-5 border-t border-glass-border">
                           <span className="block text-[10px] uppercase font-bold text-text-3 tracking-widest mb-3">Components Involved</span>
                           <ul className="space-y-2">
                             {c.items.map((item, idx) => (
                               <li key={idx} className="flex gap-3 text-xs font-mono items-center bg-black/20 p-2.5 rounded-lg border border-glass-border">
                                 <span className="text-primary opacity-70">→</span> <span className="text-text-2">{item}</span>
                               </li>
                             ))}
                           </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
