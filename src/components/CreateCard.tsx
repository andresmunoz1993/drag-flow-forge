import React, { useState } from 'react';
import type { Board, User, CustomField, FileAttachment } from '@/types';
import { Icons } from './Icons';
import FileUpload from './FileUpload';

const CARD_TYPES = ['Bug', 'Mejora', 'Soporte', 'Tarea', 'Otro'];

interface CreateCardProps {
  board: Board;
  users: User[];
  me: User;
  onSave: (data: { title: string; description: string; assigneeId: string; columnId: string; priority: 'alta' | 'media' | 'baja' | ''; type: string; files: FileAttachment[]; customData: Record<string, string> }) => void;
  onClose: () => void;
}

const CreateCard: React.FC<CreateCardProps> = ({ board, users, me, onSave, onClose }) => {
  const assignable = users.filter(u => u.active && (u.isAdminTotal || u.boardRoles[board.id]));
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [assigneeId, setAssigneeId] = useState(assignable[0]?.id || '');
  const [priority, setPriority] = useState<'alta' | 'media' | 'baja' | ''>('');
  const [cardType, setCardType] = useState('');
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [customData, setCD] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    (board.customFields || []).forEach(f => { d[f.id] = ''; });
    return d;
  });
  const [error, setError] = useState('');

  const sortedCols = [...board.columns].sort((a, b) => a.order - b.order);
  const firstCol = sortedCols[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim()) { setError('Título requerido'); return; }
    if (!firstCol) { setError('Sin carriles'); return; }
    if (!assigneeId) { setError('Responsable requerido'); return; }
    onSave({ title: title.trim(), description: desc, assigneeId, columnId: firstCol.id, priority, type: cardType, files, customData });
  };

  const renderField = (cf: CustomField) => {
    const val = customData[cf.id] || '';
    const onChange = (v: string) => setCD(p => ({ ...p, [cf.id]: v }));
    switch (cf.type) {
      case 'dropdown': return <select className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none cursor-pointer" value={val} onChange={e => onChange(e.target.value)}><option value="">Seleccionar...</option>{cf.options.map(o => <option key={o} value={o}>{o}</option>)}</select>;
      case 'date': return <input className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary" type="date" value={val} onChange={e => onChange(e.target.value)} />;
      case 'number': return <input className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary" type="number" value={val} onChange={e => onChange(e.target.value)} />;
      default: return <input className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary" value={val} onChange={e => onChange(e.target.value)} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-card border border-border rounded-[14px] w-[560px] max-h-[85vh] overflow-y-auto p-7 fade-in" onClick={e => e.stopPropagation()}>
        <div className="text-[17px] font-bold text-foreground mb-5">Crear Caso — {board.name}</div>
        <div className="flex gap-4 mb-4 text-[12px] text-text-muted">
          <div><strong className="text-text-secondary">Carril:</strong> {firstCol?.name || '—'}</div>
          <div><strong className="text-text-secondary">Informador:</strong> {me.fullName}</div>
        </div>
        {error && <div className="p-3 rounded-lg text-[13px] mb-4 bg-destructive/10 text-destructive">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Título</label>
            <input className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Descripción</label>
            <textarea className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary min-h-[80px] resize-y leading-relaxed" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-x-3.5 mb-4">
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Prioridad</label>
              <select className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none cursor-pointer" value={priority} onChange={e => setPriority(e.target.value as 'alta' | 'media' | 'baja' | '')}>
                <option value="">—</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Tipo</label>
              <select className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none cursor-pointer" value={cardType} onChange={e => setCardType(e.target.value)}>
                <option value="">—</option>
                {CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Responsable</label>
            <select className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none cursor-pointer" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
              {assignable.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </div>
          {(board.customFields || []).map(cf => (
            <div key={cf.id} className="mb-4">
              <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">{cf.name}</label>
              {renderField(cf)}
            </div>
          ))}
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Archivos</label>
            <FileUpload files={files} onAdd={f => setFiles(p => [...p, f])} onRemove={id => setFiles(p => p.filter(x => x.id !== id))} />
          </div>
          <div className="flex gap-2 justify-end mt-6">
            <button type="button" className="px-5 py-2.5 bg-surface-3 text-foreground border border-border rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-surface-4" onClick={onClose}>Cancelar</button>
            <button type="submit" className="flex items-center gap-1.5 px-5 py-2.5 bg-success text-success-foreground rounded-lg text-[13px] font-semibold cursor-pointer hover:brightness-110"><Icons.plus size={14} /> Crear Caso</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCard;
