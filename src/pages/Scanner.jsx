import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Fingerprint, BugIcon, PlayCircle, Loader2, BrainCircuit, ShieldAlert, Wrench, CheckCircle } from 'lucide-react';

import { GoogleGenAI } from '@google/genai';

export default function Scanner() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  const [conflictFixes, setConflictFixes] = useState({});
  const [conflictSortBy, setConflictSortBy] = useState('severity-high');

  const callGeminiWithFallback = async (ai, options) => {
    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let lastErr;
    for (const m of models) {
      try {
        return await ai.models.generateContent({ ...options, model: m });
      } catch (err) {
        lastErr = err;
        const msg = String(err.message || "").toUpperCase();
        if (msg.includes("503") || msg.includes("429") || msg.includes("UNAVAILABLE") || msg.includes("EXHAUSTED")) {
          console.warn(`Falling back from ${m} due to server load.`);
          continue;
        }
        throw err; 
      }
    }
    throw lastErr;
  };

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
      
      // Save to local history
      try {
        const storedHistory = localStorage.getItem('snow_history');
        const history = storedHistory ? JSON.parse(storedHistory) : [];
        const newScan = {
          id: Math.random().toString(36).substring(2, 15),
          instanceUrl: config.url,
          stats: res.stats,
          conflictsCount: res.conflicts.length,
          createdAt: new Date().toISOString()
        };
        history.unshift(newScan);
        localStorage.setItem('snow_history', JSON.stringify(history.slice(0, 20)));
      } catch (err) {
        console.warn('Failed to store scan history', err);
      }
      
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
      const response = await callGeminiWithFallback(ai, {
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

  const runAIFixRecommendation = async () => {
    if (!selectedTable || !data) return;
    setAiLoading(true);
    setAiResult('');

    try {
      const context = {
        table: selectedTable,
        businessRules: (data.brByTable[selectedTable] || []).map(r => ({ name: r.name, when: r.when, script: r.script })),
        uiPolicies: (data.upByTable[selectedTable] || []).map(p => ({ desc: p.short_description, conditions: p.conditions, script_true: p.script_true })),
        clientScripts: (data.csByTable[selectedTable] || []).map(s => ({ name: s.name, type: s.type, script: s.script }))
      };

      const prompt = `
      You are a Master ServiceNow Architect. Your task is to build a high-performance, bulletproof REMEDIATION GUIDE for components running on "${selectedTable}".
      
      Analyze the code blocks below for recursive updates, sync API calls, or hardcoded sys_ids.
      Then, provide the EXACT refactored code snippets. Add detailed developer inline comments pointing out specifically what you fixed (e.g. converted sync query to async callback).

      DATA PAYLOAD:
      ${JSON.stringify(context, null, 2)}

      CRITICAL: Format your output as polished HTML. DO NOT wrap in \`\`\`html markdown code blocks. Use modern Tailwind utility classes matching our theme system.
      
      Structure each fix using this design:
      <div class="mb-8 bg-black/20 glass border border-glass-border p-8 rounded-[24px]">
        <div class="flex items-center gap-4 mb-4">
          <div class="w-8 h-8 rounded-full bg-[#34d399]/20 text-[#34d399] border border-[#34d399]/30 flex items-center justify-center text-xs font-bold">✓</div>
          <h3 class="text-lg font-semibold text-white/[0.9]">[Fix Title]</h3>
        </div>
        <p class="text-sm text-white/[0.65] mb-4">[Explanation of why this refactoring is required and its performance gains.]</p>
        
        <div class="text-[10px] uppercase font-bold text-white/[0.4] tracking-widest mb-2">Refactored Solution Code:</div>
        <pre class="bg-black/40 border border-glass-border p-5 rounded-xl text-xs font-mono overflow-x-auto my-4 text-[#6fd1d7] leading-relaxed"><code>[Insert Full Clean Commented JavaScript Code]</code></pre>
      </div>
      
      If no refactoring is strictly required, provide a simple summary of best practices instead.
      `;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "$GEMINI_API_KEY") {
        throw new Error("API_KEY_INVALID");
      }
      const ai = new GoogleGenAI({ apiKey });
      const response = await callGeminiWithFallback(ai, {
        contents: [{ parts: [{ text: prompt }] }]
      });

      const aiOutput = response.text.replace(/^\`\`\`(?:html)?/, '').replace(/\`\`\`$/, '');
      setAiResult(aiOutput);
    } catch (err) {
      console.error(err);
      setAiResult(`<div class="text-destructive font-medium p-4 border border-destructive/20 bg-destructive/10 rounded-lg">Fix Engine Error: ${err.message}</div>`);
    } finally {
      setAiLoading(false);
    }
  };

  const runAIFixForConflict = async (idx) => {
    const conflict = data.conflicts[idx];
    if (!conflict) return;
    
    setConflictFixes(prev => ({
      ...prev,
      [idx]: { loading: true, error: null, data: null }
    }));

    try {
      const systemContext = {
         table: conflict.table,
         involvedItems: conflict.items,
         conflictType: conflict.type,
         conflictDevDesc: conflict.description.dev
      };

      const prompt = `
      You are an expert ServiceNow Architect.
      Fix this specific code conflict on the table "${conflict.table}".
      
      CONTEXT:
      ${JSON.stringify(systemContext, null, 2)}
      
      ### TASK ###
      Generate an optimized, clean version of the ServiceNow JavaScript script(s) involved to fix this conflict. Add detailed developer inline comments. 

      IMPORTANT: Return a JSON object EXACTLY matching this format, and NOTHING ELSE:
      {
         "explanation": "Brief developer summary of changes.",
         "refactoredItems": [
            {
               "name": "Component Name",
               "sys_id": "The exact 32-char sys_id from the context",
               "table": "The table (e.g., sys_script or sys_script_client)",
               "newScript": "The complete clean JavaScript block."
            }
         ]
      }
      `;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "$GEMINI_API_KEY") {
        throw new Error("API_KEY_INVALID");
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await callGeminiWithFallback(ai, {
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });

      const rawJson = JSON.parse(response.text);
      
      setConflictFixes(prev => ({
        ...prev,
        [idx]: { loading: false, error: null, data: rawJson, deploying: false, success: false }
      }));
    } catch (err) {
      console.error(err);
      setConflictFixes(prev => ({
        ...prev,
        [idx]: { loading: false, error: err.message, data: null }
      }));
    }
  };

  const deployFixForConflict = async (idx) => {
    const fix = conflictFixes[idx];
    const config = getConfig();
    if (!fix || !fix.data || !fix.data.refactoredItems || !config) return;
    
    setConflictFixes(prev => ({
      ...prev,
      [idx]: { ...prev[idx], deploying: true, error: null }
    }));

    try {
      for (const item of fix.data.refactoredItems) {
         const res = await fetch('/api/analysis/deploy-fix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               url: config.url,
               username: config.username,
               password: config.password,
               targetTable: item.table,
               sysId: item.sys_id,
               updateFields: {
                  script: item.newScript
               }
            })
         });
         
         if (!res.ok) {
            const result = await res.json();
            throw new Error(result.error || `Failed to deploy: Status ${res.status}`);
         }
      }

      setConflictFixes(prev => ({
        ...prev,
        [idx]: { ...prev[idx], deploying: false, success: true }
      }));
    } catch (err) {
      console.error(err);
      setConflictFixes(prev => ({
        ...prev,
        [idx]: { ...prev[idx], deploying: false, error: `Deployment failed: ${err.message}` }
      }));
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
                    className="btn-secondary px-4 py-2 rounded-xl text-[11px] font-semibold uppercase tracking-wider disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Fingerprint size={14} />}
                    Probe Logic
                  </button>

                  <button 
                    onClick={runAIFixRecommendation}
                    disabled={aiLoading || !selectedTable}
                    className="btn-primary px-4 py-2 rounded-xl text-[11px] font-semibold uppercase tracking-wider disabled:opacity-50 transition-all hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] flex items-center gap-2"
                  >
                    {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Wrench size={14} />}
                    Fix with AI
                  </button>
                </div>
              </div>
              
              {aiResult && (
                <div className="p-8 bg-black/40 prose prose-invert max-w-none text-sm relative z-10" dangerouslySetInnerHTML={{ __html: aiResult }}></div>
              )}
            </div>

            {/* Static Conflict List */}
            <div className="space-y-6 mt-10">
              <div className="flex justify-between items-center border-b border-glass-border pb-4">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-text-3">Static Rule Conflicts</h3>
                
                {data.conflicts.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-widest text-text-3 font-semibold">Sort By</span>
                    <select
                      value={conflictSortBy}
                      onChange={(e) => setConflictSortBy(e.target.value)}
                      className="text-xs glass-input rounded-xl px-3 py-1.5 text-text-1 focus:outline-none bg-black/20 border border-glass-border"
                    >
                      <option value="severity-high" className="bg-bg text-text-1">Severity (High to Low)</option>
                      <option value="severity-low" className="bg-bg text-text-1">Severity (Low to High)</option>
                      <option value="table-asc" className="bg-bg text-text-1">Table (A-Z)</option>
                      <option value="table-desc" className="bg-bg text-text-1">Table (Z-A)</option>
                    </select>
                  </div>
                )}
              </div>
              
              {data.conflicts.length === 0 ? (
                <div className="p-6 border border-glass-border glass rounded-[20px] text-sm text-text-3 font-mono text-center">
                  No strict structural conflicts detected via static analysis. AI Probe recommended.
                </div>
              ) : (
                <div className="grid gap-6">
                  {[...data.conflicts]
                    .map((c, originalIndex) => ({ ...c, originalIndex }))
                    .sort((a, b) => {
                      const severityRank = { High: 3, Medium: 2, Low: 1 };
                      if (conflictSortBy === 'severity-high') return (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
                      if (conflictSortBy === 'severity-low') return (severityRank[a.severity] || 0) - (severityRank[b.severity] || 0);
                      if (conflictSortBy === 'table-asc') return a.table.localeCompare(b.table);
                      if (conflictSortBy === 'table-desc') return b.table.localeCompare(a.table);
                      return 0;
                    })
                    .map((c) => (
                    <div key={c.originalIndex} className="glass border-l-[3px] p-6 rounded-[20px] hover:bg-glass-surface-hover transition-colors relative overflow-hidden" style={{ borderLeftColor: c.severity === 'High' ? 'var(--color-danger)' : c.severity === 'Medium' ? 'var(--color-warning)' : 'var(--color-primary)' }}>
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
                                 <span className="text-primary opacity-70">→</span> <span className="text-text-2">{item.name || item}</span>
                               </li>
                             ))}
                           </ul>
                        </div>

                        {/* Inline AI Fix Block */}
                        <div className="mt-6 pt-6 border-t border-glass-border relative z-10">
                          {!conflictFixes[c.originalIndex] ? (
                            <button 
                              onClick={() => runAIFixForConflict(c.originalIndex)}
                              className="w-full btn-secondary py-3.5 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-glass-surface-hover border border-glass-border transition-all hover:shadow-[0_0_15px_rgba(139,92,246,0.2)]"
                            >
                              <BrainCircuit size={16} className="text-primary" /> Solve Conflict with AI
                            </button>
                          ) : conflictFixes[c.originalIndex].loading ? (
                            <div className="bg-black/20 border border-glass-border rounded-xl p-5 flex flex-col items-center justify-center gap-3 animate-pulse">
                              <Loader2 size={24} className="animate-spin text-primary" />
                              <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-text-3">AI Synthesizing Remediation...</div>
                            </div>
                          ) : conflictFixes[c.originalIndex].error ? (
                            <div className="bg-danger-bg/30 border border-danger/20 rounded-xl p-4">
                              <div className="text-xs text-[#fca5a5] font-mono mb-3 leading-relaxed">{conflictFixes[c.originalIndex].error}</div>
                              <button onClick={() => runAIFixForConflict(c.originalIndex)} className="btn-secondary px-4 py-2 rounded-lg text-[10px] uppercase font-bold">Retry</button>
                            </div>
                          ) : conflictFixes[c.originalIndex].success ? (
                            <div className="bg-success-bg/20 border border-success/30 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center text-success mb-3 text-lg border border-success/30">✓</div>
                              <h5 className="text-base font-semibold text-text-h mb-1">Deployed Successfully!</h5>
                              <p className="text-xs text-success/90 leading-relaxed">This optimized fix has been pushed to your ServiceNow instance.</p>
                            </div>
                          ) : (
                            <div className="bg-black/20 border border-glass-border rounded-2xl p-6">
                              <div className="flex items-center gap-2.5 mb-3">
                                <Wrench size={15} className="text-success" />
                                <span className="text-[10px] uppercase font-bold text-success tracking-widest">AI Refactored Plan</span>
                              </div>
                              <p className="text-xs text-text-2 mb-5 font-light leading-relaxed">{conflictFixes[c.originalIndex].data?.explanation}</p>
                              
                              {conflictFixes[c.originalIndex].data?.refactoredItems?.map((ref, rIdx) => (
                                <div key={rIdx} className="mb-5 border border-glass-border bg-black/30 rounded-xl overflow-hidden">
                                  <div className="px-4 py-2.5 bg-black/20 border-b border-glass-border flex justify-between items-center">
                                    <span className="text-[10px] font-mono text-text-2 truncate max-w-[200px]">{ref.name}</span>
                                    <span className="text-[9px] font-mono uppercase bg-black/40 text-text-3 px-2 py-0.5 rounded border border-glass-border">{ref.table}</span>
                                  </div>
                                  <pre className="p-4 text-xs font-mono overflow-x-auto text-[#6fd1d7] leading-relaxed max-h-60 bg-black/20"><code>{ref.newScript}</code></pre>
                                </div>
                              ))}
                              
                              <button 
                                onClick={() => deployFixForConflict(c.originalIndex)}
                                disabled={conflictFixes[c.originalIndex].deploying}
                                className="w-full btn-primary py-3.5 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.2)] bg-gradient-to-r from-success to-[#059669] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] disabled:opacity-50 transition-all border-none text-white"
                              >
                                {conflictFixes[c.originalIndex].deploying ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                {conflictFixes[c.originalIndex].deploying ? 'Deploying to ServiceNow...' : 'Deploy Fix to Instance'}
                              </button>
                            </div>
                          )}
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
