
import React, { useState, useRef } from 'react';
import { ConfigRule, BOMPart, RuleLogic, TechnicalGlossary, MachineKnowledge, LearningEntry } from '../types';
import { Settings, Plus, X, Edit3, Save, Search, Wand2, Book, Trash2, ShieldCheck, Key, Info, FileSpreadsheet, Download, Upload } from 'lucide-react';

interface Props {
  rules: ConfigRule[];
  onRulesUpdate: (rules: ConfigRule[]) => void;
  parts: BOMPart[];
  glossary: TechnicalGlossary;
  onGlossaryUpdate: (glossary: TechnicalGlossary) => void;
  apiKey: string;
  onApiKeyUpdate: (key: string) => void;
  knowledgeBase: MachineKnowledge;
  onKnowledgeBaseUpdate: (kb: MachineKnowledge) => void;
}

const ConfigScreen: React.FC<Props> = ({ rules, onRulesUpdate, parts, glossary, onGlossaryUpdate, apiKey, onApiKeyUpdate, knowledgeBase, onKnowledgeBaseUpdate }) => {
  const [activeTab, setActiveTab] = useState<'logic' | 'glossary' | 'system'>('logic');
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [newRule, setNewRule] = useState({ targetPartId: '', keywordString: '' });
  const [newSynonym, setNewSynonym] = useState({ abbr: '', full: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [tempKey, setTempKey] = useState(apiKey);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Allow F_Code 1, 2, and 9 for manual logic setup
  const selectableParts = parts.filter(p => p.F_Code === 1 || p.F_Code === 2 || p.F_Code === 9);

  const parseLogicString = (str: string): RuleLogic => {
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

  const handleExportIntel = () => {
    if (rules.length === 0 && Object.keys(knowledgeBase).length === 0) {
      alert("No data available to export.");
      return;
    }

    const logicData = rules.map(r => {
      const part = parts.find(p => p.id === r.targetPartId);
      return {
        Part_Number: part?.Part_Number || 'Unknown',
        Part_Name: part?.Name || '',
        Logic_Expression: r.logic.raw,
        Is_Active: r.isActive ? 'YES' : 'NO'
      };
    });

    const intelData = (Object.entries(knowledgeBase) as [string, LearningEntry[]][]).flatMap(([model, entries]) => 
      entries.map(e => ({
        Machine_Model: model,
        Part_Number: e.partNumber,
        Category: e.category,
        Selection_Text: e.selection,
        Hits: e.confirmedCount,
        Last_Used: e.lastUsed
      }))
    );

    const wb = (window as any).XLSX.utils.book_new();
    const wsLogic = (window as any).XLSX.utils.json_to_sheet(logicData);
    const wsIntel = (window as any).XLSX.utils.json_to_sheet(intelData);

    (window as any).XLSX.utils.book_append_sheet(wb, wsLogic, "Engineering Logic");
    (window as any).XLSX.utils.book_append_sheet(wb, wsIntel, "Neural Insights");

    (window as any).XLSX.writeFile(wb, `BOM_Intelligence_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleImportIntel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = (window as any).XLSX.read(bstr, { type: 'binary' });
        
        if (wb.SheetNames.includes("Engineering Logic")) {
          const logicRows = (window as any).XLSX.utils.sheet_to_json(wb.Sheets["Engineering Logic"]);
          const newRules: ConfigRule[] = [...rules];
          
          logicRows.forEach((row: any) => {
            const part = parts.find(p => p.Part_Number === String(row.Part_Number));
            if (!part) return;

            const logic = parseLogicString(String(row.Logic_Expression || ''));
            const existingIdx = newRules.findIndex(r => r.targetPartId === part.id);
            
            if (existingIdx !== -1) {
              newRules[existingIdx].logic = logic;
            } else {
              newRules.push({
                id: `rule-${Date.now()}-${Math.random()}`,
                targetPartId: part.id,
                logic: logic,
                isActive: String(row.Is_Active).toUpperCase() === 'YES'
              });
            }
          });
          onRulesUpdate(newRules);
        }

        if (wb.SheetNames.includes("Neural Insights")) {
          const intelRows = (window as any).XLSX.utils.sheet_to_json(wb.Sheets["Neural Insights"]);
          const newKB: MachineKnowledge = { ...knowledgeBase };

          intelRows.forEach((row: any) => {
            const model = String(row.Machine_Model || 'Generic');
            if (!newKB[model]) newKB[model] = [];
            
            const entry: LearningEntry = {
              partNumber: String(row.Part_Number),
              category: String(row.Category),
              selection: String(row.Selection_Text),
              confirmedCount: parseInt(row.Hits) || 1,
              lastUsed: row.Last_Used || new Date().toISOString()
            };

            const existingIdx = newKB[model].findIndex(e => e.category === entry.category && e.selection === entry.selection && e.partNumber === entry.partNumber);
            if (existingIdx !== -1) {
              newKB[model][existingIdx] = entry;
            } else {
              newKB[model].push(entry);
            }
          });
          onKnowledgeBaseUpdate(newKB);
        }

        alert("Intelligence Repository Synchronized Successfully");
      } catch (err) {
        console.error(err);
        alert("Sync Error: The Excel format does not match the required intelligence schema.");
      }
    };
    reader.readAsBinaryString(file);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const renderHighlightedLogic = (raw: string) => {
    const parts_arr = raw.split(/(\([^)]+\)|\[[^\]]+\])/g);
    return (
      <div className="flex flex-wrap gap-1.5 font-mono text-xs font-bold items-center">
        {parts_arr.map((p, i) => {
          if (p.startsWith('(')) return <span key={i} className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200 shadow-sm">{p}</span>;
          if (p.startsWith('[')) return <span key={i} className="bg-red-100 text-red-700 px-2 py-0.5 rounded-md border border-red-200 shadow-sm">{p}</span>;
          return p.split(/\s+/).map((word, j) => 
            word.length > 0 ? <span key={`${i}-${j}`} className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 shadow-sm">{word}</span> : null
          );
        })}
      </div>
    );
  };

  const addSynonym = () => {
    if (!newSynonym.abbr || !newSynonym.full) return;
    const updated = { ...glossary, [newSynonym.abbr.toUpperCase()]: newSynonym.full.toUpperCase() };
    onGlossaryUpdate(updated);
    setNewSynonym({ abbr: '', full: '' });
  };

  const removeSynonym = (key: string) => {
    const updated = { ...glossary };
    delete updated[key];
    onGlossaryUpdate(updated);
  };

  const handleSaveRule = () => {
    if (!newRule.targetPartId || !newRule.keywordString) {
      alert('Please select a target part and enter keywords.');
      return;
    }

    if (editingRuleId) {
      const updatedRules = rules.map(rule => {
        if (rule.id === editingRuleId) {
          return {
            ...rule,
            targetPartId: newRule.targetPartId,
            logic: parseLogicString(newRule.keywordString)
          };
        }
        return rule;
      });
      onRulesUpdate(updatedRules);
      setEditingRuleId(null);
    } else {
      const rule: ConfigRule = {
        id: `rule-${Date.now()}`,
        targetPartId: newRule.targetPartId,
        logic: parseLogicString(newRule.keywordString),
        isActive: true
      };
      onRulesUpdate([...rules, rule]);
    }
    setNewRule({ targetPartId: '', keywordString: '' });
  };

  const handleEditClick = (rule: ConfigRule) => {
    setEditingRuleId(rule.id);
    setNewRule({
      targetPartId: rule.targetPartId,
      keywordString: rule.logic.raw
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingRuleId(null);
    setNewRule({ targetPartId: '', keywordString: '' });
  };

  const handleSaveApiKey = () => {
    onApiKeyUpdate(tempKey);
    alert("System Configuration Updated Permanently.");
  };

  const filteredRules = rules.filter(r => {
    const part = parts.find(p => p.id === r.targetPartId);
    if (!part) return false;
    const search = searchTerm.toLowerCase();
    return (
      part.Part_Number.toLowerCase().includes(search) ||
      part.Name.toLowerCase().includes(search) ||
      r.logic.raw.toLowerCase().includes(search)
    );
  });

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-8">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Settings className="text-indigo-600" />
              Intelligence Center
            </h2>
            <div className="flex gap-4 mt-2">
               <button onClick={() => setActiveTab('logic')} className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === 'logic' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Engineering Logic</button>
               <button onClick={() => setActiveTab('glossary')} className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === 'glossary' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Semantic Dictionary</button>
               <button onClick={() => setActiveTab('system')} className={`text-[10px] font-black uppercase tracking-widest pb-1 border-b-2 transition-all ${activeTab === 'system' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>System Config</button>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {activeTab === 'logic' && (
            <>
              <input type="file" ref={importFileRef} onChange={handleImportIntel} accept=".xlsx,.xls" className="hidden" />
              <button onClick={() => importFileRef.current?.click()} className="bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-black border border-slate-200 transition-all shadow-sm">
                <Upload size={14} /> Import Intel (Excel)
              </button>
              <button onClick={handleExportIntel} className="bg-slate-50 hover:bg-slate-100 text-slate-600 px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-black border border-slate-200 transition-all shadow-sm">
                <Download size={14} /> Export Intel (Excel)
              </button>
              <button onClick={() => {}} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-black border border-emerald-200 transition-all shadow-sm">
                <Wand2 size={14} /> Smart Auto-Generate
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-6 overflow-auto">
        {activeTab === 'logic' && (
          <div className="space-y-6">
            <div className={`bg-white border rounded-3xl p-8 shadow-sm transition-all ${editingRuleId ? 'border-amber-400 ring-4 ring-amber-500/5' : 'border-slate-200'}`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  {editingRuleId ? 'Modify Engineering Rule' : 'New Dependency Definition'}
                </h3>
                {editingRuleId && (
                  <button onClick={cancelEdit} className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-3 py-1 rounded-full hover:bg-amber-100 transition-colors flex items-center gap-1">
                    <X size={10} /> Cancel Editing
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                <div className="md:col-span-4 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Target Component (SKU)</label>
                  <select 
                    value={newRule.targetPartId}
                    onChange={(e) => setNewRule({...newRule, targetPartId: e.target.value})}
                    className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all bg-slate-50/50"
                  >
                    <option value="">Select SKU...</option>
                    {selectableParts.map(p => <option key={p.id} value={p.id}>{p.Ref_des || '??'} | {p.Part_Number} — {p.Name} (F{p.F_Code})</option>)}
                  </select>
                </div>
                <div className="md:col-span-6 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Trigger Expression</label>
                  <input 
                    type="text"
                    placeholder="(CAB/CAN) STD [TT BT]"
                    value={newRule.keywordString}
                    onChange={(e) => setNewRule({...newRule, keywordString: e.target.value})}
                    className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all bg-slate-50/50"
                  />
                </div>
                <div className="md:col-span-2">
                  <button onClick={handleSaveRule} className={`w-full font-black py-4 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl text-xs uppercase tracking-widest ${editingRuleId ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
                    {editingRuleId ? <Save size={18} /> : <Plus size={18} />}
                    {editingRuleId ? 'Update Rule' : 'Add Rule'}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
               <div className="px-8 py-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-[0.15em]">Active Engineering Logic ({filteredRules.length})</h3>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input type="text" placeholder="Filter rules..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl outline-none bg-white focus:ring-4 focus:ring-slate-100 transition-all" />
                  </div>
               </div>
               <div className="divide-y divide-slate-100">
                  {filteredRules.length === 0 ? (
                    <div className="p-24 text-center text-slate-300 font-black uppercase tracking-widest text-xs">No Logic Matches Found</div>
                  ) : filteredRules.map(rule => {
                    const part = parts.find(p => p.id === rule.targetPartId);
                    return (
                      <div key={rule.id} className={`p-6 flex items-center justify-between hover:bg-slate-50 transition-colors ${editingRuleId === rule.id ? 'bg-amber-50/50' : ''}`}>
                         <div className="flex flex-col flex-1">
                            <span className="text-[10px] font-black text-indigo-600 font-mono">PN: {part?.Part_Number}</span>
                            <span className="text-xs font-bold text-slate-800">{part?.Name}</span>
                         </div>
                         <div className="flex-[2] px-4">
                           {renderHighlightedLogic(rule.logic.raw)}
                         </div>
                         <div className="flex gap-4">
                           <button onClick={() => handleEditClick(rule)} className="text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
                             <Edit3 size={16} /> Edit
                           </button>
                           <button onClick={() => onRulesUpdate(rules.filter(r => r.id !== rule.id))} className="text-slate-300 hover:text-red-500 transition-colors">
                             <Trash2 size={18} />
                           </button>
                         </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'glossary' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">Add Semantic Synonym</h3>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                <div className="md:col-span-3 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Abbreviation / Key</label>
                  <input type="text" placeholder="e.g. CAB" value={newSynonym.abbr} onChange={(e) => setNewSynonym({...newSynonym, abbr: e.target.value})} className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500/50 bg-slate-50/50" />
                </div>
                <div className="md:col-span-7 space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Full Technical nomenclature</label>
                  <input type="text" placeholder="e.g. CABIN ASSEMBLY" value={newSynonym.full} onChange={(e) => setNewSynonym({...newSynonym, full: e.target.value})} className="w-full border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500/5 bg-slate-50/50" />
                </div>
                <div className="md:col-span-2">
                  <button onClick={addSynonym} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl text-xs uppercase tracking-widest">
                    <Book size={18} /> Register
                  </button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(glossary).map(([abbr, full]) => (
                <div key={abbr} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex justify-between items-center group hover:border-indigo-200 transition-all">
                  <div>
                    <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md uppercase tracking-widest">{abbr}</span>
                    <p className="text-xs font-black text-slate-800 mt-1 uppercase tracking-tight">{full}</p>
                  </div>
                  <button onClick={() => removeSynonym(abbr)} className="text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><X size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="max-w-2xl mx-auto space-y-8 py-10">
            <div className="bg-white border border-slate-200 rounded-[3rem] p-10 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 text-indigo-100">
                  <ShieldCheck size={120} />
               </div>
               <div className="relative z-10 space-y-8">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                      <Key className="text-indigo-600" /> Intelligence Link
                    </h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Connect to Gemini 3 for Advanced Neural Processing</p>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Gemini API Key (Persistent)</label>
                      <input 
                        type="password" 
                        placeholder="Paste your API key here..." 
                        value={tempKey} 
                        onChange={(e) => setTempKey(e.target.value)}
                        className="w-full border-2 border-slate-100 rounded-2xl p-5 text-sm font-mono outline-none focus:border-indigo-500 focus:bg-white transition-all bg-slate-50 shadow-inner"
                      />
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex gap-4">
                      <div className="p-2 bg-white rounded-lg border text-indigo-600 h-fit">
                        <Info size={16} />
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold leading-relaxed uppercase">
                        This key is stored locally in your browser's persistent storage. It is never transmitted to our servers—it is used directly to call the Gemini API from your device.
                      </p>
                    </div>

                    <button 
                      onClick={handleSaveApiKey}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl text-xs uppercase tracking-widest"
                    >
                      <Save size={18} /> Update Secure Connection
                    </button>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigScreen;
