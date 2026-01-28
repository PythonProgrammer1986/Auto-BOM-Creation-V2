
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
  ShieldCheck
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
  
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const CLUSTER_SIZE = 5; 
  const RPM_LIMIT = 10; 
  const COOLDOWN_SECONDS = 65; 
  const STORAGE_KEY = 'neural_lab_recovery_v5';

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.proposals && parsed.proposals.length > 0) {
          setProposals(parsed.proposals);
          addLog(`Session recovered: ${parsed.proposals.length} logic formulas ready.`, 'success');
        }
      } catch (e) {
        console.warn("Recovery failed.");
      }
    }
  }, []);

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
    if (confirm("Reset current laboratory synthesis session?")) {
      localStorage.removeItem(STORAGE_KEY);
      setProposals([]);
      addLog("Laboratory reset. All unsaved synthesis cleared.", 'warn');
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
    if (!key) return addLog("API Key Missing in System Config.", 'error');
    if (moFiles.length === 0 || milFiles.length === 0) return addLog("Missing data: Upload MIL and Factory Orders.", 'warn');

    setIsTraining(true);
    try {
      addLog("Indexing engineering repository...", 'info');
      let milData: any[] = [];
      for (const file of milFiles) { milData = [...milData, ...await parseMilExcel(file)]; }

      const ai = new GoogleGenAI({ apiKey: key });
      const moDetails: any[] = [];

      addLog(`Phase 1: Ingesting Factory Orders...`, 'info');
      for (const file of moFiles) {
        const base64 = await new Promise<string>(res => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(',')[1] || '');
          r.readAsDataURL(file);
        });

        const prompt = `
          Extract the technical configuration for this Factory Order. 
          Identify the Machine Model and all option rows (Category and Selection).
          Return valid JSON ONLY: 
          {"moNumber": "string", "model": "string", "options": [{"name": "string", "option": "string"}]}
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [{ text: prompt }, { inlineData: { mimeType: file.type || 'application/pdf', data: base64 } }]
          },
          config: { responseMimeType: "application/json" }
        });

        const data = safeJsonParse(response.text || '{}');
        if (data?.moNumber) {
          moDetails.push({ moNumber: data.moNumber, normMo: normalizeId(data.moNumber), specs: data.options || [] });
          addLog(`Order #${data.moNumber} processed.`, 'success');
        }
      }

      addLog(`Phase 2: Filtering F-Code logic targets...`, 'info');
      const skuContexts: Record<string, any> = {}; 
      moDetails.forEach(mo => {
        const linkedRows = milData.filter(row => row.norm_mo === mo.normMo);
        linkedRows.forEach(row => {
          const pn = row.partnumber;
          if (!pn) return;
          
          // REQUIREMENT: Synthesis ONLY for F_Code 1 (Optional) and 2 (Mandatory Choice)
          const masterPart = parts.find(p => normalizeId(p.Part_Number) === normalizeId(pn));
          if (!masterPart || (masterPart.F_Code !== 1 && masterPart.F_Code !== 2)) return;

          if (!skuContexts[pn]) skuContexts[pn] = { contexts: [], mos: [], milEntry: row };
          skuContexts[pn].contexts.push(mo.specs.map((s:any) => `${s.name}: ${s.option}`).join(' | '));
          skuContexts[pn].mos.push(mo.moNumber);
        });
      });

      const allSkus = Object.keys(skuContexts);
      const currentProcessed = new Set(proposals.map(p => p.partNumber));
      const skusToProcess = allSkus.filter(s => !currentProcessed.has(s));

      if (skusToProcess.length === 0) {
        addLog("No new F1/F2 SKUs detected for synthesis.", 'success');
        setIsTraining(false);
        return;
      }

      addLog(`Phase 3: Synthesizing ${skusToProcess.length} logic formulas...`, 'info');

      for (let i = 0; i < skusToProcess.length; i += CLUSTER_SIZE) {
        if (i > 0 && (i / CLUSTER_SIZE) % RPM_LIMIT === 0) {
          setCooldownRemaining(COOLDOWN_SECONDS);
          await delay(COOLDOWN_SECONDS * 1000);
        }

        const cluster = skusToProcess.slice(i, i + CLUSTER_SIZE);
        const clusterPrompt = cluster.map(pn => {
          const { contexts, mos, milEntry } = skuContexts[pn];
          return `PART: ${pn}\nREMARKS: ${milEntry.remarks}\nUSAGE DATA:\n${contexts.slice(0,8).map((c:any, j:number) => `[ORDER ${mos[j]}] ${c}`).join('\n')}`;
        }).join('\n\n---\n\n');

        try {
          const resp = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `
              ACT AS AN ENGINEERING LOGIC SYNTHESIZER.
              CREATE HUMAN-READABLE TRIGGER FORMULAS USING THESE SPECIFIC SYMBOLIC RULES:
              1. OR GROUPS: Represent as (PARTA/PARTB) - e.g. (CAB/CAN)
              2. AND LOGIC: Use single space between tokens - e.g. "PARTA PARTB"
              3. NOT LOGIC: Use square brackets - e.g. [PARTC]
              
              EXAMPLE OUTPUT: (CAB/CAN) MT22 [TT] 
              (This means the part is used in CAB or CAN, AND must have MT22, AND must NOT have TT)
              
              INPUT DATA:
              ${clusterPrompt}
              
              RETURN JSON ARRAY: [{"partNumber": "string", "expression": "string", "confidence": number, "reasoning": "string", "indicators": ["string"]}]
            `,
            config: { responseMimeType: "application/json" }
          });

          const results = safeJsonParse(resp.text || '[]');
          if (Array.isArray(results)) {
            const mapped = results.map(bp => ({
              partNumber: bp.partNumber,
              partName: parts.find(p => normalizeId(p.Part_Number) === normalizeId(bp.partNumber))?.Name || 'Unknown SKU',
              proposedExpression: bp.expression || '(ERROR)',
              evidenceCount: skuContexts[bp.partNumber]?.mos.length || 0,
              confidence: bp.confidence || 0.5,
              reasoning: bp.reasoning || "Deducted from pattern.",
              matchedMOs: Array.from(new Set(skuContexts[bp.partNumber]?.mos || [])),
              keyIndicators: bp.indicators || []
            }));
            
            setProposals(prev => {
              const next = [...prev, ...mapped];
              localStorage.setItem(STORAGE_KEY, JSON.stringify({ proposals: next }));
              return next;
            });
            addLog(`Batch Processed: ${mapped.length} formulas generated.`, 'success');
          }
        } catch (e: any) {
          addLog(`Batch Error: ${e.message}`, 'error');
        }
        await delay(2000); 
      }
      addLog(`Logic Synthesis Laboratory operations completed.`, 'success');
    } catch (e: any) {
      addLog(`Synthesis Error: ${e.message}`, 'error');
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

      const parseFormula = (str: string) => {
        const orGroups: string[][] = [];
        const excludes: string[] = [];
        const includes: string[] = [];
        let workingStr = str || '';

        const orRegex = /\(([^)]+)\)/g;
        let orMatch;
        while ((orMatch = orRegex.exec(str)) !== null) {
          const group = orMatch[1].split('/').map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
          if (group.length > 0) orGroups.push(group);
          workingStr = workingStr.replace(orMatch[0], ' ');
        }

        const notRegex = /\[([^\]]+)\]/g;
        let notMatch;
        while ((notMatch = notRegex.exec(str)) !== null) {
          const items = notMatch[1].split(/\s+/).map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
          excludes.push(...items);
          workingStr = workingStr.replace(notMatch[0], ' ');
        }

        const remaining = workingStr.split(/\s+/).map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
        includes.push(...remaining);

        return { includes, excludes, orGroups, raw: str };
      };

      const logicObj = parseFormula(p.proposedExpression);
      const existingIdx = newRules.findIndex(r => r.targetPartId === part.id);
      if (existingIdx !== -1) {
        newRules[existingIdx].logic = logicObj;
      } else {
        newRules.push({ id: `rule-synth-${Date.now()}-${Math.random()}`, targetPartId: part.id, logic: logicObj, isActive: true });
      }
    });
    onRulesUpdate(newRules);
    localStorage.removeItem(STORAGE_KEY);
    setProposals([]);
    alert(`Successfully deployed ${proposals.length} synthesized rules to the core engine.`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-8 border-b bg-white flex flex-wrap justify-between items-center shadow-sm gap-4">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl">
            <GraduationCap size={32} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase leading-none">Logic Synthesis Lab</h2>
            <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-[0.2em]">Targeting F1/F2 SKUs ONLY from Master BOM Repository</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={clearSession} className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase text-slate-500 hover:bg-slate-50 transition-all flex items-center gap-2">
            <RotateCcw size={14} /> Reset Lab
          </button>
          {proposals.length > 0 && (
            <button onClick={deployLogic} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase rounded-xl shadow-lg transition-all flex items-center gap-2">
              <ShieldCheck size={16} /> Deploy Rules
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[2.5rem] border p-8 shadow-sm space-y-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <FlaskConical size={14} className="text-indigo-500" /> Synthesis Desk
            </h3>
            
            <div className="space-y-4">
              <div className="group bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center relative cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                <input type="file" multiple onChange={e => setMilFiles(Array.from(e.target.files || []))} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <FileSpreadsheet className={milFiles.length > 0 ? "text-indigo-600" : "text-slate-300"} size={32} />
                <span className="text-[10px] font-black text-slate-400 mt-3 uppercase text-center">{milFiles.length > 0 ? `${milFiles.length} MIL Files Ready` : 'Link MIL Item List (Excel)'}</span>
              </div>

              <div className="group bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center relative cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                <input type="file" multiple onChange={e => setMoFiles(Array.from(e.target.files || []))} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <FileText className={moFiles.length > 0 ? "text-indigo-600" : "text-slate-300"} size={32} />
                <span className="text-[10px] font-black text-slate-400 mt-3 uppercase text-center">{moFiles.length > 0 ? `${moFiles.length} Factory Orders Loaded` : 'Link Factory Orders (PDF/Img)'}</span>
              </div>

              <button 
                onClick={startLogicSynthesis} 
                disabled={isTraining || cooldownRemaining > 0} 
                className={`w-full py-5 rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase transition-all shadow-xl ${isTraining || cooldownRemaining > 0 ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
              >
                {isTraining ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                {isTraining ? 'Processing...' : cooldownRemaining > 0 ? `Quota Reset (${cooldownRemaining}s)` : 'Run Neural Synthesis'}
              </button>
            </div>
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white h-80 flex flex-col shadow-inner">
             <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-3">
               <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><Terminal size={12} /> Neural Stream</h3>
               <button onClick={() => setTrainingLog([])} className="text-slate-500 hover:text-white transition-colors"><Trash2 size={14} /></button>
             </div>
             <div className="flex-1 overflow-auto font-mono text-[9px] space-y-2">
                {trainingLog.map((l, i) => (
                  <div key={i} className={`flex gap-3 leading-relaxed ${l.type === 'error' ? 'text-red-400' : l.type === 'success' ? 'text-emerald-400' : 'text-indigo-200'}`}>
                    <span className="opacity-30 shrink-0">[{new Date().toLocaleTimeString()}]</span>
                    <span>{l.msg}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col">
           {proposals.length > 0 ? (
             <div className="bg-white rounded-[3rem] border p-8 shadow-sm flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-8 border-b pb-6">
                   <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Discovered Logic Formulas</h3>
                   <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                      <input type="text" placeholder="Filter SKU..." value={resultSearchTerm} onChange={(e) => setResultSearchTerm(e.target.value)} className="pl-9 pr-4 py-2 text-[10px] font-black uppercase bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all w-48" />
                   </div>
                </div>
                
                <div className="flex-1 overflow-auto space-y-4 pr-2">
                   {filteredProposals.slice().reverse().map((p) => (
                      <div key={p.partNumber} className="p-8 border-2 rounded-[2.5rem] bg-white hover:border-indigo-400 transition-all flex flex-col gap-6 shadow-sm group animate-in slide-in-from-right-4">
                         <div className="flex justify-between items-start">
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest font-mono">SKU: {p.partNumber}</p>
                               <h4 className="text-lg font-black text-slate-800 tracking-tight uppercase leading-none">{p.partName}</h4>
                            </div>
                            <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${p.confidence > 0.8 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                               {Math.round(p.confidence * 100)}% Confidence
                            </div>
                         </div>
                         
                         <div className="bg-slate-900 p-8 rounded-[2rem] border border-white/5 flex flex-wrap items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
                            <div className="space-y-2 relative z-10">
                              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest block">Human-Readable Formula</span>
                              <code className="text-white font-mono font-black text-2xl tracking-tighter select-all">{p.proposedExpression}</code>
                            </div>
                            <div className="text-right relative z-10 border-l border-white/10 pl-6">
                              <span className="text-[10px] font-black text-slate-500 uppercase block tracking-widest">Dataset Size</span>
                              <span className="text-xl font-black text-indigo-400 uppercase">{p.evidenceCount} Orders</span>
                            </div>
                         </div>

                         <div className="flex gap-4 items-start bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                           <div className="p-2 bg-white rounded-xl shadow-sm"><BrainCircuit size={20} className="text-indigo-400" /></div>
                           <p className="text-[11px] text-slate-600 font-bold uppercase tracking-tight italic leading-relaxed">
                             <span className="text-indigo-600 font-black mr-2 not-italic underline decoration-indigo-200">Neural Insight:</span> {p.reasoning}
                           </p>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
           ) : (
             <div className="bg-white rounded-[3rem] border border-slate-200 p-16 shadow-sm h-full flex flex-col items-center justify-center text-slate-300 text-center animate-pulse">
                <FlaskConical size={80} className="mb-6 opacity-20" />
                <h4 className="text-sm font-black uppercase tracking-[0.5em] text-slate-400">Synthesis Engine Idling</h4>
                <p className="text-[11px] font-bold text-slate-400 mt-6 max-w-sm uppercase leading-relaxed tracking-wider">
                  Targeting only F1 (Optional) and F2 (Mandatory Choice) items. Ensure you have imported the Master BOM Repository before starting the lab.
                </p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default NeuralAcademy;
