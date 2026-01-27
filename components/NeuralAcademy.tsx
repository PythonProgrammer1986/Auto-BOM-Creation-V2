import React, { useState, useMemo, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { MachineKnowledge, BOMPart, ConfigRule, TechnicalGlossary } from '../types';
import { 
  GraduationCap, 
  Loader2, 
  FileText, 
  BrainCircuit, 
  Trash2, 
  Zap, 
  FlaskConical, 
  FileSpreadsheet, 
  Download, 
  Terminal, 
  Search, 
  Activity, 
  RefreshCw, 
  CheckCircle, 
  Binary, 
  Microchip,
  Timer,
  Clock,
  RotateCcw,
  Save,
  PlayCircle,
  PauseCircle,
  Database
} from 'lucide-react';

interface Props {
  knowledgeBase: MachineKnowledge;
  onKnowledgeBaseUpdate: (kb: MachineKnowledge) => void;
  apiKey: string;
  parts: BOMPart[];
  rules: ConfigRule[];
  onRulesUpdate: (rules: ConfigRule[]) => void;
  glossary: TechnicalGlossary;
}

interface LogicProposal {
  partNumber: string;
  partName: string;
  proposedExpression: string;
  evidenceCount: number;
  confidence: number;
  reasoning: string;
  matchedMOs: string[];
  keyIndicators: string[];
}

const NeuralAcademy: React.FC<Props> = ({ knowledgeBase, onKnowledgeBaseUpdate, apiKey, parts, rules, onRulesUpdate, glossary }) => {
  const [activeMode, setActiveMode] = useState<'weights' | 'logic-synthesis'>('logic-synthesis');
  const [moFiles, setMoFiles] = useState<File[]>([]);
  const [milFiles, setMilFiles] = useState<File[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingLog, setTrainingLog] = useState<{msg: string, type: 'info' | 'success' | 'error' | 'warn'}[]>([]);
  const [proposals, setProposals] = useState<LogicProposal[]>([]);
  const [resultSearchTerm, setResultSearchTerm] = useState('');
  
  // Performance & Persistence Config
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const CLUSTER_SIZE = 5; 
  const RPM_LIMIT = 10; 
  const COOLDOWN_SECONDS = 65; 
  const STORAGE_KEY = 'neural_lab_recovery_v4';

  // Load restore point on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.proposals && parsed.proposals.length > 0) {
          setProposals(parsed.proposals);
          addLog(`Restore point located: ${parsed.proposals.length} logic formulas recovered.`, 'success');
        }
      } catch (e) {
        console.warn("Restore point corrupted or empty.");
      }
    }
  }, []);

  // Filtered view of results
  const filteredProposals = useMemo(() => {
    return proposals.filter(p => 
      p.partNumber.toLowerCase().includes(resultSearchTerm.toLowerCase()) ||
      p.partName.toLowerCase().includes(resultSearchTerm.toLowerCase()) ||
      p.proposedExpression.toLowerCase().includes(resultSearchTerm.toLowerCase())
    );
  }, [proposals, resultSearchTerm]);

  useEffect(() => {
    let timer: number;
    if (cooldownRemaining > 0) {
      timer = window.setInterval(() => setCooldownRemaining(prev => Math.max(0, prev - 1)), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => 
    setTrainingLog(prev => [{ msg: `[${new Date().toLocaleTimeString()}] ${msg}`, type }, ...prev]);

  const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

  const normalizeId = (id: any): string => String(id || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');

  const safeJsonParse = (text: string) => {
    try {
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) { return null; }
  };

  const clearSession = () => {
    if (confirm("This will purge all synthesized results and the current restore point. Proceed?")) {
      localStorage.removeItem(STORAGE_KEY);
      setProposals([]);
      addLog("Lab environment sanitized. Session cleared.", 'warn');
    }
  };

  const parseMilExcel = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = (window as any).XLSX.read(e.target?.result, { type: 'binary' });
          const rawRows = (window as any).XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
          resolve(rawRows.map((row: any) => {
            const normalized: any = { _raw: row };
            Object.keys(row).forEach(key => {
              const val = row[key];
              const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (k === 'mo' || k.includes('order')) normalized['norm_mo'] = normalizeId(val);
              else if (k === 'partno' || k.includes('partnumber')) {
                normalized['partnumber'] = val;
                normalized['norm_pn'] = normalizeId(val);
              } else if (k === 'name') normalized['name'] = val;
              else if (k === 'remarks') normalized['remarks'] = val;
            });
            return normalized;
          }));
        } catch (err) { reject(err); }
      };
      reader.readAsBinaryString(file);
    });
  };

  const startLogicSynthesis = async () => {
    const key = apiKey || process.env.API_KEY;
    if (!key) return addLog("API Key Missing. Check System Config.", 'error');
    if (moFiles.length === 0 || milFiles.length === 0) return addLog("Missing datasets: Upload MIL and MO files.", 'warn');

    setIsTraining(true);
    try {
      addLog("Indexing Master Item List...", 'info');
      let milData: any[] = [];
      for (const file of milFiles) { milData = [...milData, ...await parseMilExcel(file)]; }

      const ai = new GoogleGenAI({ apiKey: key });
      const moDetails: any[] = [];

      addLog(`Phase 1: Ingesting Factory Orders (${moFiles.length})...`, 'info');
      for (const file of moFiles) {
        const base64 = await new Promise<string>(res => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(',')[1] || '');
          r.readAsDataURL(file);
        });

        const resp = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: { parts: [{ text: "Extract MO Number and Options Table. JSON: {\"moNumber\": \"string\", \"options\": [{\"name\": \"string\", \"option\": \"string\"}]}" }, { inlineData: { mimeType: file.type, data: base64 } }] },
          config: { responseMimeType: "application/json" }
        });

        const data = safeJsonParse(resp.text || '{}');
        if (data?.moNumber) {
          moDetails.push({ moNumber: data.moNumber, normMo: normalizeId(data.moNumber), specs: data.options || [] });
          addLog(`Order #${data.moNumber} identified.`, 'success');
        }
      }

      addLog(`Phase 2: Semantic Correlation Mapping...`, 'info');
      const skuContexts: Record<string, any> = {}; 
      moDetails.forEach(mo => {
        const linkedRows = milData.filter(row => row.norm_mo === mo.normMo);
        linkedRows.forEach(row => {
          const pn = row.partnumber;
          if (!pn) return;
          if (!skuContexts[pn]) skuContexts[pn] = { contexts: [], mos: [], milEntry: row };
          skuContexts[pn].contexts.push(mo.specs.map((s:any) => `${s.name}: ${s.option}`).join(' | '));
          skuContexts[pn].mos.push(mo.moNumber);
        });
      });

      const allSkus = Object.keys(skuContexts);
      const currentProcessed = new Set(proposals.map(p => p.partNumber));
      const skusToProcess = allSkus.filter(s => !currentProcessed.has(s));

      if (skusToProcess.length === 0) {
        addLog("Delta Check: All detected SKUs already synthesized.", 'success');
        setIsTraining(false);
        return;
      }

      addLog(`Phase 3: High-Speed Neural Synthesis. Cluster Size: ${CLUSTER_SIZE}`, 'info');

      for (let i = 0; i < skusToProcess.length; i += CLUSTER_SIZE) {
        if (i > 0 && (i / CLUSTER_SIZE) % RPM_LIMIT === 0) {
          addLog(`API Pacing: Cooling down to reset RPM quota...`, 'warn');
          setCooldownRemaining(COOLDOWN_SECONDS);
          await delay(COOLDOWN_SECONDS * 1000);
        }

        const cluster = skusToProcess.slice(i, i + CLUSTER_SIZE);
        const clusterRemarks = cluster.map(pn => skuContexts[pn].milEntry.remarks).join(' ');
        const prunedGlossary = Object.entries(glossary)
          .filter(([abbr]) => clusterRemarks.includes(abbr))
          .map(([k,v]) => `${k}=${v}`).join('; ');

        const clusterPrompt = cluster.map(pn => {
          const { contexts, mos, milEntry } = skuContexts[pn];
          return `PART: ${pn}\nREMARKS: ${milEntry.remarks}\nEVIDENCE:\n${contexts.slice(0,8).map((c:any, j:number) => `[MO ${mos[j]}] ${c}`).join('\n')}`;
        }).join('\n\n---\n\n');

        let retryCount = 0;
        let clusterSuccess = false;

        while (!clusterSuccess && retryCount < 2) {
          try {
            const resp = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: `
                ACT AS AN ENGINEERING LOGIC ENGINE. 
                FOR EACH PART BELOW, SYNTHESIZE A TRIGGER FORMULA.
                DICTIONARY: ${prunedGlossary}
                INPUTS:
                ${clusterPrompt}
                
                RETURN JSON ARRAY: [{"partNumber": "string", "expression": "(INCLUDES) [EXCLUDES]", "confidence": number, "reasoning": "string", "indicators": ["string"]}]
              `,
              config: { responseMimeType: "application/json" }
            });

            const batchResults = safeJsonParse(resp.text || '[]');
            if (Array.isArray(batchResults)) {
              const mappedResults = batchResults.map(bp => ({
                partNumber: bp.partNumber,
                partName: parts.find(p => normalizeId(p.Part_Number) === normalizeId(bp.partNumber))?.Name || 'Unknown Component',
                proposedExpression: bp.expression || '(N/A)',
                evidenceCount: skuContexts[bp.partNumber]?.mos.length || 0,
                confidence: bp.confidence || 0.5,
                reasoning: bp.reasoning || "Neural Deduction.",
                matchedMOs: Array.from(new Set(skuContexts[bp.partNumber]?.mos || [])),
                keyIndicators: bp.indicators || []
              }));
              
              // Real-time Update & Persistence
              setProposals(prev => {
                const next = [...prev, ...mappedResults];
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ proposals: next, timestamp: new Date().toISOString() }));
                return next;
              });

              addLog(`Cluster Ready: ${mappedResults.length} formulas live.`, 'success');
              clusterSuccess = true;
            }
          } catch (e: any) {
            if (e.message?.includes('429')) {
               addLog("Rate Limit Encountered. Automatic 30s Pacing.", 'warn');
               setCooldownRemaining(30);
               await delay(30000);
               retryCount++;
            } else {
               addLog(`AI Exception: ${e.message}`, 'error');
               break;
            }
          }
        }
        await delay(1500); 
      }
      addLog(`Synthesis Laboratory Operations Complete.`, 'success');
    } catch (e: any) {
      addLog(`Fatal Error: ${e.message}`, 'error');
    } finally {
      setIsTraining(false);
      setCooldownRemaining(0);
    }
  };

  const deployLogic = () => {
    const newRules = [...rules];
    proposals.forEach(p => {
      const part = parts.find(x => normalizeId(x.Part_Number) === normalizeId(p.partNumber));
      if (!part) return;
      const logicObj = { includes: [], excludes: [], orGroups: [], raw: p.proposedExpression };
      const existingIdx = newRules.findIndex(r => r.targetPartId === part.id);
      if (existingIdx !== -1) newRules[existingIdx].logic = logicObj;
      else newRules.push({ id: `rule-synth-${Date.now()}-${Math.random()}`, targetPartId: part.id, logic: logicObj, isActive: true });
    });
    onRulesUpdate(newRules);
    localStorage.removeItem(STORAGE_KEY);
    setProposals([]);
    alert(`Success: Integrated ${proposals.length} synthesized rules into the master configuration engine.`);
  };

  const exportToExcel = () => {
    if (proposals.length === 0) return;
    const data = proposals.map(p => ({
      "SKU": p.partNumber,
      "Description": p.partName,
      "Logic Formula": p.proposedExpression,
      "Match Score": `${Math.round(p.confidence * 100)}%`,
      "Source Orders": p.evidenceCount,
      "Analysis": p.reasoning
    }));
    const wb = (window as any).XLSX.utils.book_new();
    const ws = (window as any).XLSX.utils.json_to_sheet(data);
    (window as any).XLSX.utils.book_append_sheet(wb, ws, "Neural Synthesis Report");
    (window as any).XLSX.writeFile(wb, `Engineering_Synthesis_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-8 border-b bg-white flex flex-wrap justify-between items-center shadow-sm gap-4">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl">
            <GraduationCap size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase leading-none">Neural Academy</h2>
            <div className="flex items-center gap-4 mt-3">
               <button onClick={() => setActiveMode('logic-synthesis')} className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${activeMode === 'logic-synthesis' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Logic Synthesis Lab</button>
               <button onClick={() => setActiveMode('weights')} className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${activeMode === 'weights' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Neural Pattern Training</button>
            </div>
          </div>
        </div>
        <div className="flex gap-8">
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Master Base</p>
              <p className="text-2xl font-black text-slate-800 leading-none mt-1">{parts.length} Items</p>
           </div>
           {proposals.length > 0 && (
             <div className="text-right border-l pl-8 border-slate-100">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Logic Stream</p>
                <p className="text-2xl font-black text-indigo-600 leading-none mt-1">{proposals.length} Formulas</p>
             </div>
           )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2.5rem] border p-8 shadow-sm space-y-6 sticky top-0">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <FlaskConical size={14} className="text-indigo-500" /> Control Desk
              </h3>
              {proposals.length > 0 && (
                <button onClick={clearSession} className="text-red-500 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg" title="Reset Session">
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="group bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center relative cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
                <input type="file" multiple onChange={e => setMilFiles(Array.from(e.target.files || []))} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <FileSpreadsheet className={milFiles.length > 0 ? "text-indigo-600" : "text-slate-300"} size={32} />
                <span className="text-[10px] font-black text-slate-400 mt-3 uppercase text-center">{milFiles.length > 0 ? `${milFiles.length} MIL Files Ready` : 'Upload MIL Ground Truth'}</span>
              </div>

              <div className="group bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center relative cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
                <input type="file" multiple onChange={e => setMoFiles(Array.from(e.target.files || []))} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <FileText className={moFiles.length > 0 ? "text-indigo-600" : "text-slate-300"} size={32} />
                <span className="text-[10px] font-black text-slate-400 mt-3 uppercase text-center">{moFiles.length > 0 ? `${moFiles.length} Factory Orders Loaded` : 'Upload Factory Orders'}</span>
              </div>

              <div className="pt-4 space-y-3">
                 <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest px-2">
                    <span>Cluster Sync</span>
                    <span className="flex items-center gap-1 text-emerald-500 font-bold"><Save size={8} /> Auto-Saving Every Logic</span>
                 </div>
                 <button 
                  onClick={startLogicSynthesis} 
                  disabled={isTraining || cooldownRemaining > 0} 
                  className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase transition-all shadow-xl active:scale-95 ${isTraining || cooldownRemaining > 0 ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'}`}
                >
                  {isTraining ? <Loader2 size={18} className="animate-spin" /> : cooldownRemaining > 0 ? <Clock size={18} /> : proposals.length > 0 ? <PlayCircle size={18} /> : <Zap size={18} />}
                  {isTraining ? 'Processing Clusters...' : cooldownRemaining > 0 ? `Quota Reset (${cooldownRemaining}s)` : proposals.length > 0 ? 'Resume Synthesis' : 'Begin Synthesis Engine'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-2xl h-80 border border-white/5 flex flex-col">
             <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-3">
               <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Terminal size={12} /> Neural Stream Feed</h3>
               <button onClick={() => setTrainingLog([])} className="text-slate-500 hover:text-white transition-colors"><Trash2 size={14} /></button>
             </div>
             <div className="flex-1 overflow-auto font-mono text-[9px] space-y-2 scrollbar-hide">
                {cooldownRemaining > 0 && (
                   <div className="bg-indigo-500/20 p-3 rounded-xl border border-indigo-500/30 flex items-center gap-3 text-indigo-300 mb-4 animate-pulse">
                      <Timer size={14} />
                      <span className="font-bold uppercase tracking-tight">LATENCY COOLING: {cooldownRemaining}s</span>
                   </div>
                )}
                {trainingLog.length === 0 && <p className="text-slate-700 italic">Engine idling. Upload data to begin...</p>}
                {trainingLog.map((l, i) => (
                  <div key={i} className={`flex gap-3 leading-relaxed ${l.type === 'error' ? 'text-red-400' : l.type === 'success' ? 'text-emerald-400' : l.type === 'warn' ? 'text-amber-400' : 'text-indigo-200/80'}`}>
                    <span className="opacity-30">[{new Date().toLocaleTimeString()}]</span>
                    <span className="flex-1">{l.msg}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col h-full">
           {proposals.length > 0 ? (
             <div className="bg-white rounded-[3rem] border-2 border-indigo-100 p-8 shadow-2xl h-full flex flex-col animate-in zoom-in-95">
                <div className="flex flex-wrap justify-between items-center mb-8 gap-4 border-b pb-8 border-slate-50">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner"><Activity size={24} /></div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">Synthesized Findings</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Incremental State Persistence Active</p>
                      </div>
                   </div>
                   <div className="flex gap-2">
                      <div className="relative mr-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                        <input type="text" placeholder="Filter discovered SKU..." value={resultSearchTerm} onChange={(e) => setResultSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 text-[10px] font-black uppercase bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all w-48" />
                      </div>
                      <button onClick={exportToExcel} title="Export Findings" className="p-3 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"><Download size={18} /></button>
                      <button onClick={deployLogic} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-xl shadow-lg transition-all active:scale-95">Deploy to Engine</button>
                   </div>
                </div>
                
                <div className="flex-1 overflow-auto pr-4 space-y-4">
                   {filteredProposals.slice().reverse().map((p, i) => (
                      <div key={p.partNumber} className="p-8 border-2 rounded-[2.5rem] bg-white hover:border-indigo-400 transition-all flex flex-col gap-6 shadow-sm group animate-in slide-in-from-right-4">
                         <div className="flex justify-between items-start">
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest font-mono">PN: {p.partNumber}</p>
                               <h4 className="text-lg font-black text-slate-800 tracking-tight uppercase leading-none">{p.partName}</h4>
                            </div>
                            <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border shadow-sm ${p.confidence > 0.8 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                               <CheckCircle size={12} /> {Math.round(p.confidence * 100)}% Match
                            </div>
                         </div>
                         
                         <div className="bg-slate-900 p-6 rounded-[2rem] border border-white/5 flex flex-wrap items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-5"><Binary size={80} className="text-indigo-400" /></div>
                            <div className="space-y-1 relative z-10">
                              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Synthesized Formula</span>
                              <code className="text-white font-mono font-black text-lg sm:text-2xl tracking-tighter">{p.proposedExpression}</code>
                            </div>
                            <div className="text-right relative z-10">
                              <span className="text-[10px] font-black text-slate-500 uppercase block tracking-widest">Evidence Base</span>
                              <span className="text-xl font-black text-indigo-400 uppercase">{p.evidenceCount} Orders Found</span>
                            </div>
                         </div>

                         <div className="space-y-4">
                           <div className="flex flex-wrap gap-2">
                              {p.keyIndicators.map(ki => (
                                <span key={ki} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded-lg border border-indigo-100 uppercase flex items-center gap-1"><Microchip size={10} /> {ki}</span>
                              ))}
                           </div>
                           <div className="flex gap-3 items-start bg-slate-50 p-4 rounded-2xl border border-slate-100">
                             <BrainCircuit size={18} className="text-indigo-400 mt-1 shrink-0" />
                             <div>
                               <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tight italic leading-relaxed">
                                 <span className="text-indigo-600 font-black mr-2 not-italic">Neural Insight:</span> {p.reasoning}
                               </p>
                             </div>
                           </div>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
           ) : (
             <div className="bg-white rounded-[3rem] border border-slate-200 p-8 shadow-sm h-full flex flex-col items-center justify-center text-slate-300 relative overflow-hidden">
                <div className="absolute inset-0 bg-slate-50/50 [mask-image:radial-gradient(circle_at_center,white,transparent)]"></div>
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center border shadow-inner mb-8 transition-transform hover:scale-110 group">
                    <FlaskConical size={48} className="text-slate-200 group-hover:text-indigo-300 transition-colors" />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-[0.5em] text-slate-400">Lab Offline</h4>
                  <p className="text-[10px] font-bold text-slate-400 mt-4 max-w-sm uppercase leading-relaxed tracking-wider">
                    Upload your engineering datasets to begin logic synthesis. The engine will process 5 SKUs per batch and save progress incrementally.
                  </p>
                  <div className="mt-12 flex gap-4">
                    <div className="px-6 py-2 bg-slate-50 border rounded-2xl text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 shadow-sm"><Database size={12} /> Persistence Active</div>
                    <div className="px-6 py-2 bg-slate-50 border rounded-2xl text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 shadow-sm"><RefreshCw size={12} /> Session Recovery</div>
                  </div>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default NeuralAcademy;