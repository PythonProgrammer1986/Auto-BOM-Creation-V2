import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BOMPart, ConfigRule, AppScreen, MachineKnowledge, TechnicalGlossary } from './types';
import BOMTable from './components/BOMTable';
import ConfigScreen from './components/ConfigScreen';
import SelectionScreen from './components/SelectionScreen';
import BOMGenerated from './components/BOMGenerated';
import MOProvision from './components/MOProvision';
import NeuralAcademy from './components/NeuralAcademy';
import { LayoutDashboard, Settings2, CheckSquare, FileText, Database, FileStack, BrainCircuit, Download, Upload, ShieldAlert, Key, GraduationCap } from 'lucide-react';

const DEFAULT_GLOSSARY: TechnicalGlossary = {
  'CAB': 'CABIN ASSEMBLY',
  'HYD': 'HYDRAULIC',
  'ENG': 'ENGINE',
  'AC': 'AIR CONDITIONING',
  'STD': 'STANDARD',
  'W/': 'WITH',
  'W/O': 'WITHOUT',
  'ASSY': 'ASSEMBLY',
  'OPT': 'OPTIONAL',
  'CAN': 'CANOPY'
};

const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<AppScreen>(AppScreen.BOM_TABLE);
  const [parts, setParts] = useState<BOMPart[]>([]);
  const [rules, setRules] = useState<ConfigRule[]>([]);
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(new Set());
  const [knowledgeBase, setKnowledgeBase] = useState<MachineKnowledge>({});
  const [glossary, setGlossary] = useState<TechnicalGlossary>(DEFAULT_GLOSSARY);
  const [currentMOModel, setCurrentMOModel] = useState<string>('Generic');
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('user_api_key') || '');
  
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const savedParts = localStorage.getItem('bom_parts');
      const savedRules = localStorage.getItem('bom_rules');
      const savedSelections = localStorage.getItem('bom_selections');
      const savedKB = localStorage.getItem('bom_knowledge_base');
      const savedGlossary = localStorage.getItem('bom_glossary');
      
      if (savedParts) setParts(JSON.parse(savedParts));
      if (savedRules) setRules(JSON.parse(savedRules));
      if (savedSelections) setSelectedPartIds(new Set(JSON.parse(savedSelections)));
      if (savedKB) setKnowledgeBase(JSON.parse(savedKB));
      if (savedGlossary) setGlossary(JSON.parse(savedGlossary));
    } catch (e) {
      console.error("Storage loading error:", e);
    }
  }, []);

  const persist = useCallback((key: string, data: any) => {
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
      } catch (e) {
        console.warn("Storage write failure:", e);
      }
    }, 800);
  }, []);

  const handleUpdateApiKey = (newKey: string) => {
    setApiKey(newKey);
    localStorage.setItem('user_api_key', newKey);
  };

  const handleUpdateKnowledgeBase = (newKB: MachineKnowledge) => {
    setKnowledgeBase(newKB);
    persist('bom_knowledge_base', newKB);
  };

  const onFinalizeAndLearn = (mappings: {category: string, selection: string, partNumber: string}[]) => {
    if (!currentMOModel || currentMOModel === 'Generic') return;

    setKnowledgeBase(prev => {
      const newKB = { ...prev };
      const modelEntries = [...(newKB[currentMOModel] || [])];

      mappings.forEach(map => {
        const existing = modelEntries.find(e => e.category === map.category && e.selection === map.selection);
        if (existing) {
          existing.partNumber = map.partNumber;
          existing.confirmedCount += 1;
          existing.lastUsed = new Date().toISOString();
        } else {
          modelEntries.push({ ...map, confirmedCount: 1, lastUsed: new Date().toISOString() });
        }
      });

      newKB[currentMOModel] = modelEntries;
      persist('bom_knowledge_base', newKB);
      return newKB;
    });
  };

  const exportBrain = () => {
    const exportData = {
      knowledgeBase,
      glossary,
      timestamp: new Date().toISOString(),
      version: "2.0"
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `BOM_Intelligence_Base_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importBrain = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target?.result as string);
        
        // Handle both full brain exports and individual model weights
        const newKB = imported.knowledgeBase || (imported.modelName ? imported.knowledgeBase : imported);
        const newGlossary = imported.glossary || glossary;

        const updatedKB = { ...knowledgeBase, ...newKB };
        setKnowledgeBase(updatedKB);
        setGlossary(newGlossary);
        
        persist('bom_knowledge_base', updatedKB);
        persist('bom_glossary', newGlossary);
        
        alert(`Successfully imported ${imported.modelName ? `weights for [${imported.modelName}]` : 'entire brain network'}.`);
      } catch (e) {
        alert("Invalid Intelligence File Schema.");
      }
    };
    reader.readAsText(file);
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case AppScreen.BOM_TABLE:
        return (
          <BOMTable 
            parts={parts} 
            onPartsUpdate={p => { setParts(p); persist('bom_parts', p); }} 
            onRulesUpdate={r => { setRules(r); persist('bom_rules', r); }} 
            existingRules={rules} 
            knowledgeBase={knowledgeBase}
            onNavigate={() => setActiveScreen(AppScreen.CONFIG)} 
            onClearAll={() => { localStorage.clear(); window.location.reload(); }} 
          />
        );
      case AppScreen.CONFIG:
        return (
          <ConfigScreen 
            rules={rules} 
            onRulesUpdate={r => { setRules(r); persist('bom_rules', r); }} 
            parts={parts} 
            glossary={glossary}
            onGlossaryUpdate={g => { setGlossary(g); persist('bom_glossary', g); }}
            apiKey={apiKey}
            onApiKeyUpdate={handleUpdateApiKey}
            knowledgeBase={knowledgeBase}
            onKnowledgeBaseUpdate={handleUpdateKnowledgeBase}
          />
        );
      case AppScreen.MO_PROVISION:
        return (
          <MOProvision 
            parts={parts} 
            knowledgeBase={knowledgeBase}
            glossary={glossary}
            apiKey={apiKey}
            onModelDetected={setCurrentMOModel}
            onAutoSelect={(newIds) => {
              const updated = new Set([...selectedPartIds, ...Array.from(newIds)]);
              setSelectedPartIds(updated);
              persist('bom_selections', Array.from(updated));
            }} 
            onNavigateToSelection={() => setActiveScreen(AppScreen.SELECTION)}
          />
        );
      case AppScreen.NEURAL_ACADEMY:
        return (
          <NeuralAcademy 
            knowledgeBase={knowledgeBase}
            onKnowledgeBaseUpdate={handleUpdateKnowledgeBase}
            apiKey={apiKey}
            parts={parts}
            rules={rules}
            onRulesUpdate={r => { setRules(r); persist('bom_rules', r); }}
            glossary={glossary}
          />
        );
      case AppScreen.SELECTION:
        return <SelectionScreen parts={parts} rules={rules} selectedIds={selectedPartIds} onSelectionChange={ids => { setSelectedPartIds(ids); persist('bom_selections', Array.from(ids)); }} onGenerate={() => setActiveScreen(AppScreen.BOM_GENERATED)} />;
      case AppScreen.BOM_GENERATED:
        return <BOMGenerated parts={parts} selectedIds={selectedPartIds} modelName={currentMOModel} onFinalizeKnowledge={onFinalizeAndLearn} />;
      default:
        return null;
    }
  };

  const effectiveApiKey = apiKey || process.env.API_KEY;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <header className="bg-indigo-700 text-white p-4 shadow-xl sticky top-0 z-50">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveScreen(AppScreen.BOM_TABLE)}>
            <div className="p-2 bg-white/10 rounded-xl"><Database className="w-6 h-6" /></div>
            <h1 className="text-xl font-black uppercase tracking-tighter">BOM Pro <span className="text-indigo-300">Intel</span></h1>
          </div>
          <nav className="flex bg-indigo-900/40 backdrop-blur-md rounded-2xl p-1.5 border border-white/10">
            {[
              { id: AppScreen.BOM_TABLE, label: 'Table', icon: LayoutDashboard },
              { id: AppScreen.CONFIG, label: 'Logic', icon: Settings2 },
              { id: AppScreen.NEURAL_ACADEMY, label: 'Academy', icon: GraduationCap },
              { id: AppScreen.MO_PROVISION, label: 'MO Intel', icon: FileStack },
              { id: AppScreen.SELECTION, label: 'Configure', icon: CheckSquare },
              { id: AppScreen.BOM_GENERATED, label: 'Output', icon: FileText },
            ].map((item) => (
              <button key={item.id} onClick={() => setActiveScreen(item.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all text-xs font-black uppercase tracking-widest ${activeScreen === item.id ? 'bg-white text-indigo-700 shadow-lg' : 'text-indigo-100 hover:text-white'}`}>
                <item.icon size={14} /> <span className="hidden lg:inline">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 md:p-8">
        <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 min-h-[650px] overflow-hidden relative">
          {(!effectiveApiKey && (activeScreen === AppScreen.MO_PROVISION || activeScreen === AppScreen.NEURAL_ACADEMY)) && (
            <div className="absolute inset-0 z-[60] bg-white/80 backdrop-blur-md flex items-center justify-center p-8">
              <div className="bg-white border-2 border-amber-200 p-12 rounded-[3rem] shadow-2xl max-w-md w-full text-center space-y-6">
                <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500">
                  <Key size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Intelligence Connection Required</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed uppercase">To process Factory Orders using AI, you must provide a Gemini API Key. This can be permanently configured in the Logic section.</p>
                </div>
                <button 
                  onClick={() => setActiveScreen(AppScreen.CONFIG)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl text-xs uppercase tracking-widest"
                >
                  Configure Connection
                </button>
              </div>
            </div>
          )}
          {renderScreen()}
        </div>
      </main>
      <footer className="bg-white border-t p-6">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center px-4 gap-4">
          <div className="flex items-center gap-4">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Offline Intelligence: {Object.keys(knowledgeBase).length} Models | {Object.keys(glossary).length} Synonyms</p>
            <div className="flex gap-2">
              <button onClick={exportBrain} className="text-[10px] font-black uppercase bg-slate-50 hover:bg-slate-100 text-slate-500 px-3 py-1 rounded-md border flex items-center gap-1 transition-all"><Download size={10} /> Export Brain</button>
              <label className="text-[10px] font-black uppercase bg-slate-50 hover:bg-slate-100 text-slate-500 px-3 py-1 rounded-md border flex items-center gap-1 transition-all cursor-pointer"><Upload size={10} /> Import Brain<input type="file" className="hidden" onChange={importBrain} /></label>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Created By: Aditya Shitut</p>
            </div>
            <div className="flex items-center gap-3">
              {effectiveApiKey ? (
                <div className="flex items-center gap-2 text-emerald-500 text-[9px] font-black uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                  <ShieldAlert size={10} /> Neural Link Active
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-500 text-[9px] font-black uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                  <ShieldAlert size={10} /> Neural Link Pending
                </div>
              )}
              <BrainCircuit className="text-indigo-300 animate-pulse" size={20} />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;