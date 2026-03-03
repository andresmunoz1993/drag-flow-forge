import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import type { Board, Card, CustomField, FileAttachment, User, SapOrderResult } from '@/types';
import {
  generateId, readFileAsDataUrl, MAX_FILE_SIZE, formatSize, getFileExt,
  applyFormulaFields,
} from '@/lib/storage';
import { apiGetBoards, apiGetUsers, apiCreateCard } from '@/lib/api';
import { searchSapDocument, SapError } from '@/lib/sapService';

/* ─── helpers ─── */
const FileRow: React.FC<{ f: FileAttachment; onRemove?: () => void }> = ({ f, onRemove }) => (
  <div className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg">
    <span className="shrink-0 w-9 h-9 rounded flex items-center justify-center text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">{getFileExt(f.name)}</span>
    <div className="flex-1 min-w-0">
      <div className="text-[13px] font-semibold text-gray-800 truncate">{f.name}</div>
      <div className="text-[11px] text-gray-400">{formatSize(f.size)}</div>
    </div>
    {onRemove && (
      <button type="button" onClick={onRemove} className="shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 cursor-pointer bg-transparent border-none rounded">✕</button>
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-7 text-center">
        <div className="w-14 h-14 rounded-full bg-blue-50 border-2 border-blue-200 flex items-center justify-center mx-auto mb-4 text-2xl">📦</div>
        <div className="text-[17px] font-bold text-gray-900 mb-1">Documento encontrado</div>
        <div className="text-[13px] text-gray-500 mb-5">Por favor confirma que estos son tus datos</div>

        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-5 text-left space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide">N° Documento</span>
            <span className="text-[14px] font-bold text-gray-800">{result.docNum}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide">Artículos</span>
            <span className="text-[13px] text-gray-700">{result.itemCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide">Valor total</span>
            <span className="text-[13px] font-semibold text-gray-700">{fmt(result.totalValue, result.currency)}</span>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <div className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Persona que lo atendió</div>
            <div className="text-[14px] font-semibold text-gray-800">{result.salesPersonName || '—'}</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onReject}
            className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-gray-200 transition-colors">
            Esos no son mis datos
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-[13px] font-bold cursor-pointer hover:bg-blue-700 transition-colors">
            Confirmar ✓
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── page ─── */
const LandingPage: React.FC = () => {
  const { boardId } = useParams<{ boardId: string }>();

  // Cargar datos desde API (async)
  const [boards, setBoards] = useState<Board[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiGetBoards(), apiGetUsers()])
      .then(([b, u]) => { setBoards(b); setAllUsers(u); })
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, []);

  const board = boards.find(b => b.id === boardId);

  // First board admin (not total admin)
  const [defaultAssignee, setDefaultAssignee] = useState<User | null>(null);

  // Asignar default assignee cuando se cargan datos
  useEffect(() => {
    if (!allUsers.length || !boardId) return;
    const assignee = allUsers.find(u => u.active && !u.isAdminTotal && u.boardRoles?.[boardId] === 'admin_tablero') ?? null;
    setDefaultAssignee(assignee);
  }, [allUsers, boardId]);

  // Visible custom fields (exclude formula fields)
  const visibleFields = useMemo(
    () => (board?.customFields || []).filter(cf => !(cf.formula === 'createdAt' && cf.formulaDays !== undefined)),
    [board],
  );

  // Form state
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [customData, setCD] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [fileError, setFileError] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Inicializar customData cuando board carga
  useEffect(() => {
    if (!board) return;
    const d: Record<string, string> = {};
    (board.customFields || []).forEach(cf => { d[cf.id] = ''; });
    setCD(d);
  }, [board]);

  // SAP state
  const hasSap = !!(board?.sap);
  const [sapDocNum, setSapDocNum] = useState('');
  const [sapLoading, setSapLoading] = useState(false);
  const [sapResult, setSapResult] = useState<SapOrderResult | null>(null);
  const [sapConfirmed, setSapConfirmed] = useState(false);
  const [sapMandatory, setSapMandatory] = useState(true);
  const [sapError, setSapError] = useState('');

  /* ─── loading ─── */
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="text-gray-400 text-[14px]">Cargando...</div>
      </div>
    );
  }

  /* ─── not available ─── */
  if (!board || !board.landing?.enabled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-md w-full text-center">
          <div className="text-4xl mb-4">🔒</div>
          <div className="text-[18px] font-bold text-gray-800 mb-2">Portal no disponible</div>
          <div className="text-[14px] text-gray-500">Este tablero no tiene un portal público habilitado.</div>
        </div>
      </div>
    );
  }

  /* ─── success screen ─── */
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto mb-5 text-2xl">✓</div>
          <div className="text-[20px] font-bold text-gray-800 mb-2">¡Solicitud enviada!</div>
          <div className="text-[14px] text-gray-500 mb-4">Tu caso ha sido registrado exitosamente.</div>
          <div className="inline-block px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-[15px] font-bold border border-blue-100 mb-6">{submitted}</div>
          {defaultAssignee && (
            <div className="text-[13px] text-gray-400 mb-6">Ha sido asignado a <strong className="text-gray-600">{defaultAssignee.fullName}</strong></div>
          )}
          <button
            onClick={() => { setTitle(''); setDesc(''); setFiles([]); setCD({}); setSubmitted(null); setSapDocNum(''); setSapResult(null); setSapConfirmed(false); setSapMandatory(true); setSapError(''); }}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-blue-700 transition-colors">
            Enviar otra solicitud
          </button>
        </div>
      </div>
    );
  }

  /* ─── SAP search ─── */
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
    const matched = allUsers.find(u => u.active && u.idSAP && u.idSAP === sapResult.salesPersonCode);
    if (matched) setDefaultAssignee(matched);
    setSapConfirmed(true);
    setSapResult(null);
  };

  const handleSapReject = () => {
    setSapMandatory(false);
    setSapResult(null);
  };

  /* ─── handlers ─── */
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    setFileError('');
    for (const file of list) {
      if (file.size > MAX_FILE_SIZE) { setFileError(`"${file.name}" supera 10MB`); continue; }
      const data = await readFileAsDataUrl(file);
      const fa: FileAttachment = { id: generateId(), name: file.name, size: file.size, type: file.type, data };
      setFiles(p => [...p, fa]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('El título es obligatorio.'); return; }
    if (hasSap && sapMandatory && !sapConfirmed) { setError('Debes verificar tu número de documento en SAP antes de continuar.'); return; }
    if (!defaultAssignee) { setError('No hay un administrador configurado para este tablero.'); return; }
    if (files.length === 0) { setError('Debes adjuntar al menos un archivo.'); return; }

    const sortedCols = [...board.columns].sort((a, b) => a.order - b.order);
    const firstCol = sortedCols[0];
    if (!firstCol) { setError('El tablero no tiene carriles configurados.'); return; }

    setSubmitting(true);
    try {
      const createdAt = new Date().toISOString();
      const finalCustomData = applyFormulaFields(board.customFields || [], customData, createdAt);

      const newCard = await apiCreateCard({
        boardId: board.id,
        columnId: firstCol.id,
        title: title.trim(),
        description: desc,
        priority: '' as Card['priority'],
        type: '',
        assigneeId: defaultAssignee.id,
        reporterId: 'external',
        reporterName: 'Portal Externo',
        createdAt,
        modifiedBy: null,
        modifiedAt: null,
        deleted: false,
        closed: false,
        closedAt: null,
        closedBy: null,
        files,
        comments: [],
        customData: finalCustomData,
        assigneeHistory: [{ id: generateId(), assigneeId: defaultAssignee.id, assigneeName: defaultAssignee.fullName, assignedAt: createdAt }],
        moveHistory: [],
      });

      setSubmitted(newCard.code);
    } catch (err: any) {
      setError(err.message ?? 'Error al enviar solicitud.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (cf: CustomField) => {
    const val = customData[cf.id] || '';
    const onChange = (v: string) => setCD(p => ({ ...p, [cf.id]: v }));
    const cls = 'w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-gray-800 text-[14px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all';
    switch (cf.type) {
      case 'dropdown':
        return (
          <select className={cls + ' cursor-pointer'} value={val} onChange={e => onChange(e.target.value)}>
            <option value="">Seleccionar...</option>
            {cf.options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case 'date':
        return <input className={cls} type="date" value={val} onChange={e => onChange(e.target.value)} />;
      case 'number':
        return <input className={cls} type="number" value={val} onChange={e => onChange(e.target.value)} />;
      default:
        return <input className={cls} value={val} onChange={e => onChange(e.target.value)} />;
    }
  };

  /* ─── render ─── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      {/* SAP dialog */}
      {sapResult && <SapDialog result={sapResult} onConfirm={handleSapConfirm} onReject={handleSapReject} />}

      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white text-[22px] font-bold mb-4 shadow-lg">A</div>
          <h1 className="text-[24px] font-bold text-gray-900">Allers</h1>
          <p className="text-[14px] text-gray-500 mt-1">Sistema de Gestión</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-blue-500">
            <h2 className="text-[18px] font-bold text-white">{board.name}</h2>
            <p className="text-[13px] text-blue-100 mt-1">Portal de Solicitudes Públicas</p>
          </div>

          <form onSubmit={handleSubmit} className="px-8 py-7">
            {error && (
              <div className="p-3.5 rounded-xl text-[13px] mb-5 bg-red-50 text-red-600 border border-red-100">
                {error}
              </div>
            )}

            {/* SAP search */}
            {hasSap && (
              <div className="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <label className="block text-[12px] font-semibold text-blue-700 uppercase tracking-wide mb-2">
                  N° Factura / Remisión / Pedido
                  {sapMandatory && <span className="text-red-400 ml-1">*</span>}
                  {!sapMandatory && <span className="text-gray-400 ml-1 normal-case font-normal">(opcional)</span>}
                </label>
                {sapConfirmed ? (
                  <div className="flex items-center gap-2 py-2.5 px-3.5 bg-green-50 border border-green-200 rounded-xl text-[13px]">
                    <span className="text-green-600 font-bold">✓</span>
                    <span className="text-green-700 font-semibold">{sapDocNum}</span>
                    <span className="text-green-600 flex-1">verificado en SAP</span>
                    <button type="button" onClick={() => { setSapConfirmed(false); setSapDocNum(''); setSapMandatory(true); }}
                      className="text-[11px] text-gray-500 hover:text-red-500 underline bg-transparent border-none cursor-pointer">cambiar</button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 py-3 px-4 bg-white border border-blue-200 rounded-xl text-gray-800 text-[14px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all font-mono"
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
                        className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-[13px] font-semibold cursor-pointer hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                        {sapLoading ? (
                          <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : '🔍'} Buscar
                      </button>
                    </div>
                    {sapError && <div className="text-[12px] text-red-500 mt-1.5">{sapError}</div>}
                    {!sapMandatory && (
                      <div className="text-[11px] text-gray-400 mt-1.5">
                        No encontraste tu documento. Puedes continuar sin verificación SAP.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Title */}
            <div className="mb-5">
              <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Título <span className="text-red-400">*</span>
              </label>
              <input
                className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-gray-800 text-[14px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                placeholder="Describe brevemente tu solicitud"
                value={title}
                onChange={e => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="mb-5">
              <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Descripción</label>
              <textarea
                className="w-full py-3 px-4 bg-white border border-gray-200 rounded-xl text-gray-800 text-[14px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all min-h-[100px] resize-y leading-relaxed"
                placeholder="Detalla tu solicitud (opcional)"
                value={desc}
                onChange={e => setDesc(e.target.value)}
              />
            </div>

            {/* Custom fields */}
            {visibleFields.map(cf => (
              <div key={cf.id} className="mb-5">
                <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-2">{cf.name}</label>
                {renderField(cf)}
              </div>
            ))}

            {/* File attachment */}
            <div className="mb-6">
              <label className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Adjuntos <span className="text-red-400">*</span>
                <span className="ml-2 normal-case font-normal text-gray-400">(obligatorio, máx. 2MB por archivo)</span>
              </label>
              <div className="space-y-2">
                {files.map(f => (
                  <FileRow key={f.id} f={f} onRemove={() => setFiles(p => p.filter(x => x.id !== f.id))} />
                ))}
              </div>
              <label className={`mt-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${files.length === 0 ? 'border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-600' : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-500'}`}>
                <span className="text-[13px] font-semibold">📎 {files.length === 0 ? 'Seleccionar archivo (requerido)' : 'Agregar otro archivo'}</span>
                <input type="file" className="hidden" multiple onChange={handleFile} />
              </label>
              {fileError && <div className="text-[12px] text-red-500 mt-1">{fileError}</div>}
            </div>

            {/* Assignee info */}
            {defaultAssignee && (
              <div className="mb-6 p-3.5 bg-gray-50 border border-gray-100 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[11px] font-bold shrink-0">
                  {defaultAssignee.fullName.split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide">Será atendido por</div>
                  <div className="text-[13px] font-semibold text-gray-700">{defaultAssignee.fullName}</div>
                </div>
                {sapConfirmed && <span className="ml-auto text-[11px] text-blue-500 flex items-center gap-1">🔗 asignado desde SAP</span>}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl text-[14px] font-bold cursor-pointer hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
              {submitting ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-gray-400 mt-6">
          Allers · Sistema de Gestión de Casos
        </p>
      </div>
    </div>
  );
};

export default LandingPage;
