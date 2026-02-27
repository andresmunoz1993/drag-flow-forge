import React, { useState, useMemo } from 'react';
import type { Board, CustomField } from '@/types';
import { CF_TYPES } from '@/types';
import { Icons } from './Icons';
import { generateId } from '@/lib/storage';


interface FieldFormProps {
  field: (CustomField & { boardId?: string }) | null;
  boards: Board[];
  onSave: (field: CustomField, boardId: string, oldBoardId?: string) => void;
  onClose: () => void;
}

export const FieldForm: React.FC<FieldFormProps> = ({ field, boards, onSave, onClose }) => {
  const isEdit = !!field;
  const [name, setName] = useState(field?.name || '');
  const [type, setType] = useState<CustomField['type']>(field?.type || 'dropdown');
  const [options, setOptions] = useState(field?.options?.join(', ') || '');
  const [boardId, setBoardId] = useState(field?.boardId || boards[0]?.id || '');
  const [useFormula, setUseFormula] = useState(field?.formula === 'createdAt');
  const [formulaDays, setFormulaDays] = useState(field?.formulaDays ?? 15);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Nombre requerido'); return; }
    if (!boardId) { setError('Tablero requerido'); return; }
    const cf: CustomField = {
      id: field?.id || generateId(), name: name.trim(), type,
      options: type === 'dropdown' ? options.split(',').map(o => o.trim()).filter(Boolean) : [],
      ...(type === 'date' && useFormula ? { formula: 'createdAt' as const, formulaDays } : {}),
    };
    onSave(cf, boardId, field?.boardId);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-card border border-border rounded-[14px] w-[480px] max-h-[85vh] overflow-y-auto p-7 fade-in" onClick={e => e.stopPropagation()}>
        <div className="text-[17px] font-bold text-foreground mb-5">{isEdit ? 'Editar' : 'Nuevo'} Campo</div>
        {error && <div className="p-3 rounded-lg text-[13px] mb-4 bg-destructive/10 text-destructive">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Nombre del Campo</label>
            <input className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary" value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Ej: Categoría" />
          </div>
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Tablero Asociado</label>
            <select className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none cursor-pointer" value={boardId} onChange={e => setBoardId(e.target.value)}>
              {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Tipo de Campo</label>
            <select className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none cursor-pointer" value={type} onChange={e => setType(e.target.value as CustomField['type'])}>
              {Object.entries(CF_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {type === 'dropdown' && (
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Opciones (separadas por coma)</label>
              <input className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary" value={options} onChange={e => setOptions(e.target.value)} placeholder="Opción 1, Opción 2" />
            </div>
          )}
          {type === 'date' && (
            <div className="mb-4 p-4 bg-surface-2 border border-border rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer select-none mb-1">
                <input type="checkbox" className="w-4 h-4 accent-primary" checked={useFormula}
                  onChange={e => setUseFormula(e.target.checked)} />
                <span className="text-[12px] font-semibold text-foreground flex items-center gap-1.5"><Icons.formula size={13} /> Calcular automáticamente</span>
              </label>
              <div className="text-[11px] text-text-muted mb-2">Si el tablero tiene landing activo, este campo se rellenará solo y no podrá editarse.</div>
              {useFormula && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[12px] text-text-muted">Fecha de creación +</span>
                  <input type="number" min={1} max={365} className="w-16 py-1.5 px-2 bg-card border border-border rounded text-foreground text-[12px] outline-none focus:border-primary text-center"
                    value={formulaDays} onChange={e => setFormulaDays(Math.max(1, parseInt(e.target.value) || 1))} />
                  <span className="text-[12px] text-text-muted">días</span>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 justify-end mt-6">
            <button type="button" className="px-5 py-2.5 bg-surface-3 text-foreground border border-border rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-surface-4" onClick={onClose}>Cancelar</button>
            <button type="submit" className="px-5 py-2.5 bg-success text-success-foreground rounded-lg text-[13px] font-semibold cursor-pointer hover:brightness-110">{isEdit ? 'Guardar' : 'Crear'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ===== Centralized Custom Fields List ===== */
interface CFListProps {
  boards: Board[];
  onAdd: () => void;
  onEdit: (f: CustomField & { boardId: string; boardName: string }) => void;
  onDelete: (f: CustomField & { boardId: string; boardName: string }) => void;
}

const CustomFieldList: React.FC<CFListProps> = ({ boards, onAdd, onEdit, onDelete }) => {
  const allFields = useMemo(() => {
    const result: (CustomField & { boardId: string; boardName: string })[] = [];
    boards.forEach(b => (b.customFields || []).forEach(cf => result.push({ ...cf, boardId: b.id, boardName: b.name })));
    return result;
  }, [boards]);

  return (
    <div className="fade-in">
      <div className="flex justify-end mb-4">
        <button className="flex items-center gap-1.5 px-3 py-[7px] bg-success text-success-foreground rounded-md text-[12px] font-semibold cursor-pointer hover:brightness-110" onClick={onAdd}><Icons.plus size={14} /> Nuevo Campo</button>
      </div>
      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Nombre', 'Tipo', 'Tablero', 'Opciones', ''].map(h => (
                <th key={h} className="text-left py-3 px-4 text-[11px] font-semibold text-text-muted uppercase tracking-wide bg-surface-2 border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allFields.map(f => (
              <tr key={f.id} className="hover:bg-surface-2 transition-colors">
                <td className="py-3 px-4 text-[13px] font-semibold text-foreground border-b border-border">{f.name}</td>
                <td className="py-3 px-4 border-b border-border"><span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-surface-3 text-text-secondary">{CF_TYPES[f.type]}</span></td>
                <td className="py-3 px-4 text-[13px] border-b border-border">{f.boardName}</td>
                <td className="py-3 px-4 text-[12px] text-text-muted border-b border-border max-w-[300px] truncate">
                  {f.formula === 'createdAt' && f.formulaDays !== undefined
                    ? <span className="flex items-center gap-1 text-primary font-semibold"><Icons.formula size={11} /> Creación +{f.formulaDays} días</span>
                    : f.type === 'dropdown' ? f.options.join(', ') : '—'}
                </td>
                <td className="py-3 px-4 border-b border-border">
                  <div className="flex gap-1">
                    <button className="px-2 py-1 bg-surface-3 text-foreground border border-border rounded text-[11px] cursor-pointer hover:bg-surface-4" onClick={() => onEdit(f)}><Icons.edit size={12} /></button>
                    <button className="px-2 py-1 bg-destructive/10 text-destructive rounded text-[11px] cursor-pointer hover:bg-destructive/20" onClick={() => onDelete(f)}><Icons.trash size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!allFields.length && <tr><td colSpan={5} className="text-center py-10 text-text-muted">No hay campos personalizados configurados.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomFieldList;
