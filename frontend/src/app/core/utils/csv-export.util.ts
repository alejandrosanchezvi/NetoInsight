/**
 * Utilidad de exportación CSV/Excel para dashboards de Tableau.
 *
 * - buildCsv: convierte datos de Tableau a CSV, pivotando si detecta Measure Names/Values
 * - downloadCsv: descarga un CSV con BOM UTF-8 (para acentos en Excel)
 * - downloadExcel: descarga un .xlsx con múltiples hojas usando SheetJS
 */
import * as XLSX from 'xlsx';

/** Detectores de columnas especiales de Tableau (inglés y español, singular/plural) */
const MEASURE_NAMES_RE = /nombres?\s*de\s*medidas?|measure\s*names?/i;
const MEASURE_VALUES_RE = /valores?\s*de\s*medidas?|measure\s*values?/i;

/** Escapa un valor para CSV y convierte null/undefined a vacío */
function escape(val: any): string {
  const str = (val === null || val === undefined || String(val).toLowerCase() === 'null')
    ? ''
    : String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/** Extrae el valor formateado de una celda Tableau, nunca devuelve "null", quita .00 sobrantes */
function cellValue(cell: any): string {
  const raw = cell?.formattedValue ?? cell?.value;
  if (raw === null || raw === undefined || String(raw).toLowerCase() === 'null') return '';
  // Quitar .00 al final (ej: "23,412.00" → "23,412", "85.00%" → "85%")
  return String(raw).replace(/\.00(%?)$/, '$1');
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte datos de Tableau (getSummaryDataAsync) a una cadena CSV.
 * Si detecta el patrón Measure Names / Measure Values lo pivota automáticamente.
 */
export function buildCsv(data: { columns: any[]; data: any[][] }): string {
  const cols = data.columns;

  const measureNamesIdx = cols.findIndex((c: any) => MEASURE_NAMES_RE.test(c.fieldName));
  const measureValuesIdx = cols.findIndex((c: any) => MEASURE_VALUES_RE.test(c.fieldName));

  if (measureNamesIdx === -1 || measureValuesIdx === -1) {
    // ── Formato normal ─────────────────────────────────────────────────────
    const headers = cols.map((c: any) => escape(c.fieldName)).join(',');
    const rows = data.data.map((row: any[]) =>
      row.map((cell: any) => escape(cellValue(cell))).join(',')
    );
    return [headers, ...rows].join('\n');
  }

  // ── Formato Measure Names/Values: pivotar ──────────────────────────────
  const dimIndices = cols
    .map((_: any, i: number) => i)
    .filter((i: number) => i !== measureNamesIdx && i !== measureValuesIdx);

  // Nombres de métricas únicos en orden de aparición
  const measureNamesSeen: string[] = [];
  const measureNamesSet = new Set<string>();
  for (const row of data.data) {
    const mName = cellValue(row[measureNamesIdx]);
    if (!measureNamesSet.has(mName)) {
      measureNamesSet.add(mName);
      measureNamesSeen.push(mName);
    }
  }

  // Agrupar por dimensiones
  const grouped = new Map<string, Record<string, string>>();
  const keyOrder: string[] = [];

  for (const row of data.data) {
    const dimValues = dimIndices.map((i: number) => cellValue(row[i]));
    const dimKey = dimValues.join('\x00');

    if (!grouped.has(dimKey)) {
      const entry: Record<string, string> = {};
      dimIndices.forEach((colIdx: number, pos: number) => {
        entry[`__dim_${colIdx}`] = dimValues[pos];
      });
      grouped.set(dimKey, entry);
      keyOrder.push(dimKey);
    }

    const mName = cellValue(row[measureNamesIdx]);
    const mValue = cellValue(row[measureValuesIdx]);
    grouped.get(dimKey)![mName] = mValue;
  }

  // Cabeceras
  const dimHeaders = dimIndices.map((i: number) => escape(cols[i].fieldName));
  const metricHeaders = measureNamesSeen.map((m: string) => escape(m));
  const headers = [...dimHeaders, ...metricHeaders].join(',');

  // Filas
  const rows = keyOrder.map((key: string) => {
    const entry = grouped.get(key)!;
    const dimCells = dimIndices.map((i: number) => escape(entry[`__dim_${i}`]));
    const metricCells = measureNamesSeen.map((m: string) => escape(entry[m] ?? ''));
    return [...dimCells, ...metricCells].join(',');
  });

  return [headers, ...rows].join('\n');
}

/** Descarga un CSV con BOM UTF-8 (para acentos correctos en Excel) */
export function downloadCsv(csvContent: string, filename: string): void {
  // \uFEFF = BOM UTF-8, necesario para que Excel en Windows muestre acentos correctamente
  const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXCEL multi-hoja (SheetJS)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExcelSheet {
  /** Nombre de la pestaña en el Excel */
  sheetName: string;
  /** Datos de Tableau (getSummaryDataAsync) */
  tableauData: { columns: any[]; data: any[][] };
  /**
   * Si true, convierte valores numéricos de decimal a porcentaje.
   * Ej: 0.79 → "79%", 1 → "100%", 0.225 → "22.5%"
   * Los valores no numéricos (texto) se dejan intactos.
   */
  formatAsPercent?: boolean;
}

/**
 * Genera y descarga un archivo .xlsx con múltiples hojas.
 * Cada hoja usa los datos de Tableau y aplica pivoteo automático si es necesario.
 */
export function downloadExcel(sheets: ExcelSheet[], filename: string): void {
  const wb = XLSX.utils.book_new();

  for (const { sheetName, tableauData, formatAsPercent } of sheets) {
    const aoa = buildAoA(tableauData, formatAsPercent);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  triggerDownload(blob, filename);
}

/** Convierte un valor decimal a porcentaje SOLO si está en el rango [0, 1]. */
function toPercent(val: string): string {
  const num = parseFloat(val.replace(/,/g, ''));
  if (isNaN(num)) return val;         // texto/dimensión: intacto
  if (num <= 0 || num > 1) return val; // 0, negativos y números grandes: intactos
  const pct = Math.round(num * 10000) / 100; // 0.79 → 79, 0.225 → 22.5
  const pctStr = pct.toString().replace(/\.00$/, '');
  return `${pctStr}%`;
}

/**
 * Convierte datos de Tableau a Array-of-Arrays (formato SheetJS).
 * Aplica pivoteo automático si detecta Measure Names/Values.
 */
function buildAoA(data: { columns: any[]; data: any[][] }, formatAsPercent = false): any[][] {
  const cols = data.columns;

  const measureNamesIdx = cols.findIndex((c: any) => MEASURE_NAMES_RE.test(c.fieldName));
  const measureValuesIdx = cols.findIndex((c: any) => MEASURE_VALUES_RE.test(c.fieldName));

  if (measureNamesIdx === -1 || measureValuesIdx === -1) {
    // Formato normal
    const header = cols.map((c: any) => c.fieldName);
    const rows = data.data.map((row: any[]) =>
      row.map((cell: any) => {
        const v = cellValue(cell);
        return formatAsPercent ? toPercent(v) : v;
      })
    );
    return [header, ...rows];
  }

  // Formato Measure Names/Values: pivotar
  const dimIndices = cols
    .map((_: any, i: number) => i)
    .filter((i: number) => i !== measureNamesIdx && i !== measureValuesIdx);

  const measureNamesSeen: string[] = [];
  const measureNamesSet = new Set<string>();
  for (const row of data.data) {
    const mName = cellValue(row[measureNamesIdx]);
    if (!measureNamesSet.has(mName)) {
      measureNamesSet.add(mName);
      measureNamesSeen.push(mName);
    }
  }

  const grouped = new Map<string, Record<string, string>>();
  const keyOrder: string[] = [];

  for (const row of data.data) {
    const dimValues = dimIndices.map((i: number) => cellValue(row[i]));
    const dimKey = dimValues.join('\x00');

    if (!grouped.has(dimKey)) {
      const entry: Record<string, string> = {};
      dimIndices.forEach((colIdx: number, pos: number) => {
        entry[`__dim_${colIdx}`] = dimValues[pos];
      });
      grouped.set(dimKey, entry);
      keyOrder.push(dimKey);
    }

    const mName = cellValue(row[measureNamesIdx]);
    const mValue = cellValue(row[measureValuesIdx]);
    grouped.get(dimKey)![mName] = mValue;
  }

  const header = [
    ...dimIndices.map((i: number) => cols[i].fieldName),
    ...measureNamesSeen
  ];

  const rows = keyOrder.map((key: string) => {
    const entry = grouped.get(key)!;
    const dimVals = dimIndices.map((i: number) => entry[`__dim_${i}`] ?? '');
    const metricVals = measureNamesSeen.map((m: string) => {
      const v = entry[m] ?? '';
      return formatAsPercent ? toPercent(v) : v;
    });
    return [...dimVals, ...metricVals];
  });

  return [header, ...rows];
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
