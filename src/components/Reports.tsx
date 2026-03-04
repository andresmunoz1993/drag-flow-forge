import React, { useState, useEffect, useCallback } from 'react';
import type { ReportDefinition, ReportParam, ReportResult } from '@/types';
import { apiGetReports, apiRunReport } from '@/lib/api';
import { Icons } from './Icons';

// ── CSV export helper ─────────────────────────────────────────────────────────

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function exportResultCSV(report: ReportDefinition, result: ReportResult) {
  const headerRow  = result.columns.map(csvCell).join(',');
  const dataRows   = result.rows.map(row =>
    result.columns.map(col => csvCell(row[col])).join(',')
  );
  const csv  = [headerRow, ...dataRows].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${report.id}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Parameter modal ───────────────────────────────────────────────────────────

interface RunModalProps {
  report:   ReportDefinition;
  onClose:  () => void;
  onResult: (result: ReportResult) => void;
}

const inputClass = 'w-full py-2 px-3 bg-surface-2 border border-border rounded-lg text-foreground text-[13px] outline-none focus:border-primary placeholder:text-text-muted';

const RunModal: React.FC<RunModalProps> = ({ report, onClose, onResult }) => {
  const [values,  setValues]  = useState<Record<string, string>>(() =>
    Object.fromEntries(report.params.map(p => [p.name, p.default ?? '']))
  );
  const [running, setRunning] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const setValue = (name: string, v: string) => setValues(prev => ({ ...prev, [name]: v }));

  const run = async () => {
    // Validar requeridos
    const missing = report.params.filter(p => p.required && !values[p.name]?.trim());
    if (missing.length) { setError(`Faltan campos requeridos: ${missing.map(p => p.label).join(', ')}`); return; }
    setError(null);
    setRunning(true);
    try {
      const result = await apiRunReport(report.id, values);
      onResult(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al ejecutar el reporte.');
    } finally {
      setRunning(false);
    }
  };

  const renderInput = (p: ReportParam) => {
    const val = values[p.name] ?? '';
    const onChange = (v: string) => setValue(p.name, v);
    switch (p.type) {
      case 'date':
        return <input type="date" className={inputClass} value={val} onChange={e => onChange(e.target.value)} />;
      case 'number':
        return <input type="number" className={inputClass} value={val} placeholder={p.placeholder} onChange={e => onChange(e.target.value)} />;
      case 'select':
        return (
          <select className={inputClass} value={val} onChange={e => onChange(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {(p.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      default:
        return <input type="text" className={inputClass} value={val} placeholder={p.placeholder} onChange={e => onChange(e.target.value)} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-card border border-border rounded-[14px] w-[480px] max-h-[80vh] overflow-y-auto p-6 fade-in shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Icons.reports size={16} className="text-primary" />
              <div className="text-[15px] font-bold text-foreground">{report.name}</div>
            </div>
            {report.description && (
              <div className="text-[12px] text-text-muted mt-1">{report.description}</div>
            )}
          </div>
          <button className="text-text-muted hover:text-foreground p-1" onClick={onClose}><Icons.x size={16} /></button>
        </div>

        {/* Params */}
        {report.params.length > 0 ? (
          <div className="space-y-3 mb-4">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wide">
              <Icons.filter size={11} /> Filtros
            </div>
            {report.params.map(p => (
              <div key={p.name}>
                <label className="block text-[12px] font-semibold text-text-secondary mb-1">
                  {p.label}
                  {p.required && <span className="text-destructive ml-0.5">*</span>}
                </label>
                {renderInput(p)}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[13px] text-text-muted italic mb-4">Este reporte no requiere filtros.</div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-[13px] mb-4">
            <Icons.alert size={14} className="shrink-0" /> {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            className="px-4 py-2 bg-surface-3 text-foreground border border-border rounded-lg text-[12px] font-semibold cursor-pointer hover:bg-surface-4"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[12px] font-semibold cursor-pointer hover:brightness-110 disabled:opacity-60"
            onClick={run}
            disabled={running}
          >
            {running
              ? <><Icons.spinner size={12} className="animate-spin" /> Ejecutando…</>
              : <><Icons.play size={12} /> Ejecutar reporte</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Result table ──────────────────────────────────────────────────────────────

const RESULT_PAGE = 100;

interface ResultTableProps {
  report: ReportDefinition;
  result: ReportResult;
  onClose: () => void;
}

const ResultTable: React.FC<ResultTableProps> = ({ report, result, onClose }) => {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(result.rows.length / RESULT_PAGE));
  const pageRows   = result.rows.slice(page * RESULT_PAGE, (page + 1) * RESULT_PAGE);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-[4px]" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-[14px] w-[min(95vw,1200px)] max-h-[90vh] flex flex-col fade-in shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Icons.reports size={16} className="text-primary" />
            <div className="text-[15px] font-bold text-foreground">{report.name}</div>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
              {result.total.toLocaleString()} fila{result.total !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success border border-success/20 rounded-lg text-[12px] font-semibold cursor-pointer hover:bg-success/20"
              onClick={() => exportResultCSV(report, result)}
            >
              <Icons.dl size={13} /> Exportar CSV
            </button>
            <button
              className="text-text-muted hover:text-foreground p-1.5 rounded-lg hover:bg-surface-3"
              onClick={onClose}
            ><Icons.x size={16} /></button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          {result.rows.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-text-muted text-[14px]">
              El reporte no devolvió resultados con los filtros seleccionados.
            </div>
          ) : (
            <table className="w-full border-collapse text-[12px]">
              <thead className="sticky top-0">
                <tr>
                  {result.columns.map(col => (
                    <th key={col} className="text-left py-2.5 px-4 font-semibold text-text-muted uppercase tracking-wide text-[10px] bg-surface-2 border-b border-border whitespace-nowrap">
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => (
                  <tr key={i} className="hover:bg-surface-2 transition-colors">
                    {result.columns.map(col => (
                      <td key={col} className="py-2.5 px-4 text-foreground border-b border-border max-w-[260px] truncate" title={String(row[col] ?? '')}>
                        {row[col] === null || row[col] === undefined ? <span className="text-text-muted">—</span> : String(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 px-6 py-3 border-t border-border shrink-0">
            <button
              className="px-3 py-1.5 rounded text-[12px] font-semibold bg-surface-3 border border-border text-foreground cursor-pointer disabled:opacity-40 hover:bg-surface-4 disabled:cursor-not-allowed"
              onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              ← Anterior
            </button>
            <span className="text-[12px] text-text-muted">
              Página {page + 1} de {totalPages}
            </span>
            <button
              className="px-3 py-1.5 rounded text-[12px] font-semibold bg-surface-3 border border-border text-foreground cursor-pointer disabled:opacity-40 hover:bg-surface-4 disabled:cursor-not-allowed"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              Siguiente →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Reports component ────────────────────────────────────────────────────

const Reports: React.FC = () => {
  const [reports,   setReports]   = useState<ReportDefinition[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [running,   setRunning]   = useState<ReportDefinition | null>(null);
  const [result,    setResult]    = useState<{ report: ReportDefinition; data: ReportResult } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetReports();
      setReports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar reportes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 gap-3 text-text-muted">
        <Icons.spinner size={20} className="animate-spin" />
        <span className="text-[14px]">Cargando reportes…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <Icons.alert size={28} className="text-destructive" />
        <div className="text-[14px] text-destructive">{error}</div>
        <button className="px-4 py-2 bg-surface-3 border border-border rounded-lg text-[12px] font-semibold cursor-pointer hover:bg-surface-4" onClick={load}>
          Reintentar
        </button>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Icons.reports size={28} className="text-primary" />
        </div>
        <div>
          <div className="text-[16px] font-bold text-foreground mb-1">Sin reportes configurados</div>
          <div className="text-[13px] text-text-muted max-w-[400px]">
            Agrega las definiciones de reportes en{' '}
            <code className="bg-surface-3 px-1.5 py-0.5 rounded text-[12px] font-mono">
              backend/src/config/reports.config.ts
            </code>{' '}
            apuntando a las funciones PostgreSQL que quieras exponer.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map(r => (
          <div
            key={r.id}
            className="bg-card border border-border rounded-[12px] p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => setRunning(r)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Icons.reports size={18} className="text-primary" />
              </div>
              <div className="flex items-center gap-1 px-2.5 py-1 bg-surface-3 rounded-full text-[11px] font-semibold text-text-secondary group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <Icons.play size={10} /> Ejecutar
              </div>
            </div>
            <div className="text-[14px] font-bold text-foreground mb-1">{r.name}</div>
            {r.description && (
              <div className="text-[12px] text-text-muted leading-relaxed">{r.description}</div>
            )}
            {r.params.length > 0 && (
              <div className="mt-3 flex items-center gap-1 text-[11px] text-text-muted">
                <Icons.filter size={11} />
                {r.params.length} filtro{r.params.length !== 1 ? 's' : ''}
                {r.params.filter(p => p.required).length > 0 && (
                  <span className="text-destructive">
                    ({r.params.filter(p => p.required).length} requerido{r.params.filter(p => p.required).length !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal: parameter input */}
      {running && (
        <RunModal
          report={running}
          onClose={() => setRunning(null)}
          onResult={data => setResult({ report: running, data })}
        />
      )}

      {/* Modal: result table */}
      {result && (
        <ResultTable
          report={result.report}
          result={result.data}
          onClose={() => setResult(null)}
        />
      )}
    </div>
  );
};

export default Reports;
