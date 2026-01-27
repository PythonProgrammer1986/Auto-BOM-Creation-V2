
import React, { useState, useMemo, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { BOMPart, ConfigRule, MachineKnowledge, ConfidenceLevel, TechnicalGlossary, RuleLogic } from '../types';
import { 
  FileStack, 
  Upload, 
  Sparkles, 
  AlertCircle, 
  Loader2, 
  ArrowRight, 
  CheckCircle2, 
  Info,
  Brain,
  History,
  ShieldCheck,
  SearchCode,
  Book,
  Scale,
  Binary,
  FileSpreadsheet,
  Zap,
  Check,
  Filter,
  FileWarning
} from 'lucide-react';

interface AIResponse {
  model?: string;
  options?: { category: string; selection: string; quantity: string }[];
}

interface Props {
  parts: BOMPart[];
  rules: ConfigRule[];
  knowledgeBase: MachineKnowledge;
  glossary: TechnicalGlossary;
  apiKey: string;
  onAutoSelect: (selectedIds: Set<string>) => void;
  onModelDetected: (model: string) => void;
  onNavigateToSelection: () => void;
}

interface MatchResult {
  category: string;
  selection: string;
  quantity: string;
  matchedPart?: BOMPart;
  confidence: number;
  level: ConfidenceLevel;
  source: 'Learned' | 'Hybrid' | 'AI' | 'Partial' | 'Logic' | 'None';
  logicFormula?: string;
}

interface IndexedPart {
  part: BOMPart;
  tokens: Set<string>;
  pn: string;
  ref: string;
}

const STOP_WORDS = new Set(['WITH', 'AND', 'THE', 'FOR', 'NON', 'NONE', 'SELECTED', 'UNIT', 'OPTIONS', 'OR', 'IS', 'OF', 'IN', 'BY']);

const MOProvision: React.FC<Props> = ({ parts, rules, knowledgeBase, glossary, apiKey, onAutoSelect, onModelDetected, onNavigateToSelection }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modelName, setModelName] = useState('Generic');
  const [labRules, setLabRules] = useState<ConfigRule[]>([]);
  const labUploadRef = useRef<HTMLInputElement>(null);

  // Requirement: Do not mix Lab Synthesis and Active Engineering Logic here.
  // We strictly use labRules (uploaded via CSV) for the Logic synthesis check.
  const moLogicRules = useMemo(() => labRules, [labRules]);

  const normalize = (s: any): string => 
    String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '');

  const partIndex: IndexedPart[] = useMemo(() => {
    return parts.map(p => {
      let technicalSource = `${p.Name} ${p.Remarks} ${p.Std_Remarks} ${p.Ref_des}`.toUpperCase();
      Object.entries(glossary).forEach(([abbr, full]) => {
        if (technicalSource.includes(abbr)) technicalSource += ` ${full}`;
      });
      return {
        part: p,
        tokens: new Set(technicalSource.split(/[\s,./()]+/).filter(s => s.length > 2 && !STOP_WORDS.has(s))),
        pn: normalize(p.Part_Number),
        ref: p.Ref_des.toUpperCase()
      };
    });
  }, [parts, glossary]);

  const parseLabFormula = (formula: string): RuleLogic => {
    const includes: string[] = [];
    const excludes: string[] = [];
    const orGroups: string[][] = [];

    const exMatches = formula.match(/\[([^\]]+)\]/g);
    if (exMatches) {
      exMatches.forEach(m => {
        const cleaned = m.replace(/[\[\]]/g, '').trim().toUpperCase();
        excludes.push(...cleaned.split(/\s+OR\s+/i).map(s => s.trim()));
      });
    }

    const parMatches = formula.match(/\(([^)]+)\)/g);
    if (parMatches) {
      parMatches.forEach(m => {
        const content = m.replace(/[()]/g, '').trim().toUpperCase();
        if (content.includes(' OR ')) {
          orGroups.push(content.split(/\s+OR\s+/i).map(s => s.trim()));
        } else {
          includes.push(content);
        }
      });
    }

    if (includes.length === 0 && orGroups.length === 0) {
      const remaining = formula.replace(/\(([^)]+)\)/g, '').replace(/\[[^\]]+\]/g, '').trim().toUpperCase();
      if (remaining.length > 2) {
        includes.push(remaining);
      }
    }

    return { includes, excludes, orGroups, raw: formula };
  };

  const handleLabUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (parts.length === 0) {
      setError("Please import the Master BOM Repository first.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = (window as any).XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = (window as any).XLSX.utils.sheet_to_json(ws);

        const data = rawData.map((r: any) => {
          const normalizedRow: any = {};
          Object.keys(r).forEach(k => {
            const cleanKey = k.replace(/^\uFEFF/, '').trim();
            normalizedRow[cleanKey] = r[k];
          });
          return normalizedRow;
        });

        const newRules: ConfigRule[] = data.map((row: any, i: number) => {
          const skuRaw = row.SKU || row.Part_Number || row.partnumber || row.PN;
          const formula = row['Logic Formula'] || row.Logic || row.Formula || row.Expression;
          
          if (!skuRaw || !formula) return null;
          
          const skuNorm = normalize(skuRaw);
          const part = parts.find(p => normalize(p.Part_Number) === skuNorm);
          
          if (!part) return null;

          return {
            id: `lab-rule-${i}-${Date.now()}`,
            targetPartId: part.id,
            logic: parseLabFormula(String(formula)),
            isActive: true
          };
        }).filter(Boolean) as ConfigRule[];

        if (newRules.length > 0) {
          setLabRules(newRules);
          setError(null);
          alert(`Successfully linked ${newRules.length} synthesis formulas to your Master BOM.`);
        } else {
          setError("No matching SKUs found in the uploaded CSV. Ensure the 'SKU' column matches your Master BOM.");
        }
      } catch (err) {
        console.error("CSV Parse Error:", err);
        setError("Failed to read CSV. Please ensure it is a valid synthesis lab export.");
      }
    };
    reader.readAsBinaryString(file);
    if (labUploadRef.current) labUploadRef.current.value = '';
  };

  const evaluateLogic = (rule: ConfigRule, moContextTokens: Set<string>, moContextRaw: string): boolean => {
    const { includes, excludes, orGroups } = rule.logic;
    const rawUpper = moContextRaw.toUpperCase();
    
    const hasAllIncludes = includes.every(inc => {
      const target = inc.toUpperCase();
      if (moContextTokens.has(target)) return true;
      if (rawUpper.includes(target)) return true;
      return Array.from(moContextTokens).some(token => token.includes(target) || target.includes(token));
    });
    if (includes.length > 0 && !hasAllIncludes) return false;

    const hasAnyExcludes = excludes.some(exc => {
      const target = exc.toUpperCase();
      return moContextTokens.has(target) || rawUpper.includes(target);
    });
    if (excludes.length > 0 && hasAnyExcludes) return false;

    const matchesAllOrGroups = orGroups.every(group => 
      group.some(orItem => {
        const target = orItem.toUpperCase();
        return moContextTokens.has(target) || rawUpper.includes(target) || 
               Array.from(moContextTokens).some(token => token.includes(target) || target.includes(token));
      })
    );
    if (orGroups.length > 0 && !matchesAllOrGroups) return false;

    return (includes.length > 0 || orGroups.length > 0);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const effectiveApiKey = apiKey || process.env.API_KEY;

    if (!files || files.length === 0 || parts.length === 0) return;
    if (!effectiveApiKey) {
      setError("API Key Missing: Provide Gemini API Key in the Logic Section.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
      const resultsBatch: MatchResult[] = [];
      let detectedModel = 'Generic';

      const filePromises = (Array.from(files) as File[]).map(async (file) => {
        const base64 = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(',')[1] || '');
          r.onerror = (err) => rej(err);
          r.readAsDataURL(file);
        });

        const prompt = `
          Strictly extract the technical configuration for this Factory Order. 
          Identify the Machine Model and all option rows (Category and Selection).
          Return valid JSON ONLY: 
          {"model": "MT2200", "options": [{"category": "Operator Environment", "selection": "Forward seated cabin", "quantity": "1"}]}
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [{ text: prompt }, { inlineData: { mimeType: file.type || 'application/pdf', data: base64 } }]
          },
          config: { responseMimeType: "application/json" }
        });

        return JSON.parse(response.text || '{}') as AIResponse;
      });

      const pages = await Promise.all(filePromises);
      const allOptions = pages.flatMap(p => p.options || []);
      
      const models = pages.map(p => p.model).filter(m => !!m && m !== 'Generic');
      if (models.length > 0) {
        detectedModel = models[0]!.toUpperCase();
        setModelName(detectedModel);
        onModelDetected(detectedModel);
      }

      const moContextTokens = new Set<string>();
      let moContextRaw = "";
      allOptions.forEach(opt => {
        const entry = `${opt.category} ${opt.selection}`.toUpperCase();
        moContextRaw += " | " + entry;
        moContextTokens.add(entry);
        entry.split(/[\s,./()]+/).forEach(t => { if (t.length > 2) moContextTokens.add(t); });
      });

      const modelHistory = knowledgeBase[detectedModel] || [];
      const autoSelectedIds = new Set<string>();

      const logicVerified: MatchResult[] = [];
      parts.forEach(p => {
        const rule = moLogicRules.find(r => r.targetPartId === p.id);
        if (rule && evaluateLogic(rule, moContextTokens, moContextRaw)) {
          logicVerified.push({
            category: "Lab Synthesis Check",
            selection: `Verified by Formula: ${rule.logic.raw}`,
            quantity: "1",
            matchedPart: p,
            confidence: 1.0,
            level: ConfidenceLevel.AUTO_VERIFIED,
            source: 'Logic',
            logicFormula: rule.logic.raw
          });
          autoSelectedIds.add(p.id);
        }
      });

      allOptions.forEach(opt => {
        const queryRaw = `${opt.category} ${opt.selection}`.toUpperCase();
        let bestMatch: IndexedPart | null = null;
        let topScore = 0;
        let finalSource: MatchResult['source'] = 'None';

        partIndex.forEach(ip => {
          let score = 0;
          
          const rule = moLogicRules.find(r => r.targetPartId === ip.part.id);
          if (rule && evaluateLogic(rule, moContextTokens, moContextRaw)) {
            score = 1.8; 
          } else {
            if (queryRaw.includes(ip.pn)) score = 1.2;
            
            const isLearned = modelHistory.some(h => 
              normalize(h.category) === normalize(opt.category) && 
              normalize(h.selection) === normalize(opt.selection) && 
              normalize(h.partNumber) === ip.pn
            );
            if (isLearned) score = Math.max(score, 1.1);
            
            const queryTokens = queryRaw.split(/[\s,./()]+/).filter(s => s.length > 2);
            let hits = 0;
            queryTokens.forEach(t => { if (ip.tokens.has(t)) hits++; });
            const semanticScore = queryTokens.length > 0 ? (hits / queryTokens.length) : 0;
            score = Math.max(score, semanticScore);
          }

          if (score > topScore) { topScore = score; bestMatch = ip; }
        });

        let level = ConfidenceLevel.UNCERTAIN;
        if (topScore >= 1.5) {
          level = ConfidenceLevel.AUTO_VERIFIED;
          finalSource = 'Logic';
        } else if (topScore >= 0.9) {
          level = ConfidenceLevel.AUTO_VERIFIED;
          finalSource = modelHistory.some(h => h.partNumber === bestMatch?.pn) ? 'Learned' : 'AI';
        } else if (topScore >= 0.5) {
          level = ConfidenceLevel.REVIEW_NEEDED;
          finalSource = 'Hybrid';
        }

        if (bestMatch && topScore >= 0.5) {
          autoSelectedIds.add(bestMatch.part.id);
          resultsBatch.push({ ...opt, matchedPart: bestMatch?.part, confidence: Math.min(topScore, 1.0), level, source: finalSource });
        } else {
          resultsBatch.push({ ...opt, confidence: topScore, level, source: 'None' });
        }
      });

      const expertIds = new Set(logicVerified.map(r => r.matchedPart?.id));
      const cleanBatch = resultsBatch.filter(r => !r.matchedPart || !expertIds.has(r.matchedPart.id));

      setResults([...logicVerified, ...cleanBatch]);
      if (autoSelectedIds.size > 0) onAutoSelect(autoSelectedIds);
    } catch (err: any) {
      console.error("MO Processing Error:", err);
      setError(`Processing failed: ${err.message}. Ensure files are clear and API key is valid.`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {error && (
        <div className="bg-red-50 border-2 border-red-100 p-6 rounded-3xl flex items-center gap-4 text-red-600 shadow-xl shadow-red-500/5">
          <FileWarning size={24} />
          <p className="text-xs font-black uppercase tracking-widest">{error}</p>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-end border-b pb-10 gap-8">
        <div className="space-y-3">
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter flex items-center gap-4">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl"><FileStack size={32} /></div>
            Auto Provisioning Engine
          </h2>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100 shadow-sm">
              <Binary className="text-indigo-500" size={14} />
              <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Lab Rules: {labRules.length} Formulas</span>
            </div>
            {labRules.length > 0 && (
               <div className="flex items-center gap-2 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-100 shadow-sm">
                <ShieldCheck className="text-emerald-500" size={14} />
                <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Synthesis Linked</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input type="file" ref={labUploadRef} onChange={handleLabUpload} accept=".csv,.xlsx" className="hidden" />
          <button onClick={() => labUploadRef.current?.click()} className={`px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm ${labRules.length > 0 ? 'border-emerald-500 text-emerald-600' : ''}`}>
            {labRules.length > 0 ? <Check size={14} /> : <Upload size={14} />}
            {labRules.length > 0 ? 'Synthesis Active' : 'Link Lab Synthesis CSV'}
          </button>
          {results.length > 0 && (
            <button onClick={onNavigateToSelection} className="bg-indigo-600 text-white px-10 py-4 rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-700 transition-all flex items-center gap-3 active:scale-95">
              Enter Configurator <ArrowRight size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 space-y-8">
          <div className="relative border-4 border-dashed border-slate-100 rounded-[3rem] p-12 flex flex-col items-center justify-center bg-white hover:border-indigo-200 hover:bg-indigo-50/5 transition-all min-h-[500px] shadow-sm group">
            <input type="file" multiple accept="application/pdf,image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-20" />
            {isProcessing ? (
              <div className="flex flex-col items-center gap-8 text-center">
                <Loader2 className="w-24 h-24 text-indigo-600 animate-spin" />
                <div className="space-y-2">
                   <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 animate-pulse">Neural Cross-Reference...</p>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Linking MO to Lab Ground Truth</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-8 text-center">
                <div className="p-10 bg-slate-50 rounded-full group-hover:bg-white group-hover:scale-110 transition-all shadow-inner">
                  <Upload className="w-20 h-20 text-slate-300 group-hover:text-indigo-400" />
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-700">Drop Factory MOs (PDF/JPG)</p>
                  <p className="text-[10px] font-bold text-slate-400 max-w-[200px] leading-relaxed uppercase tracking-tighter italic">Identifying SKUs using isolated Lab Formulas</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-8 max-h-[900px] overflow-auto pr-6 scroll-smooth pb-20">
          {results.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-200 gap-8 opacity-30 py-48">
                <SearchCode size={100} strokeWidth={1} />
                <p className="text-[10px] font-black uppercase tracking-[0.5em]">Waiting for Data Streams</p>
             </div>
          ) : results.map((res, i) => (
            <div key={i} className={`p-10 rounded-[3rem] border-2 transition-all duration-500 animate-in slide-in-from-right-8 ${
              res.source === 'Logic' ? 'border-indigo-400 bg-indigo-50/20 shadow-xl' :
              res.level === ConfidenceLevel.AUTO_VERIFIED ? 'border-emerald-100 bg-emerald-50/10' : 
              res.level === ConfidenceLevel.REVIEW_NEEDED ? 'border-amber-100 bg-amber-50/10' : 
              'border-slate-50 bg-white shadow-sm'
            }`}>
              <div className="flex justify-between items-start mb-8 gap-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{res.category}</span>
                  <p className="text-2xl font-black text-slate-800 leading-tight tracking-tighter uppercase">{res.selection}</p>
                </div>
                <div className="text-right">
                  <div className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase flex items-center gap-2 border shadow-sm transition-all ${
                    res.source === 'Logic' ? 'bg-indigo-600 text-white border-indigo-700' :
                    res.level === ConfidenceLevel.AUTO_VERIFIED ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                    res.level === ConfidenceLevel.REVIEW_NEEDED ? 'bg-amber-100 text-amber-700 border-amber-200' :
                    'bg-slate-50 text-slate-500 border-slate-200'
                  }`}>
                    {res.source === 'Logic' ? <ShieldCheck size={14} /> : res.source === 'Learned' ? <History size={14} /> : <Sparkles size={14} />}
                    {res.source === 'Logic' ? 'Lab Verified' : res.source === 'Learned' ? 'Neural Match' : `${Math.round(res.confidence * 100)}% Match`}
                  </div>
                </div>
              </div>

              {res.matchedPart ? (
                <div className="p-8 bg-white rounded-[2.5rem] border border-slate-100 flex items-center justify-between shadow-2xl shadow-indigo-500/5 group hover:border-indigo-300 transition-all">
                  <div className="flex items-center gap-8">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner transition-all group-hover:scale-110 ${
                      res.source === 'Logic' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'
                    }`}>
                      <Binary size={28} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-lg font-black text-indigo-600 font-mono tracking-tighter block">{res.matchedPart.Part_Number}</span>
                      <span className="text-sm font-bold text-slate-600 uppercase tracking-tight">{res.matchedPart.Name}</span>
                      {res.logicFormula && (
                        <div className="flex items-center gap-2 mt-2">
                          <Zap size={10} className="text-amber-500 fill-amber-500" />
                          <p className="text-[9px] font-black text-indigo-400 uppercase tracking-tight">Priority Match: Synthesis Engine</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-[12px] font-black text-slate-300 uppercase tracking-widest">{res.matchedPart.Ref_des || 'GEN-001'}</div>
                </div>
              ) : (
                <div className="p-8 bg-red-50 text-red-400 text-[10px] font-black uppercase flex items-center gap-4 rounded-[2.5rem] border border-red-100 italic">
                  <AlertCircle size={24} /> Synthesis Required
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MOProvision;
