"use client";
import { useState, useEffect } from "react";
import { ExcelPicker, type ExcelSelection } from "./ExcelPicker";

interface Props {
  value: {
    file: File | null;
    sheet: string | null;
    headers: string[];
    painPointIdColumn?: string;
    painPointDescColumns: string[];
    capabilityIdColumn?: string;
  };
  onChange: (v: Props['value']) => void;
  className?: string;
  required?: boolean;
}

export function PainPointMappingInput({ value, onChange, className, required }: Props) {
  const [excel, setExcel] = useState<ExcelSelection>({ 
    file: value.file, 
    sheet: value.sheet, 
    headers: value.headers || [], 
    preview: [], 
    headerRowIndex: 0 
  });
  const [painPointIdColumn, setPainPointIdColumn] = useState<string | undefined>(value.painPointIdColumn);
  const [painPointDescColumns, setPainPointDescColumns] = useState<string[]>(value.painPointDescColumns || []);
  const [capabilityIdColumn, setCapabilityIdColumn] = useState<string | undefined>(value.capabilityIdColumn);

  // Sync upward whenever internal state changes
  useEffect(() => {
    onChange({
      file: excel.file,
      sheet: excel.sheet,
      headers: excel.headers,
      painPointIdColumn,
      painPointDescColumns,
      capabilityIdColumn,
    });
  }, [excel.file, excel.sheet, excel.headers, painPointIdColumn, painPointDescColumns, capabilityIdColumn]);

  function toggleDescColumn(column: string) {
    setPainPointDescColumns(prev => 
      prev.includes(column) 
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  }

  return (
    <div className={className}>
      <ExcelPicker onChange={setExcel} />
      {excel.headers.length > 0 && (
        <div className="mt-4 space-y-6">
          {/* Pain Point ID Column */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Pain Point ID Column {required && <span className="text-rose-400">*</span>}
            </label>
            <select
              value={painPointIdColumn || ""}
              onChange={(e) => setPainPointIdColumn(e.target.value || undefined)}
              className="w-full rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-white/10 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40 focus:border-transparent shadow-inner"
            >
              <option value="">Select column...</option>
              {excel.headers.map((header) => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
          </div>

          {/* Pain Point Description Columns */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Pain Point Description Columns {required && <span className="text-rose-400">*</span>}
            </label>
            <div className="max-h-40 overflow-y-auto p-3 rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-white/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {excel.headers.map((header) => (
                  <label key={header} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={painPointDescColumns.includes(header)}
                      onChange={() => toggleDescColumn(header)}
                      className="h-4 w-4 rounded border-white/20 bg-slate-900 text-fuchsia-400 focus:ring-fuchsia-400/40"
                    />
                    <span className="text-sm text-slate-300 truncate">{header}</span>
                  </label>
                ))}
              </div>
            </div>
            {painPointDescColumns.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {painPointDescColumns.map((col) => (
                  <span key={col} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-slate-200">
                    {col}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Capability ID Column */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Capability ID Column {required && <span className="text-rose-400">*</span>}
            </label>
            <select
              value={capabilityIdColumn || ""}
              onChange={(e) => setCapabilityIdColumn(e.target.value || undefined)}
              className="w-full rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-white/10 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40 focus:border-transparent shadow-inner"
            >
              <option value="">Select column...</option>
              {excel.headers.map((header) => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
