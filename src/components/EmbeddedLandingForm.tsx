import React, { useState, useMemo } from 'react';
import type { Board, CustomField, FileAttachment, User, SapOrderResult } from '@/types';
import { readFileAsDataUrl, MAX_FILE_SIZE, formatSize, getFileExt } from '@/lib/storage';
import { searchSapDocument, SapError } from '@/lib/sapService';
import { Icons } from './Icons';

interface EmbeddedLandingFormProps {
  board: Board;
  users: User[];
  onCreateCard: (data: {
    title: string;
    description: string;
    assigneeId: string;
    columnId: string;
    files: FileAttachment[];
    customData: Record<string, string>;
  }) => Promise<string>; // returns the created code
}

const FileRow: React.FC<{ f: FileAttachment; onRemove?: () => void }> = ({ f, onRemove }) => (
  <div className="flex items-center gap-2 p-2.5 bg-surface-2 border border-border rounded-lg">
    <span className="shrink-0 w-9 h-9 rounded flex items-center justify-center text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">{getFileExt(f.name)}</span>
    <div className="flex-1 min-w-0">
      <div className="text-[13px] font-semibold text-foreground truncate">{f.name}</div>
      <div className="text-[11px] text-text-muted">{formatSize(f.size)}</div>
    </div>
    {onRemove && (
      <button type="button" onClick={onRemove} className="shrink-0 w-6 h-6 flex items-center justify-center text-text-muted hover:text-destructive cursor-pointer bg-transparent border-none rounded">
        <Icons.x size={13} />
      </button>
    )}
  </div>
);

/* ─── SAP result dialog ─── */
interface SapDialogProps {
  result: SapOrderResult;
  onConfirm: () => void;
  onReject: () => void;
}

