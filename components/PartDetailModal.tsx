
import React, { useState } from 'react';
import { BOMPart, ConfigRule, MachineKnowledge, LearningEntry } from '../types';
import { 
  X, 
  Save, 
  BrainCircuit, 
  Code2, 
  History, 
  Download, 
  Sparkles, 
  Settings2,
  FileJson,
  CheckCircle2,
  Cpu
} from 'lucide-react';

interface Props {
  part: BOMPart;
  rules: ConfigRule[];
  knowledgeBase: MachineKnowledge;
  onClose: () => void;
  onUpdate: (updated: BOMPart) => void;
}

const PartDetailModal: React.FC<Props> = ({ part, rules, knowledgeBase, onClose, onUpdate }) => {
  const [editedPart, setEditedPart] = useState<BOMPart>({ ...part });
  const [activeTab, setActiveTab] = useState<'details' | 'logic' | 'intelligence'>('details');

  // Find all learning entries across all models that feature this part number
  // Fix for Error in file components/PartDetailModal.tsx on line 32: Property 'filter' does not exist on type 'unknown'.
  // Casting Object.entries to provide explicit typing for the model-entries pairs.
  const learningHistory = (Object.entries(knowledgeBase) as [string, LearningEntry[]][]).reduce((acc, [model, entries]) => {
    const relevant = entries.filter(e => e.partNumber === part.Part_Number);
    if (relevant.length > 0) {
      acc.push(...relevant.map(e => ({ ...e, modelName: model })));
    }
    return acc;
  }, [] as (LearningEntry & { modelName: string })[]);

  const handleSave = () => {
    onUpdate(editedPart);
    alert("Part Specifications Updated Successfully");
  };

  const exportForLLM = () => {
    const llmContext = {
      part_identity: {
        number: part.Part_Number,
        name: part.Name,
        ref_des: part.Ref_des
      },
      engineering_constraints: rules.map(r => ({
        id: r.id,
        logic_raw: r.logic.raw,
        parsed: {
          requires: r.logic.includes,
          excludes: r.logic.excludes,
          or_logic: r.logic.orGroups
        }
      })),
      ai_learned_context: learningHistory.map(h => ({
        model: h.modelName,
        industry_category: h.category,
        order_specification: h.selection,
        confidence_hits: h.confirmedCount
      }))
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(llmContext, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `LLM_CONTEXT_${part.Part_Number}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const renderHighlightedLogic = (raw: string) => {
    const parts_arr = raw.split(/(\([^)]+\)|\[[^\]]+\])/g);
    return (
      <div className="flex flex-wrap gap-1.5 font-mono text-[10px] font-bold items-center">
        {parts_arr.map((p, i) => {
          if (p.startsWith('(')) return <span key={i} className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">{p}</span>;
          if (p.startsWith('[')) return <span key={i} className="bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200">{p}</span>;
          return p.split(/\s+/).map((word, j) => 
            word.length > 0 ? <span key={`${i}-${j}`} className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">{word}</span> : null
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-indigo-700 p-8 text-white flex justify-between items-start">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
              <Cpu size={32} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-black uppercase tracking-tighter">{part.Part_Number}</h3>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-widest ${
                  part.F_Code === 0 ? 'bg-white/10 border-white/20' : 
                  part.F_Code === 1 ? 'bg-emerald-500/20 border-emerald-400/30' : 
                  'bg-amber-500/20 border-amber-400/30'
                }`}>F-Code {part.F_Code}</span>
              </div>
              <p className="text-sm font-bold text-indigo-100 mt-1 uppercase opacity-80">{part.Name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={24} /></button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 px-8 bg-slate-50/50">
          {[
            { id: 'details', label: 'Specifications', icon: Settings2 },
            { id: 'logic', label: 'Engineering Logic', icon: Code2 },
            { id: 'intelligence', label: 'Neural Insights', icon: BrainCircuit },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-[0.15em] transition-all border-b-2 ${
                activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Part Name / Nomenclature</label>
                  <input 
                    type="text" 
                    value={editedPart.Name} 
                    onChange={e => setEditedPart({...editedPart, Name: e.target.value})}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reference Designator</label>
                    <input 
                      type="text" 
                      value={editedPart.Ref_des} 
                      onChange={e => setEditedPart({...editedPart, Ref_des: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-mono font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">F-Code (Functionality)</label>
                    <select 
                      value={editedPart.F_Code} 
                      onChange={e => setEditedPart({...editedPart, F_Code: parseInt(e.target.value)})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-indigo-500 focus:bg-white transition-all"
                    >
                      <option value={0}>0 - Default Item</option>
                      <option value={1}>1 - Optional Selection</option>
                      <option value={2}>2 - Mandatory Choice</option>
                      <option value={9}>9 - Reference Material</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Technical Intelligence / Remarks</label>
                  <textarea 
                    rows={4}
                    value={editedPart.Remarks} 
                    onChange={e => setEditedPart({...editedPart, Remarks: e.target.value})}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none"
                    placeholder="Enter engineering notes..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Standard Reference Remarks</label>
                  <input 
                    type="text" 
                    value={editedPart.Std_Remarks} 
                    onChange={e => setEditedPart({...editedPart, Std_Remarks: e.target.value})}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-[10px] font-black uppercase tracking-tight outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logic' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {rules.length === 0 ? (
                <div className="bg-slate-50 rounded-[2rem] p-12 text-center border-2 border-dashed border-slate-200">
                  <div className="w-16 h-16 bg-white rounded-2xl border flex items-center justify-center mx-auto mb-4 text-slate-300 shadow-sm">
                    <Code2 size={32} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Active Logic Defined for this SKU</p>
                </div>
              ) : (
                rules.map(rule => (
                  <div key={rule.id} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:border-indigo-200 transition-colors">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Sparkles size={12} /> Rule Definition
                      </span>
                      <span className="text-[9px] font-bold text-slate-300 font-mono">ID: {rule.id}</span>
                    </div>
                    {renderHighlightedLogic(rule.logic.raw)}
                    <div className="mt-4 grid grid-cols-3 gap-4">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Includes</p>
                        <p className="text-[10px] font-bold text-emerald-600">{rule.logic.includes.join(', ') || 'None'}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Excludes</p>
                        <p className="text-[10px] font-bold text-red-600">{rule.logic.excludes.join(', ') || 'None'}</p>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Alternates</p>
                        <p className="text-[10px] font-bold text-indigo-600">{rule.logic.orGroups.length > 0 ? `${rule.logic.orGroups.length} Groups` : 'None'}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'intelligence' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex gap-4">
                <BrainCircuit className="text-indigo-600 shrink-0" size={24} />
                <p className="text-[10px] text-indigo-700 font-bold leading-relaxed uppercase">
                  This part has been historically associated with specific machine configurations and factory orders. The AI engine uses these patterns to provide probabilistic matching.
                </p>
              </div>

              {learningHistory.length === 0 ? (
                <div className="bg-slate-50 rounded-[2rem] p-12 text-center border-2 border-dashed border-slate-200">
                  <History size={32} className="mx-auto mb-4 text-slate-300 opacity-40" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zero Historical Neural Matches Found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {learningHistory.map((h, i) => (
                    <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-widest">MODEL: {h.modelName}</span>
                        <div className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 size={12} />
                          <span className="text-[9px] font-black">{h.confirmedCount} Hits</span>
                        </div>
                      </div>
                      <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{h.category}</p>
                      <p className="text-xs font-bold text-slate-500 mt-1">{h.selection}</p>
                      <p className="text-[8px] text-slate-300 font-mono mt-3 uppercase">Last Confirmed: {new Date(h.lastUsed).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 p-8 border-t border-slate-100 flex justify-between items-center">
          <button 
            onClick={exportForLLM}
            className="flex items-center gap-3 px-6 py-3 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] transition-all shadow-sm"
          >
            <FileJson size={16} /> Export LLM Context
          </button>
          
          <div className="flex gap-4">
            <button 
              onClick={onClose}
              className="px-8 py-3 bg-white text-slate-400 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:text-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="flex items-center gap-3 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-lg shadow-indigo-200"
            >
              <Save size={16} /> Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartDetailModal;
