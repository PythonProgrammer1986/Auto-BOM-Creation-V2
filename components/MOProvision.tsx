import React, { useState, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { BOMPart, MachineKnowledge, ConfidenceLevel, TechnicalGlossary } from '../types';
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
  Book
} from 'lucide-react';

interface AIResponse {
  model?: string;
  options?: { category: string; selection: string; quantity: string }[];
}

interface Props {
  parts: BOMPart[];
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
  source: 'Learned' | 'Hybrid' | 'AI' | 'Partial' | 'None';
}

interface IndexedPart {
  part: BOMPart;
  tokens: Set<string>;
  pn: string;
  ref: string;
}

const STOP_WORDS = new Set(['WITH', 'AND', 'THE', 'FOR', 'NON', 'NONE', 'SELECTED', 'UNIT', 'OPTIONS']);

const MOProvision: React.FC<Props> = ({ parts, knowledgeBase, glossary, apiKey, onAutoSelect, onModelDetected, onNavigateToSelection }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modelName, setModelName] = useState('Generic');

  const partIndex: IndexedPart[] = useMemo(() => {
    return parts.map(p => {
      let technicalSource = `${p.Name} ${p.Remarks} ${p.Std_Remarks} ${p.Ref_des}`.toUpperCase();
      (Object.entries(glossary) as [string, string][]).forEach(([abbr, full]) => {
        if (technicalSource.includes(abbr)) technicalSource += ` ${full}`;
      });
      return {
        part: p,
        tokens: new Set(technicalSource.split(/[\s,./()]+/).filter(s => s.length > 2 && !STOP_WORDS.has(s))),
        pn: p.Part_Number.toUpperCase(),
        ref: p.Ref_des.toUpperCase()
      };
    });
  }, [parts, glossary]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const effectiveApiKey = apiKey || process.env.API_KEY;

    if (!files || files.length === 0 || parts.length === 0) return;
    if (!effectiveApiKey) {
      setError("Connection Failure: No API Key Configured.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
      const resultsBatch: MatchResult[] = [];
      let detectedModel = 'Generic';

      const filePromises = (Array.from(files) as File[]).map(async (file) => {
        const base64 = await new Promise<string>((res) => {
          const r = new FileReader();
          r.onload = () => {
            const result = r.result;
            if (typeof result === 'string') {
              res(result.split(',')[1] || '');
            } else {
              res('');
            }
          };
          r.readAsDataURL(file);
        });

        const prompt = `
          ACT AS AN ENGINEERING DATA EXTRACTOR.
          1. Identify Machine Model (e.g. D65P-16, PC300).
          2. Extract the Configuration Table (Columns: Name/Category, Option/Selection, Quantity).
          IGNORE noise rows like "No option selected".
          RETURN STRICT JSON: {"model": "string", "options": [{"category": "string", "selection": "string", "quantity": "string"}]}
        `;

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: file.type, data: base64 } }
            ]
          },
          config: { responseMimeType: "application/json" }
        });

        return JSON.parse(response.text || '{}') as AIResponse;
      });

      const pages = await Promise.all(filePromises);
      const models = pages.map(p => p.model).filter(m => !!m && m !== 'Generic');
      if (models.length > 0) {
        detectedModel = models[0]!.toUpperCase();
        setModelName(detectedModel);
        onModelDetected(detectedModel);
      }

      const allOptions = pages.flatMap(p => p.options || []);
      const modelHistory = knowledgeBase[detectedModel] || [];
      const matchedIds = new Set<string>();

      allOptions.forEach(opt => {
        const queryRaw = `${opt.category} ${opt.selection}`.toUpperCase();
        let queryTokens = queryRaw.split(/[\s,./()]+/).filter(s => s.length > 2 && !STOP_WORDS.has(s));
        (Object.entries(glossary) as [string, string][]).forEach(([abbr, full]) => {
          if (queryRaw.includes(abbr)) queryTokens.push(...full.split(' '));
        });
        const queryTokenSet = new Set(queryTokens);
        const catTokens = new Set(opt.category.toUpperCase().split(/[\s,./()]+/));

        let bestMatch: IndexedPart | null = null;
        let topScore = 0;
        let finalSource: MatchResult['source'] = 'None';

        partIndex.forEach(ip => {
          let score = 0;
          if (queryRaw.includes(ip.pn)) score = 1.1;
          const isLearned = modelHistory.some(h => h.category === opt.category && h.selection === opt.selection && h.partNumber === ip.pn);
          if (isLearned) score = Math.max(score, 1.0);
          let semanticHits = 0;
          queryTokenSet.forEach(t => { if (ip.tokens.has(t)) semanticHits++; });
          const semanticScore = queryTokenSet.size > 0 ? (semanticHits / queryTokenSet.size) * 0.7 : 0;
          score = Math.max(score, semanticScore);
          if (ip.ref && catTokens.has(ip.ref)) score += 0.2;
          if (score > topScore) { topScore = score; bestMatch = ip; }
        });

        let level = ConfidenceLevel.UNCERTAIN;
        if (topScore >= 0.9) {
          level = ConfidenceLevel.AUTO_VERIFIED;
          finalSource = modelHistory.some(h => h.partNumber === bestMatch?.pn) ? 'Learned' : 'AI';
        } else if (topScore >= 0.5) {
          level = ConfidenceLevel.REVIEW_NEEDED;
          finalSource = 'Hybrid';
        }

        if (bestMatch && topScore >= 0.6) matchedIds.add(bestMatch.part.id);
        resultsBatch.push({ ...opt, matchedPart: bestMatch?.part, confidence: Math.min(topScore, 1.0), level, source: finalSource });
      });

      setResults(resultsBatch.sort((a, b) => b.confidence - a.confidence));
      if (matchedIds.size > 0) onAutoSelect(matchedIds);
    } catch (err) {
      console.error(err);
      setError("Intelligence Engine Error: Please verify your API Key and connection.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {error && (
        <div className="bg-red-50 border-2 border-red-100 p-4 rounded-2xl flex items-center gap-4 text-red-600 animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={20} />
          <p className="text-xs font-black uppercase tracking-widest">{error}</p>
        </div>
      )}
      <div className="flex justify-between items-end border-b pb-8">
        <div className="space-y-2">
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
            <FileStack className="text-indigo-600" size={32} /> Automated MO Provisioning 
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              <Brain className="text-emerald-500" size={14} />
              <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Model: {modelName}</span>
            </div>
            <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              <History className="text-indigo-500" size={14} />
              <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">{results.filter(r => r.source === 'Learned').length} Learned Matches</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
              <Book className="text-slate-400" size={14} />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dictionary Active</span>
            </div>
          </div>
        </div>
        {results.length > 0 && (
          <button onClick={onNavigateToSelection} className="bg-indigo-600 text-white px-10 py-4 rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-indigo-700 transition-all flex items-center gap-3">
            Enter Validation Hub <ArrowRight size={20} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-6">
          <div className="relative border-4 border-dashed border-slate-100 rounded-[3rem] p-12 flex flex-col items-center justify-center bg-white hover:border-indigo-200 transition-all min-h-[450px] shadow-sm">
            <input type="file" multiple accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-20" />
            {isProcessing ? (
              <div className="flex flex-col items-center gap-6">
                <Loader2 className="w-20 h-20 text-indigo-600 animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 animate-pulse">Running Neural Fusion...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="p-8 bg-slate-50 rounded-full">
                  <Upload className="w-16 h-16 text-slate-300" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-700">Scan Factory Order</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-2 px-10 leading-relaxed uppercase tracking-tighter">Probabilistic matching uses historical patterns and engineering glossary</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6 max-h-[800px] overflow-auto pr-4 scroll-smooth">
          {results.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-200 gap-6 opacity-40 py-40">
                <SearchCode size={80} />
                <p className="text-[10px] font-black uppercase tracking-[0.5em]">Awaiting Order Input</p>
             </div>
          ) : results.map((res, i) => (
            <div key={i} className={`p-8 rounded-[2.5rem] border-2 transition-all duration-300 ${
              res.level === ConfidenceLevel.AUTO_VERIFIED ? 'border-emerald-100 bg-emerald-50/10' : 
              res.level === ConfidenceLevel.REVIEW_NEEDED ? 'border-amber-100 bg-amber-50/10' : 
              'border-slate-50 bg-white'
            }`}>
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{res.category}</span>
                  <p className="text-xl font-black text-slate-800 leading-tight tracking-tight">{res.selection}</p>
                </div>
                <div className="text-right">
                  <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase flex items-center gap-2 border shadow-sm ${
                    res.level === ConfidenceLevel.AUTO_VERIFIED ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                    res.level === ConfidenceLevel.REVIEW_NEEDED ? 'bg-amber-100 text-amber-700 border-amber-200' :
                    'bg-slate-50 text-slate-500 border-slate-200'
                  }`}>
                    {res.source === 'Learned' ? <History size={12} /> : <Sparkles size={12} />}
                    {res.source === 'Learned' ? 'Confidence: HIGH (Learned)' : `${Math.round(res.confidence * 100)}% Confidence`}
                  </div>
                </div>
              </div>

              {res.matchedPart ? (
                <div className="p-6 bg-white rounded-3xl border border-slate-100 flex items-center justify-between shadow-lg shadow-indigo-500/5 group hover:border-indigo-200 transition-colors">
                  <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${
                      res.level === ConfidenceLevel.AUTO_VERIFIED ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'
                    }`}>
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <span className="text-sm font-black text-indigo-600 font-mono tracking-tighter block">{res.matchedPart.Part_Number}</span>
                      <span className="text-xs font-bold text-slate-500 uppercase">{res.matchedPart.Name}</span>
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{res.matchedPart.Ref_des || 'GEN'}</div>
                </div>
              ) : (
                <div className="p-6 bg-red-50/30 text-red-400 text-[10px] font-black uppercase flex items-center gap-3 italic rounded-3xl border border-red-50">
                  <AlertCircle size={20} /> Zero technical correlation discovered for this specification
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