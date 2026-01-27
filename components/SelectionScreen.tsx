
import React, { useMemo, useCallback, useState } from 'react';
import { BOMPart, ConfigRule } from '../types';
import { 
  CheckSquare, 
  Hash, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Search, 
  Check,
  Zap,
  Star,
  Award
} from 'lucide-react';

interface Props {
  parts: BOMPart[];
  rules: ConfigRule[];
  selectedIds: Set<string>; 
  moSelectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onGenerate: () => void;
}

const SelectionScreen: React.FC<Props> = ({ parts, rules, selectedIds, moSelectedIds, onSelectionChange, onGenerate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // F_Code 1, 2, and 9 are all treated as configurable items
  const configParts = useMemo(() => parts.filter(p => p.F_Code === 1 || p.F_Code === 2 || p.F_Code === 9), [parts]);

  // Solver for identifying parts recommended by active engineering logic (Priority 2)
  const logicSelectedIds = useMemo(() => {
    const currentLogicSelected = new Set<string>();
    let changed = true;
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    const tokenize = (p: BOMPart) => 
      new Set(`${p.Part_Number} ${p.Name} ${p.Remarks} ${p.Std_Remarks}`.toUpperCase().split(/[\s,._+/()\[\]]+/).filter(s => s.length > 0));

    const baseTokens = new Set<string>();
    parts.filter(p => p.F_Code === 0).forEach(p => tokenize(p).forEach(t => baseTokens.add(t)));

    while (changed && iterations < MAX_ITERATIONS) {
      changed = false;
      iterations++;

      const currentContextTokens = new Set(baseTokens);
      parts.filter(p => selectedIds.has(p.id) || moSelectedIds.has(p.id) || currentLogicSelected.has(p.id))
           .forEach(p => tokenize(p).forEach(t => currentContextTokens.add(t)));

      for (const rule of rules) {
        if (!rule.isActive || selectedIds.has(rule.targetPartId) || currentLogicSelected.has(rule.targetPartId)) continue;

        const part = parts.find(p => p.id === rule.targetPartId);
        if (!part) continue;

        const { includes, excludes, orGroups } = rule.logic;
        const allIn = includes.every(kw => currentContextTokens.has(kw.toUpperCase()));
        if (!allIn) continue;

        const anyEx = excludes.some(kw => currentContextTokens.has(kw.toUpperCase()));
        if (anyEx) continue;

        const orMet = orGroups.every(g => g.some(kw => currentContextTokens.has(kw.toUpperCase())));
        if (!orMet) continue;

        currentLogicSelected.add(rule.targetPartId);
        changed = true;
      }
    }
    return currentLogicSelected;
  }, [selectedIds, moSelectedIds, parts, rules]);

  const groupedParts = useMemo(() => {
    const groups: Record<string, BOMPart[]> = {};
    const lowerQ = searchTerm.toLowerCase();

    configParts.forEach(p => {
      if (lowerQ && !p.Part_Number.toLowerCase().includes(lowerQ) && !p.Name.toLowerCase().includes(lowerQ) && !p.Ref_des.toLowerCase().includes(lowerQ)) return;
      const key = p.Ref_des || 'General';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });

    return Object.entries(groups).sort((a, b) => {
      const minA = Math.min(...a[1].map(p => p.Select_pref || 9999));
      const minB = Math.min(...b[1].map(p => p.Select_pref || 9999));
      return minA - minB;
    });
  }, [configParts, searchTerm]);

  const validation = useMemo(() => {
    let missingF2 = 0;
    let totalF2Groups = 0;
    groupedParts.forEach(([_, items]) => {
      const isF2 = items.some(p => p.F_Code === 2);
      if (isF2) {
        totalF2Groups++;
        if (!items.some(p => selectedIds.has(p.id) || moSelectedIds.has(p.id))) missingF2++;
      }
    });
    return { 
      isValid: missingF2 === 0, 
      progress: totalF2Groups > 0 ? Math.round(((totalF2Groups - missingF2) / totalF2Groups) * 100) : 100 
    };
  }, [groupedParts, selectedIds, moSelectedIds]);

  const handleApplyAllSuggestions = () => {
    const finalSet = new Set(selectedIds);
    // Requirement: Apply MO Engine (P1) then Logic (P2)
    moSelectedIds.forEach(id => finalSet.add(id));
    logicSelectedIds.forEach(id => finalSet.add(id));
    onSelectionChange(finalSet);
  };

  const toggleSelection = useCallback((part: BOMPart) => {
    const next = new Set(selectedIds);
    
    // REQUIREMENT: Strict F_Code Selection Priority
    if (next.has(part.id)) {
      next.delete(part.id);
    } else {
      // REQUIREMENT: For F_Code 2 only one SKU to be selected
      if (part.F_Code === 2) {
        const key = part.Ref_des || 'General';
        const group = groupedParts.find(([k]) => k === key)?.[1] || [];
        group.forEach(p => next.delete(p.id));
      }
      // F_Code 1 & 9 allow multiple selections, so we just add it
      next.add(part.id);
    }
    onSelectionChange(next);
  }, [selectedIds, groupedParts, onSelectionChange]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-6 max-w-[1400px] mx-auto w-full">
          <div className="flex-1">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
                <CheckSquare size={20} />
              </div>
              Intelligent Configuration Console
            </h2>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-700 ${validation.isValid ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${validation.progress}%` }}></div>
              </div>
              <div className="flex gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {validation.progress}% F2 Validated
                </span>
                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5 px-2 bg-amber-100 text-amber-700 rounded-md text-[8px] font-black uppercase border border-amber-200">
                    <Star size={10} fill="currentColor" /> Priority 1: MO Engine
                  </div>
                  <div className="flex items-center gap-1.5 px-2 bg-slate-100 text-slate-600 rounded-md text-[8px] font-black uppercase border border-slate-200">
                    <Award size={10} /> Priority 2: Active Logic
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleApplyAllSuggestions}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
            >
              <Zap size={14} className="fill-indigo-600" /> Apply P1 & P2 Hits
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input 
                type="text" 
                placeholder="PN Filter..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none w-40 transition-all focus:w-60 focus:bg-white"
              />
            </div>
            <button 
              onClick={onGenerate} 
              disabled={!validation.isValid} 
              className={`px-6 py-2.5 rounded-xl flex items-center gap-2 font-black transition-all text-[10px] uppercase tracking-widest shadow-lg ${validation.isValid ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
            >
              <ShieldCheck size={16} /> Export BOM
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8 space-y-8 max-w-[1400px] mx-auto w-full">
        {groupedParts.map(([group, items]) => {
          const isExpanded = expandedGroups.has(group) || searchTerm.length > 0;
          const userHasPick = items.some(p => selectedIds.has(p.id));
          const moHasPick = items.some(p => moSelectedIds.has(p.id));
          const logicHasPick = items.some(p => logicSelectedIds.has(p.id));
          const fcode = items[0].F_Code;

          return (
            <div key={group} className={`border rounded-[2rem] overflow-hidden transition-all bg-white shadow-sm ${
              userHasPick ? 'border-indigo-500 ring-4 ring-indigo-500/5' : 
              moHasPick ? 'border-amber-400 ring-4 ring-amber-400/5' : 
              logicHasPick ? 'border-slate-300' : 'border-slate-100'
            }`}>
              <button onClick={() => {
                const n = new Set(expandedGroups);
                if (n.has(group)) n.delete(group); else n.add(group);
                setExpandedGroups(n);
              }} className="w-full px-8 py-6 flex items-center justify-between hover:bg-slate-50/50">
                <div className="flex items-center gap-8">
                  <div className={`p-4 rounded-2xl ${userHasPick ? 'bg-indigo-600 text-white' : moHasPick ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <Hash size={24} />
                  </div>
                  <div className="text-left space-y-1">
                    <div className="flex items-center gap-3">
                       <span className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-widest ${
                         fcode === 2 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-200'
                       }`}>
                         {fcode === 2 ? 'F2: Mandatory Single' : fcode === 1 ? 'F1: Optional Multi' : 'F9: Reference'}
                       </span>
                       <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{group}</h3>
                    </div>
                    <span className="font-bold text-slate-500 text-sm block">{items[0].Name}</span>
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
              </button>
              
              {isExpanded && (
                <div className="p-8 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-top-1">
                  {items.map(part => {
                    const isS = selectedIds.has(part.id);
                    const isMO = moSelectedIds.has(part.id);
                    const isLogic = logicSelectedIds.has(part.id);
                    
                    return (
                      <button 
                        key={part.id} 
                        onClick={() => toggleSelection(part)} 
                        className={`flex flex-col text-left p-6 rounded-[2.5rem] border-2 transition-all group relative ${
                          isS ? 'border-indigo-600 bg-indigo-50/20 shadow-xl scale-[1.02]' : 
                          isMO ? 'border-amber-400 bg-amber-50/10' :
                          isLogic ? 'border-slate-200 bg-slate-50/30' : 
                          'border-slate-50 hover:border-slate-200'
                        }`}
                      >
                        {isMO && (
                          <div className="absolute -top-3 left-6 px-3 py-1 bg-amber-500 text-white rounded-full text-[8px] font-black uppercase shadow-lg flex items-center gap-1">
                            <Star size={8} fill="currentColor" /> Priority 1: MO Engine
                          </div>
                        )}
                        {!isMO && isLogic && (
                          <div className="absolute -top-3 left-6 px-3 py-1 bg-slate-700 text-white rounded-full text-[8px] font-black uppercase shadow-lg flex items-center gap-1">
                            <Award size={8} /> Priority 2: Logic
                          </div>
                        )}
                        
                        <div className="flex justify-between items-start mb-4 mt-2">
                          <span className="text-[9px] font-black font-mono text-slate-400 uppercase tracking-tighter">{part.Part_Number}</span>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            isS ? 'bg-indigo-600 border-indigo-600 text-white' : 
                            (isMO || isLogic) ? 'border-indigo-200 bg-white' : 'border-slate-200'
                          }`}>
                            {isS ? <Check size={12} strokeWidth={4} /> : (isMO || isLogic) ? <Zap size={10} className="text-indigo-300" /> : null}
                          </div>
                        </div>
                        <p className="text-xs font-black text-slate-800 leading-tight mb-2 uppercase tracking-tight">{part.Name}</p>
                        <p className="text-[10px] text-slate-400 italic font-medium line-clamp-2 leading-relaxed">{part.Remarks}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SelectionScreen;
