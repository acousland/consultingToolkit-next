export interface StructuredExcelSelection {
  file: File | null;
  sheet: string | null;
  headerRowIndex?: number;
  headers: string[];
  idColumn?: string; // present when mode requires id
  textColumns: string[]; // one or many depending on mode
}

export type ExcelSelectionMode = "id-text" | "single-text" | "multi-text";

export function emptyStructuredExcelSelection(): StructuredExcelSelection {
  return { file: null, sheet: null, headers: [], textColumns: [] };
}
