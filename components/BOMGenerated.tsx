import React, { useMemo, useState } from 'react';
import { BOMPart } from '../types';
import { FileText, Printer, UserCheck, ShieldCheck, BrainCircuit, RefreshCw } from 'lucide-react';

interface Props {
  parts: BOMPart[];
  selectedIds: Set<string>;
  modelName: string;
  onFinalizeKnowledge: (mappings: {category: string, selection: string, partNumber: string}[]) => void;
}

const BOMGenerated: React.FC<Props> = ({ parts, selectedIds, modelName, onFinalizeKnowledge }) => {
  const [learned, setLearned] = useState(false);

  const finalBOM = useMemo(() => {
    const std = parts.filter(p => p.F_Code === 0);
    const sel = parts.filter(p => selectedIds.has(p.id));
    return [...std, ...sel].sort((a, b) => (a.Select_pref || 0) - (b.Select_pref || 0));
  }, [parts, selectedIds]);

  const handleFinalize = () => {
    const m = parts
      .filter(p => selectedIds.has(p.id) && (p.F_Code === 1 || p.F_Code === 2 || p.F_Code === 9))
      .map(p => ({ category: p.Ref_des || 'Unknown', selection: p.Name, partNumber: p.Part_Number }));

    onFinalizeKnowledge(m);
    setLearned(true);
    
    // Preparation for Excel Download mirroring the table requirements
    const exportData = finalBOM.map((p, i) => ({
      "Sr. No": i + 1,
      "Part_Number": p.Part_Number,
      "Name": p.Name,
      "Qty": p.Qty || 1,
      "Ref_des": p.Ref_des,
      "Remarks": p.Remarks,
      "Status": 'VERIFIED'
    }));

    const XLSX = (window as any).XLSX;
    if (XLSX) {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Verified BOM");
      XLSX.writeFile(wb, `${modelName}_Manifest.xlsx`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-8 border-b border-slate-200 bg-white flex justify-between items-center shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tight">
            <ShieldCheck className="text-emerald-600" /> Output Manifest
          </h2>
          <p className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">Configuration: <span className="text-indigo-600">{modelName}</span></p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="bg-slate-50 text-slate-600 px-6 py-3 rounded-2xl flex items-center gap-2 text-xs font-black uppercase tracking-widest border border-slate-200 shadow-sm transition-all hover:bg-slate-100">
            <Printer size={16} /> Print
          </button>
          <button onClick={handleFinalize} className={`px-8 py-3 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all shadow-xl ${learned ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'}`}>
            {learned ? <BrainCircuit size={18} /> : <RefreshCw size={18} />}
            {learned ? "Weights Saved" : "Confirm & Export"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-10">
        <div className="max-w-[1400px] mx-auto bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100">
          <div className="bg-slate-900 text-white p-10 flex justify-between items-center">
             <div className="flex items-center gap-4">
                <FileText size={32} className="text-indigo-400" />
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tighter">Verified Build BOM</h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Authorized Assembly Reference</p>
                </div>
             </div>
             <div className="text-right">
                <p className="text-4xl font-black text-emerald-400">{finalBOM.length}</p>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confirmed Items</p>
             </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-6 py-6 text-[10px] font-black uppercase text-slate-400">Sr. No</th>
                  <th className="px-6 py-6 text-[10px] font-black uppercase text-slate-400">Part_Number</th>
                  <th className="px-6 py-6 text-[10px] font-black uppercase text-slate-400">Name</th>
                  <th className="px-6 py-6 text-[10px] font-black uppercase text-slate-400 text-center">Qty</th>
                  <th className="px-6 py-6 text-[10px] font-black uppercase text-slate-400">Ref_des</th>
                  <th className="px-6 py-6 text-[10px] font-black uppercase text-slate-400">Remarks</th>
                  <th className="px-6 py-6 text-[10px] font-black uppercase text-slate-400 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {finalBOM.map((p, i) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-5 text-[10px] font-black text-slate-400">{i + 1}</td>
                    <td className="px-6 py-5 text-sm font-mono font-bold text-indigo-600">{p.Part_Number}</td>
                    <td className="px-6 py-5 text-sm font-black text-slate-800 uppercase tracking-tight">{p.Name}</td>
                    <td className="px-6 py-5 text-sm text-center font-bold text-slate-600">{p.Qty || 1}</td>
                    <td className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase tracking-tight">{p.Ref_des || '-'}</td>
                    <td className="px-6 py-5 text-[10px] text-slate-400 italic font-medium leading-relaxed max-w-xs truncate group-hover:whitespace-normal group-hover:overflow-visible transition-all">
                      {p.Remarks || '-'}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[9px] font-black uppercase">
                        <UserCheck size={10} /> Verified
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BOMGenerated;