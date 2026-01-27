
import React, { useRef, useState, useMemo } from 'react';
import { BOMPart, ConfigRule, RuleLogic, MachineKnowledge } from '../types';
import { Upload, Table as TableIcon, Trash2, ArrowRight, Search, FileSpreadsheet, Wand2, Info } from 'lucide-react';
import PartDetailModal from './PartDetailModal';

interface Props {
  parts: BOMPart[];
  existingRules: ConfigRule[];
  knowledgeBase: MachineKnowledge;
  onPartsUpdate: (parts: BOMPart[]) => void;
  onRulesUpdate: (rules: ConfigRule[]) => void;
  onNavigate: () => void;
  onClearAll: () => void;
}

const BOMTable: React.FC<Props> = ({ parts, existingRules, knowledgeBase, onPartsUpdate, onRulesUpdate, onNavigate, onClearAll }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRuleCount, setAutoRuleCount] = useState(0);
  const [selectedPart, setSelectedPart] = useState<BOMPart | null>(null);

  const filteredParts = useMemo(() => {
    return parts.filter(p => 
      p.Part_Number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.Remarks.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.Ref_des.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [parts, searchTerm]);

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

  const generateRulesFromData = (data: any[], newParts: BOMPart[]) => {
    const KEYWORDS_DICT = ['CAB', 'ENGINE', 'CANOPY', 'OIL', 'FUEL', 'FLUID', 'HYDRAULIC', 'AIR', 'PRESSURE', 'HEATER', 'LIGHT', 'AC', 'STD'];
    const newRules: ConfigRule[] = [...existingRules];
    let count = 0;

    data.forEach((row, index) => {
      const part = newParts[index];
      // Allow F_Code 1, 2, and 9 for rules
      if (part.F_Code !== 1 && part.F_Code !== 2 && part.F_Code !== 9) return;

      const excelLogic = row.Logic || row.Logic_Config || row.logic;
      let finalLogic: RuleLogic | null = null;

      if (excelLogic && String(excelLogic).trim().length > 0) {
        finalLogic = parseLogicString(String(excelLogic));
      } 
      else {
        const metadata = (part.Remarks + ' ' + part.Std_Remarks).toUpperCase();
        const words = metadata.split(/[\s,._+/]+/).filter(w => w.length > 1);
        const matchedKeywords = Array.from(new Set(words.filter(word => KEYWORDS_DICT.includes(word))));

        if (matchedKeywords.length > 0) {
          finalLogic = {
            includes: matchedKeywords,
            excludes: [],
            orGroups: [],
            raw: matchedKeywords.join(' ')
          };
        }
      }

      if (finalLogic) {
        const existingIdx = newRules.findIndex(r => r.targetPartId === part.id);
        if (existingIdx === -1) {
          newRules.push({
            id: `rule-${Date.now()}-${count}`,
            targetPartId: part.id,
            logic: finalLogic,
            isActive: true
          });
          count++;
        } else {
          newRules[existingIdx].logic = finalLogic;
        }
      }
    });

    onRulesUpdate(newRules);
    setAutoRuleCount(count);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = (window as any).XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = (window as any).XLSX.utils.sheet_to_json(ws);

      const mappedParts: BOMPart[] = data.map((row: any, index: number) => ({
        id: `part-${Date.now()}-${index}`,
        Part_Number: String(row.Part_Number || ''),
        Name: String(row.Name || ''),
        Remarks: String(row.Remarks || ''),
        Std_Remarks: String(row.Std_Remarks || ''),
        F_Code: isNaN(parseInt(row.F_Code)) ? 0 : parseInt(row.F_Code),
        Ref_des: String(row.Ref_des || ''),
        Select_pref: isNaN(parseInt(row.Select_pref)) ? 999999 : parseInt(row.Select_pref),
        Qty: isNaN(parseFloat(row.Qty)) ? 1 : parseFloat(row.Qty),
      }));

      onPartsUpdate(mappedParts);
      generateRulesFromData(data, mappedParts);
    };
    reader.readAsBinaryString(file);
  };

  const handlePartUpdate = (updatedPart: BOMPart) => {
    const nextParts = parts.map(p => p.id === updatedPart.id ? updatedPart : p);
    onPartsUpdate(nextParts);
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="p-6 border-b border-slate-200 flex flex-wrap justify-between items-center bg-white gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
            <FileSpreadsheet className="text-indigo-600" />
            BOM Repository Management
          </h2>
          <p className="text-sm text-slate-500 font-medium">Excel columns needed: Part_Number, Name, Remarks, Qty, F_Code, Ref_des, Logic (Optional).</p>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls,.csv" className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm font-bold shadow-sm">
            <Upload size={16} /> Import Excel
          </button>
          {parts.length > 0 && (
            <button onClick={onNavigate} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm font-bold shadow-sm">
              Setup Logic <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {autoRuleCount > 0 && (
        <div className="bg-indigo-600 px-6 py-2 flex items-center gap-3 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-inner">
          <Wand2 size={12} className="animate-pulse" />
          Rule Processor: {autoRuleCount} dependency rules generated/updated.
        </div>
      )}

      <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input type="text" placeholder="Search PN, Name, or Ref Des..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden lg:inline">Tip: Click a row to explore technical intelligence</span>
          {parts.length > 0 && (
            <button onClick={onClearAll} className="text-red-600 hover:bg-red-50 px-3 py-2 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors">
              <Trash2 size={14} /> Clear Database
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {parts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-12 text-slate-300">
            <TableIcon size={64} strokeWidth={1.5} className="mb-4 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest">No Data Imported</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-sm">
              <tr>
                <th className="w-48 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Part Number</th>
                <th className="w-1/4 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Technical Remarks</th>
                <th className="w-24 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">F Code</th>
                <th className="w-32 px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ref Des</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredParts.map((part) => (
                <tr 
                  key={part.id} 
                  className="hover:bg-indigo-50/30 transition-colors group cursor-pointer"
                  onClick={() => setSelectedPart(part)}
                >
                  <td className="px-6 py-4 text-sm text-indigo-700 font-mono font-bold flex items-center gap-2">
                    {part.Part_Number}
                    <Info size={12} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-900 font-bold">{part.Name}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-slate-500 italic truncate group-hover:whitespace-normal group-hover:overflow-visible transition-all">{part.Remarks}</span>
                      {part.Std_Remarks && <span className="text-[9px] font-black text-slate-400 uppercase">{part.Std_Remarks}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                      part.F_Code === 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 
                      part.F_Code === 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                      part.F_Code === 2 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                      part.F_Code === 9 ? 'bg-slate-50 text-slate-700 border-slate-300' :
                      'bg-slate-50 text-slate-400 border-slate-200'
                    }`}>CODE {part.F_Code}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-bold">{part.Ref_des || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedPart && (
        <PartDetailModal 
          part={selectedPart}
          rules={existingRules.filter(r => r.targetPartId === selectedPart.id)}
          knowledgeBase={knowledgeBase}
          onClose={() => setSelectedPart(null)}
          onUpdate={handlePartUpdate}
        />
      )}
    </div>
  );
};

export default BOMTable;
