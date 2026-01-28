
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
  Award,
  AlertCircle,
  PackageCheck
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

  // REQUIREMENT: F_Code 1, 2, and 9 are configurable. F_Code 0 is mandatory and included directly (not shown for selection).
  const configParts = useMemo(() => parts.filter(p => p.F_Code === 1 || p.F_Code === 2 || p.F_Code === 9), [parts]);

  // Logic Solver (Priority 2: Active Engineering Logic)
  const logicSelectedIds = useMemo(() => {
    const currentLogicSelected = new Set<string>();
    let changed = true;
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    const tokenize = (p: BOMPart) => 
      new Set(`${p.Part_Number} ${p.Name} ${p.Remarks} ${p.Std_Remarks}`.toUpperCase().split(/[\s,._+/()\[\]]+/).filter(s => s.length > 0));

    // Seed tokens with mandatory (F0) parts
    const baseTokens = new Set<string>();
    parts.filter(p => p.F_Code === 0).forEach(p => tokenize(p).forEach(t => baseTokens.add(t)));

    while (changed && iterations < MAX_ITERATIONS) {
      changed = false;
      iterations++;

      const currentContextTokens = new Set(baseTokens);
      parts.filter(p => selectedIds.has(p.id) || moSelectedIds.has(p.id) || currentLogicSelected.has(p.id))
           .forEach(p => tokenize(p).forEach(t => currentContextTokens.add(t)));

      for (const rule of rules) {
        if (!rule.isActive || selectedIds.has(rule.targetPartId) || moSelectedIds.has(rule.targetPartId) || currentLogicSelected.has(rule.targetPartId)) continue;

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
      const pnMatch = p.Part_Number.toLowerCase().includes(lowerQ);
      const nameMatch = p.Name.toLowerCase().includes(lowerQ);
      const refMatch = p.Ref_des.toLowerCase().includes(lowerQ);
      if (lowerQ && !pnMatch && !nameMatch && !refMatch) return;
      
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

  // Validation: Every Ref_des containing F2 parts MUST have exactly one selection (either User, MO, or Logic)
  const validation = useMemo(() => {
    let missingF2 = 0;
    let totalF2Groups = 0;
    const missingGroupNames: string[] = [];

    groupedParts.forEach(([group, items]) => {
      const containsF2 = items.some(p => p.F_Code === 2);
      if (containsF2) {
        totalF2Groups++;
        const hasSelection = items.some(p => selectedIds.has(p.id) || moSelectedIds.has(p.id) || logicSelectedIds.has(p.id));
        if (!hasSelection) {
          missingF2++;
          missingGroupNames.push(group);
        }
      }
    });

    return { 
      isValid: missingF2 === 0, 
      progress: totalF2Groups > 0 ? Math.round(((totalF2Groups - missingF2) / totalF2Groups) * 100) : 100,
      missingGroupNames
    };
  }, [groupedParts, selectedIds, moSelectedIds, logicSelectedIds]);

  const toggleSelection = useCallback((part: BOMPart) => {
    const next = new Set(selectedIds);
    
    if (next.has(part.id)) {
      next.delete(part.id);
    } else {
      // REQUIREMENT: For F_Code 2, ensure only one SKU is selected per Ref_des group
      if (part.F_Code === 2) {
        const key = part.Ref_des || 'General';
        const groupItems = groupedParts.find(([k]) => k === key)?.[1] || [];
        groupItems.forEach(p => next.delete(p.id));
      }
      next.add(part.id);
    }
    onSelectionChange(next);
  }, [selectedIds, groupedParts, onSelectionChange]);

  const handleApplyAllSuggestions = () => {
    const next = new Set(selectedIds);
    // Apply MO (Priority 1)
    moSelectedIds.forEach(id => {
      const p = parts.find(x => x.id === id);
      if (p && p.F_Code === 2) {
        const group = groupedParts.find(([k]) => k === (p.Ref_des || 'General'))?.[1] || [];
        group.forEach(i => next.delete(i.id));
      }
      next.add(id);
    });
    // Apply Logic (Priority 2) - only if no existing selection for F2 groups
    logicSelectedIds.forEach(id => {
      const p = parts.find(x => x.id === id);
      if (p && p.F_Code === 2) {
        const key = p.Ref_des || 'General';
        const group = groupedParts.find(([k]) => k === key)?.[1] || [];
        if (!group.some(i => next.has(i.id))) next.add(id);
      } else {
        next.add(id);
      }
    });
    onSelectionChange(next);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-6 border-b border-slate-200 bg-white sticky top-0 z-30 shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-6 max-w-[1400px] mx-auto w-full">
          <div className="flex-1">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
                <CheckSquare size={20} />
              </div>
              BOM Configurator
            </h2>
            <div className="mt-4 flex items-center gap-4">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-700 ${validation.isValid ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${validation.progress}%` }}></div>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {validation.progress}% Build Validated
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleApplyAllSuggestions}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
            >
              <Zap size={14} className="fill-indigo-600" /> Apply P1 & P2 Hits
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input 
                type="text" 
                placeholder="Search Catalog..." 
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
              <ShieldCheck size={16} /> Finalize BOM
            </button>
          </div>
        </div>
      </div>

      {!validation.isValid && (
        <div className="bg-amber-50 border-b border-amber-100 px-8 py-2 flex items-center gap-3 text-amber-700 text-[10px] font-black uppercase tracking-widest">
          <AlertCircle size={14} className="text-amber-500" />
          Mandatory Selections Missing: <span className="font-mono text-amber-600">{validation.missingGroupNames.join(', ')}</span>
        </div>
      )}

      <div className="flex-1 overflow-auto p-8 space-y-6 max-w-[1400px] mx-auto w-full pb-32">
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-4">
          <PackageCheck size={18} /> Mandatory (F0) components from repository are automatically included in the manifest.
        </div>
        
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
              'border-slate-100'
            }`}>
              <button onClick={() => {
                const n = new Set(expandedGroups);
                if (n.has(group)) n.delete(group); else n.add(group);
                setExpandedGroups(n);
              }} className="w-full px-8 py-6 flex items-center justify-between hover:bg-slate-50/50">
                <div className="flex items-center gap-8">
                  <div className={`p-4 rounded-xl ${userHasPick ? 'bg-indigo-600 text-white shadow-lg' : moHasPick ? 'bg-amber-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                    <Hash size={24} />
                  </div>
                  <div className="text-left space-y-1">
                    <div className="flex items-center gap-3">
                       <span className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-widest ${
                         fcode === 2 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-600 border-slate-200'
                       }`}>
                         {fcode === 2 ? 'F2: Mandatory Selection' : fcode === 1 ? 'F1: Optional Multi' : 'F9: Reference'}
                       </span>
                       <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">{group}</h3>
                    </div>
                    <span className="font-bold text-slate-500 text-sm block">{items[0].Name}</span>
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={24} className="text-slate-300" /> : <ChevronDown size={24} className="text-slate-300" />}
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
                        className={`flex flex-col text-left p-6 rounded-[2rem] border-2 transition-all relative ${
                          isS ? 'border-indigo-600 bg-indigo-50/20 shadow-xl' : 
                          isMO ? 'border-amber-400 bg-amber-50/10' :
                          isLogic ? 'border-slate-200 bg-slate-50/40' : 
                          'border-slate-50 hover:border-slate-200'
                        }`}
                      >
                        {isMO && (
                          <div className="absolute -top-3 left-6 px-3 py-1 bg-amber-500 text-white rounded-full text-[8px] font-black uppercase shadow-lg flex items-center gap-1">
                            <Star size={8} fill="currentColor" /> Priority 1: MO
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
                            (isMO || isLogic) ? 'border-indigo-200 bg-white shadow-inner' : 'border-slate-200'
                          }`}>
                            {isS ? <Check size={12} strokeWidth={4} /> : (isMO || isLogic) ? <Zap size={10} className="text-indigo-300" /> : null}
                          </div>
                        </div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight mb-2 leading-tight">{part.Name}</p>
                        <p className="text-[10px] text-slate-400 italic line-clamp-2 leading-relaxed h-8">{part.Remarks}</p>
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
