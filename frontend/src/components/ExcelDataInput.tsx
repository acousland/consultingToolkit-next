"use client";
import { useState, useEffect } from "react";
import { ExcelPicker, type ExcelSelection } from "./ExcelPicker";
import { ExcelColumnSelector, ColumnSelectorMode } from "./ExcelColumnSelector";
import { StructuredExcelSelection } from "@/types/excel";

interface Props {
  mode: ColumnSelectorMode; // id-text | single-text | multi-text
  value: StructuredExcelSelection;
  onChange: (v: StructuredExcelSelection) => void;
  className?: string;
  required?: boolean;
  labels?: Parameters<typeof ExcelColumnSelector>[0]["labels"];
}

export function ExcelDataInput({ mode, value, onChange, className, labels, required }: Props) {
  const [excel, setExcel] = useState<ExcelSelection>({ file: value.file, sheet: value.sheet, headers: value.headers || [], preview: [], headerRowIndex: value.headerRowIndex });
  const [idColumn, setIdColumn] = useState<string | undefined>(value.idColumn);
  const [textColumns, setTextColumns] = useState<string[]>(value.textColumns || []);

  // Sync upward whenever internal state changes
  useEffect(() => {
    onChange({
      file: excel.file,
      sheet: excel.sheet,
      headerRowIndex: excel.headerRowIndex,
      headers: excel.headers,
      idColumn: mode === "id-text" ? idColumn : undefined,
      textColumns: textColumns,
    });
  }, [excel.file, excel.sheet, excel.headerRowIndex, excel.headers, idColumn, textColumns, mode]);

  // Handle selection changes from column selector
  function handleColumnChange(v: any) {
    if (mode === "id-text") {
      setIdColumn(v.idColumn);
      setTextColumns(v.textColumns);
    } else {
      setTextColumns(v.textColumns);
    }
  }

  return (
    <div className={className}>
      <ExcelPicker onChange={setExcel} />
      {excel.headers.length > 0 && (
        <div className="mt-4">
          {mode === "id-text" ? (
            <ExcelColumnSelector
              mode="id-text"
              headers={excel.headers}
              value={{ idColumn: idColumn || "", textColumns }}
              onChange={handleColumnChange}
              labels={labels}
              required={required}
            />
          ) : mode === "single-text" ? (
            <ExcelColumnSelector
              mode="single-text"
              headers={excel.headers}
              value={{ textColumns: textColumns.slice(0,1) }}
              onChange={handleColumnChange}
              labels={labels}
              required={required}
            />
          ) : (
            <ExcelColumnSelector
              mode="multi-text"
              headers={excel.headers}
              value={{ textColumns }}
              onChange={handleColumnChange}
              labels={labels}
              required={required}
            />
          )}
        </div>
      )}
    </div>
  );
}