const SapDialog: React.FC<SapDialogProps> = ({ result, onConfirm, onReject }) => {
  const fmt = (n: number, cur: string) =>
    n.toLocaleString('es-CO', { style: 'currency', currency: cur || 'COP', minimumFractionDigits: 0 });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] backdrop-blur-[4px]">
      <div className="bg-card border border-border rounded-[14px] w-[420px] p-7 fade-in text-center">
        <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center mx-auto mb-4">
          <Icons.package size={24} className="text-primary" />
        </div>
        <div className="text-[17px] font-bold text-foreground mb-1">Documento encontrado</div>
        <div className="text-[13px] text-text-muted mb-5">Por favor confirma que estos son tus datos</div>

        <div className="bg-surface-2 border border-border rounded-lg p-4 mb-5 text-left space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">N° Documento</span>
            <span className="text-[14px] font-bold text-foreground">{result.docNum}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Artículos</span>
            <span className="text-[13px] text-foreground">{result.itemCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">Valor total</span>
            <span className="text-[13px] font-semibold text-foreground">{fmt(result.totalValue, result.currency)}</span>
          </div>
          <div className="pt-2 border-t border-border">
            <div className="text-[11px] font-semibold text-text-muted uppercase tracking-wide mb-1">Persona que lo atendió</div>
            <div className="text-[14px] font-semibold text-foreground">{result.salesPersonName || '—'}</div>
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={onReject}
            className="flex-1 py-2.5 bg-surface-3 text-foreground border border-border rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-surface-4">
            Esos no son mis datos
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-[13px] font-bold cursor-pointer hover:brightness-110 flex items-center justify-center gap-1.5">
            <Icons.check size={14} /> Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

const EmbeddedLandingForm: React.FC<EmbeddedLandingFormProps> = ({ board, users, onCreateCard }) => {
  // First admin_tablero (not total) of the board
  const defaultAssignee0 = useMemo(
    () => users.find(u => u.active && !u.isAdminTotal && u.boardRoles[board.id] === 'admin_tablero') ?? null,
    [users, board.id],
  );
  const [assigneeOverride, setAssigneeOverride] = useState<User | null>(null);
  const effectiveAssignee = assigneeOverride ?? defaultAssignee0;

  // Visible custom fields (exclude formula fields)
  const visibleFields = useMemo(
    () => (board.customFields || []).filter(cf => !(cf.formula === 'createdAt' && cf.formulaDays !== undefined)),
    [board],
  );

  const sortedCols = [...board.columns].sort((a, b) => a.order - b.order);
  const firstCol = sortedCols[0];

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [customData, setCD] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    (board.customFields || []).forEach(cf => { d[cf.id] = ''; });
    return d;
  });
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [fileError, setFileError] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);

  // SAP state
  const hasSap = !!(board.sap);
  const [sapDocNum, setSapDocNum] = useState('');
  const [sapLoading, setSapLoading] = useState(false);
  const [sapResult, setSapResult] = useState<SapOrderResult | null>(null);
  const [sapConfirmed, setSapConfirmed] = useState(false);
  const [sapMandatory, setSapMandatory] = useState(true);
  const [sapError, setSapError] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    setFileError('');
    for (const file of list) {
      if (file.size > MAX_FILE_SIZE) { setFileError(`"${file.name}" supera 10MB`); continue; }
      const data = await readFileAsDataUrl(file);
      setFiles(p => [...p, { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: file.name, size: file.size, type: file.type, data }]);
    }
  };

  const handleSapSearch = async () => {
    if (!sapDocNum.trim() || !board.sap) return;
    setSapLoading(true);
    setSapError('');
    setSapResult(null);
    try {
      const result = await searchSapDocument(sapDocNum.trim(), board.sap);
      setSapResult(result);
    } catch (e) {
      setSapError(e instanceof SapError ? e.message : 'Error al consultar SAP');
    } finally {
      setSapLoading(false);
    }
  };

  const handleSapConfirm = () => {
    if (!sapResult) return;
    const matched = users.find(u => u.active && u.idSAP && u.idSAP === sapResult.salesPersonCode);
    if (matched) setAssigneeOverride(matched);
    setSapConfirmed(true);
    setSapResult(null);
  };

  const handleSapReject = () => {
    setSapMandatory(false);
    setSapResult(null);
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('El título es obligatorio.'); return; }
    if (hasSap && sapMandatory && !sapConfirmed) { setError('Debes verificar tu número de documento en SAP antes de continuar.'); return; }
    if (!effectiveAssignee) { setError('No hay un administrador configurado para este tablero.'); return; }
    if (!firstCol) { setError('El tablero no tiene carriles configurados.'); return; }
    if (files.length === 0) { setError('Debes adjuntar al menos un archivo.'); return; }

    setSubmitting(true);
    try {
      const code = await onCreateCard({
        title: title.trim(),
        description: desc,
        assigneeId: effectiveAssignee.id,
        columnId: firstCol.id,
        files,
        customData,
      });
      setSubmitted(code);
    } catch (err: any) {
      setError(err.message ?? 'Error al crear la solicitud. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setTitle(''); setDesc(''); setFiles([]); setFileError(''); setError('');
    setCD(Object.fromEntries((board.customFields || []).map(cf => [cf.id, ''])));
    setSubmitted(null); setSapDocNum(''); setSapResult(null); setSapConfirmed(false); setSapMandatory(true); setSapError(''); setAssigneeOverride(null);
  };

  const renderField = (cf: CustomField) => {
    const val = customData[cf.id] || '';
    const onChange = (v: string) => setCD(p => ({ ...p, [cf.id]: v }));
    const cls = 'w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary';
    switch (cf.type) {
      case 'dropdown':
        return (
          <select className={cls + ' cursor-pointer'} value={val} onChange={e => onChange(e.target.value)}>
            <option value="">Seleccionar...</option>
            {cf.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case 'date': return <input className={cls} type="date" value={val} onChange={e => onChange(e.target.value)} />;
      case 'number': return <input className={cls} type="number" value={val} onChange={e => onChange(e.target.value)} />;
      default: return <input className={cls} value={val} onChange={e => onChange(e.target.value)} />;
    }
  };

  /* ─── Success ─── */
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 fade-in">
        <div className="w-16 h-16 rounded-full bg-success/10 border-2 border-success/30 flex items-center justify-center mb-5">
          <Icons.check size={28} className="text-success" />
        </div>
        <div className="text-[20px] font-bold text-foreground mb-2">¡Solicitud enviada!</div>
        <div className="text-[14px] text-text-muted mb-3">El caso ha sido registrado exitosamente.</div>
        <div className="px-4 py-2 rounded-full bg-primary/10 text-primary text-[15px] font-bold border border-primary/20 mb-4">{submitted}</div>
        {effectiveAssignee && (
          <div className="text-[13px] text-text-muted mb-6">Asignado a <strong className="text-text-secondary">{effectiveAssignee.fullName}</strong></div>
        )}
        <button onClick={reset} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold cursor-pointer hover:brightness-110">
          <Icons.plus size={14} /> Nueva solicitud
        </button>
      </div>
    );
  }

  /* ─── Form ─── */
  return (
    <div className="max-w-2xl mx-auto fade-in">
      {/* SAP dialog */}
      {sapResult && <SapDialog result={sapResult} onConfirm={handleSapConfirm} onReject={handleSapReject} />}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[13px] text-text-muted mb-1">
          <Icons.globe size={13} /> Portal público de solicitudes
        </div>
        <h2 className="text-[22px] font-bold text-foreground">{board.name}</h2>
        <p className="text-[13px] text-text-muted mt-1">
          Esta es la vista del formulario que verá cualquier persona con acceso al enlace.
        </p>
      </div>

      {/* Assignee info */}
      {effectiveAssignee && (
        <div className="flex items-center gap-3 p-3.5 bg-surface-2 border border-border rounded-lg mb-5 text-[13px]">
          <div className="w-8 h-8 rounded-full bg-warning/10 text-warning flex items-center justify-center text-[11px] font-bold shrink-0">
            {effectiveAssignee.fullName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <span className="text-text-muted">Responsable automático: </span>
            <strong className="text-foreground">{effectiveAssignee.fullName}</strong>
          </div>
          {sapConfirmed && (
            <span className="flex items-center gap-1 text-[11px] text-primary"><Icons.sap size={11} /> asignado desde SAP</span>
          )}
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg text-[13px] mb-5 bg-destructive/10 text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-[14px] p-7">
        {/* SAP search */}
        {hasSap && (
          <div className="mb-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
              <Icons.sap size={11} /> N° Factura / Remisión / Pedido
              {sapMandatory && <span className="text-destructive">*</span>}
              {!sapMandatory && <span className="normal-case font-normal text-text-muted">(opcional)</span>}
            </label>
            {sapConfirmed ? (
              <div className="flex items-center gap-2 py-2.5 px-3.5 bg-success/10 border border-success/30 rounded-lg text-[13px]">
                <Icons.shield size={14} className="text-success" />
                <span className="text-success font-semibold">{sapDocNum}</span>
                <span className="text-text-muted flex-1">verificado en SAP</span>
                <button type="button"
                  onClick={() => { setSapConfirmed(false); setSapDocNum(''); setSapMandatory(true); setAssigneeOverride(null); }}
                  className="text-[11px] text-text-muted hover:text-destructive underline bg-transparent border-none cursor-pointer">cambiar</button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    className="flex-1 py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary font-mono placeholder:text-text-muted"
                    placeholder="Ej: 74001"
                    value={sapDocNum}
                    onChange={e => { setSapDocNum(e.target.value); setSapError(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSapSearch(); } }}
                    disabled={sapLoading}
                  />
                  <button
                    type="button"
                    onClick={handleSapSearch}
                    disabled={!sapDocNum.trim() || sapLoading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold cursor-pointer hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed">
                    {sapLoading
                      ? <Icons.spinner size={14} className="animate-spin" />
                      : <Icons.search size={14} />}
                    Buscar
                  </button>
                </div>
                {sapError && <div className="text-[12px] text-destructive mt-1.5">{sapError}</div>}
                {!sapMandatory && (
                  <div className="text-[11px] text-text-muted mt-1.5">
                    No encontraste tu documento. Puedes continuar sin verificación SAP.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Title */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
            Título <span className="text-destructive">*</span>
          </label>
          <input
            className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary"
            placeholder="Describe brevemente la solicitud"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Descripción</label>
          <textarea
            className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary min-h-[90px] resize-y leading-relaxed"
            placeholder="Detalla la solicitud (opcional)"
            value={desc}
            onChange={e => setDesc(e.target.value)}
          />
        </div>

        {/* Custom fields (non-formula) */}
        {visibleFields.map(cf => (
          <div key={cf.id} className="mb-4">
            <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">{cf.name}</label>
            {renderField(cf)}
          </div>
        ))}

        {/* Files */}
        <div className="mb-5">
          <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
            Adjuntos <span className="text-destructive">*</span>
            <span className="ml-2 normal-case font-normal text-text-muted">(obligatorio, máx. 2MB por archivo)</span>
          </label>
          <div className="space-y-1.5 mb-2">
            {files.map(f => (
              <FileRow key={f.id} f={f} onRemove={() => setFiles(p => p.filter(x => x.id !== f.id))} />
            ))}
          </div>
          <label className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${files.length === 0 ? 'border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary' : 'border-border bg-surface-2 hover:bg-surface-3 text-text-muted'}`}>
            <Icons.clip size={14} />
            <span className="text-[13px] font-semibold">{files.length === 0 ? 'Seleccionar archivo (requerido)' : 'Agregar otro archivo'}</span>
            <input type="file" className="hidden" multiple onChange={handleFile} />
          </label>
          {fileError && <div className="text-[12px] text-destructive mt-1">{fileError}</div>}
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="text-[11px] text-text-muted">
            Los casos creados aparecerán en el tablero <strong className="text-text-secondary">{board.name}</strong>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-success text-success-foreground rounded-lg text-[13px] font-bold cursor-pointer hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? <Icons.spinner size={14} className="animate-spin" /> : <Icons.check size={14} />}
            {submitting ? 'Enviando...' : 'Enviar Solicitud'}
          </button>
        </div>
      </form>

      {/* Landing URL */}
      <div className="mt-4 p-3.5 bg-surface-2 border border-border rounded-lg flex items-center gap-3">
        <Icons.globe size={14} className="text-text-muted shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-text-muted mb-0.5">URL pública del formulario</div>
          <code className="text-[12px] text-foreground font-mono truncate block">{window.location.origin}/landing/{board.id}</code>
        </div>
        <button
          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/landing/${board.id}`)}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-3 border border-border text-foreground rounded text-[11px] font-semibold cursor-pointer hover:bg-surface-4"
          title="Copiar URL">
          <Icons.copy size={11} /> Copiar
        </button>
        <a
          href={`/landing/${board.id}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-3 border border-border text-foreground rounded text-[11px] font-semibold hover:bg-surface-4"
          title="Abrir como cliente">
          <Icons.externalLink size={11} /> Ver como cliente
        </a>
      </div>
    </div>
  );
};

export default EmbeddedLandingForm;
