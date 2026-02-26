import React, { useState } from 'react';
import type { Board, Card, Column, CustomField } from '@/types';
import { CF_TYPES } from '@/types';
import { Icons } from './Icons';
import { generateId } from '@/lib/storage';

/* ===== Board Form ===== */
interface BoardFormProps {
  board: Board | null;
  onSave: (data: { name: string; prefix: string }) => void;
  onClose: () => void;
  existingPrefixes: string[];
}

export const BoardForm: React.FC<BoardFormProps> = ({ board, onSave, onClose, existingPrefixes }) => {
  const isEdit = !!board;
  const [name, setName] = useState(board?.name || '');
  const [prefix, setPrefix] = useState(board?.prefix || '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !prefix.trim()) { setError('Requerido'); return; }
    const px = prefix.trim().toUpperCase();
    if (existingPrefixes.includes(px) && (!isEdit || px !== board!.prefix)) { setError('Prefijo existe'); return; }
    onSave({ name: name.trim(), prefix: px });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-card border border-border rounded-[14px] w-[440px] max-h-[85vh] overflow-y-auto p-7 fade-in" onClick={e => e.stopPropagation()}>
        <div className="text-[17px] font-bold text-foreground mb-5">{isEdit ? 'Editar' : 'Crear'} Tablero</div>
        {error && <div className="p-3 rounded-lg text-[13px] mb-4 bg-destructive/10 text-destructive">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Nombre</label>
            <input className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary"
              value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Prefijo</label>
            <input className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary uppercase font-semibold tracking-wider"
              value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())} maxLength={6} />
          </div>
          <div className="flex gap-2 justify-end mt-6">
            <button type="button" className="px-5 py-2.5 bg-surface-3 text-foreground border border-border rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-surface-4" onClick={onClose}>Cancelar</button>
            <button type="submit" className="px-5 py-2.5 bg-success text-success-foreground rounded-lg text-[13px] font-semibold cursor-pointer hover:brightness-110">{isEdit ? 'Guardar' : 'Crear'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ===== Column Manager ===== */
interface ColumnManagerProps {
  board: Board;
  cards: Card[];
  onSave: (cols: Column[]) => void;
  onClose: () => void;
}

export const ColumnManager: React.FC<ColumnManagerProps> = ({ board, cards, onSave, onClose }) => {
  const [cols, setCols] = useState<Column[]>([...board.columns].sort((a, b) => a.order - b.order));
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const boardCards = cards.filter(c => c.boardId === board.id && !c.deleted && !c.closed);
  const getCount = (id: string) => boardCards.filter(c => c.columnId === id).length;

  const add = () => {
    if (!newName.trim()) return;
    if (cols.find(c => c.name.toLowerCase() === newName.trim().toLowerCase())) { setError('Ya existe'); return; }
    setError('');
    setCols(p => [...p, { id: generateId(), name: newName.trim(), order: p.length }]);
    setNewName('');
  };

  const remove = (id: string) => {
    const c = getCount(id);
    if (c > 0) { setError(`${c} tarjeta${c > 1 ? 's' : ''} en este carril`); return; }
    setError('');
    setCols(p => p.filter(x => x.id !== id).map((x, i) => ({ ...x, order: i })));
  };

  const moveUp = (i: number) => {
    if (!i) return;
    setCols(p => { const n = [...p]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n.map((x, j) => ({ ...x, order: j })); });
  };

  const moveDown = (i: number) => {
    if (i >= cols.length - 1) return;
    setCols(p => { const n = [...p]; [n[i], n[i + 1]] = [n[i + 1], n[i]]; return n.map((x, j) => ({ ...x, order: j })); });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-card border border-border rounded-[14px] w-[750px] max-h-[85vh] overflow-y-auto p-7 fade-in" onClick={e => e.stopPropagation()}>
        <div className="text-[17px] font-bold text-foreground mb-5">Carriles — {board.name}</div>
        <div className="text-[12px] text-text-secondary mb-3">El <strong>último carril</strong> funciona como cierre.</div>
        {error && <div className="p-3 rounded-lg text-[13px] mb-4 bg-destructive/10 text-destructive">{error}</div>}

        <ul className="list-none">
          {cols.map((c, i) => {
            const count = getCount(c.id);
            const isLast = i === cols.length - 1;
            return (
              <li key={c.id} className={`flex items-center gap-2.5 py-2.5 px-3 bg-surface-2 border rounded-lg mb-1.5 ${isLast ? 'border-success' : 'border-border'}`}>
                <span className="text-[11px] text-text-muted font-mono min-w-[24px] text-center">{i + 1}</span>
                <span className="flex-1 text-[13px] text-foreground font-medium">
                  {c.name}
                  {isLast && <span className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-success/10 text-success">CIERRE</span>}
                </span>
                {count > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">{count}</span>}
                <div className="flex gap-1">
                  <button className="p-1 bg-transparent border-none text-text-muted cursor-pointer rounded hover:bg-surface-4 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed" onClick={() => moveUp(i)} disabled={!i}><Icons.up size={14} /></button>
                  <button className="p-1 bg-transparent border-none text-text-muted cursor-pointer rounded hover:bg-surface-4 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed" onClick={() => moveDown(i)} disabled={i >= cols.length - 1}><Icons.down size={14} /></button>
                  <button className={`p-1 bg-transparent border-none cursor-pointer rounded ${count > 0 ? 'opacity-30 cursor-not-allowed text-text-muted' : 'text-destructive hover:bg-destructive/10'}`}
                    onClick={() => remove(c.id)}><Icons.x size={14} /></button>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2 mt-3">
          <input className="flex-1 py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary placeholder:text-text-muted"
            placeholder="Nombre del carril" value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          <button className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-[12px] font-semibold cursor-pointer hover:brightness-110 disabled:opacity-50"
            onClick={add} disabled={!newName.trim()}><Icons.plus size={14} /> Agregar</button>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <button className="px-5 py-2.5 bg-surface-3 text-foreground border border-border rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-surface-4" onClick={onClose}>Cancelar</button>
          <button className="px-5 py-2.5 bg-success text-success-foreground rounded-lg text-[13px] font-semibold cursor-pointer hover:brightness-110" onClick={() => onSave(cols)}>Guardar</button>
        </div>
      </div>
    </div>
  );
};

/* ===== Custom Field Manager ===== */
interface CFManagerProps {
  board: Board;
  onSave: (fields: CustomField[]) => void;
  onClose: () => void;
}

export const CustomFieldManager: React.FC<CFManagerProps> = ({ board, onSave, onClose }) => {
  const [fields, setFields] = useState<CustomField[]>([...(board.customFields || [])]);
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomField['type']>('dropdown');
  const [options, setOptions] = useState('');
  const [error, setError] = useState('');

  const add = () => {
    if (!name.trim()) { setError('Nombre requerido'); return; }
    if (fields.find(f => f.name.toLowerCase() === name.trim().toLowerCase())) { setError('Ya existe'); return; }
    setError('');
    setFields(p => [...p, { id: generateId(), name: name.trim(), type, options: type === 'dropdown' ? options.split(',').map(o => o.trim()).filter(Boolean) : [] }]);
    setName(''); setOptions('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-card border border-border rounded-[14px] w-[750px] max-h-[85vh] overflow-y-auto p-7 fade-in" onClick={e => e.stopPropagation()}>
        <div className="text-[17px] font-bold text-foreground mb-5">Campos Personalizados — {board.name}</div>
        {error && <div className="p-3 rounded-lg text-[13px] mb-4 bg-destructive/10 text-destructive">{error}</div>}

        {fields.length > 0 ? (
          <div className="space-y-1.5 mt-2.5">
            {fields.map(f => (
              <div key={f.id} className="flex items-center gap-2 p-2 bg-surface-2 border border-border rounded-md text-[12px]">
                <span className="font-semibold text-foreground min-w-[80px]">{f.name}</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-surface-3 text-text-secondary">{CF_TYPES[f.type]}</span>
                {f.type === 'dropdown' && f.options.length > 0 && <span className="text-text-secondary flex-1 truncate">{f.options.join(', ')}</span>}
                <button className="px-2 py-1 bg-destructive/10 text-destructive rounded text-[11px] cursor-pointer" onClick={() => setFields(p => p.filter(x => x.id !== f.id))}><Icons.x size={12} /></button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-text-muted text-[13px]">Sin campos personalizados.</div>
        )}

        <div className="mt-4 p-4 bg-surface-2 rounded-lg border border-border">
          <div className="text-[12px] font-semibold text-text-secondary mb-2.5">AGREGAR CAMPO</div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="mb-2.5">
              <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Nombre</label>
              <input className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary"
                value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Categoría" />
            </div>
            <div className="mb-2.5">
              <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Tipo</label>
              <select className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none cursor-pointer"
                value={type} onChange={e => setType(e.target.value as CustomField['type'])}>
                {Object.entries(CF_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          {type === 'dropdown' && (
            <div className="mb-2.5">
              <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Opciones (separadas por coma)</label>
              <input className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary"
                value={options} onChange={e => setOptions(e.target.value)} placeholder="Opción 1, Opción 2, Opción 3" />
            </div>
          )}
          <button className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-[12px] font-semibold cursor-pointer hover:brightness-110 disabled:opacity-50"
            onClick={add} disabled={!name.trim()}><Icons.plus size={14} /> Agregar Campo</button>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <button className="px-5 py-2.5 bg-surface-3 text-foreground border border-border rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-surface-4" onClick={onClose}>Cancelar</button>
          <button className="px-5 py-2.5 bg-success text-success-foreground rounded-lg text-[13px] font-semibold cursor-pointer hover:brightness-110" onClick={() => onSave(fields)}>Guardar</button>
        </div>
      </div>
    </div>
  );
};

/* ===== Board Management Grid ===== */
interface BoardManagementProps {
  boards: Board[];
  cards: Card[];
  users: User[];
  onCreate: () => void;
  onEdit: (b: Board) => void;
  onDelete: (b: Board) => void;
  onColumns: (b: Board) => void;
  onCustomFields: (b: Board) => void;
}

import type { User } from '@/types';

const BoardManagement: React.FC<BoardManagementProps> = ({ boards, cards, users, onCreate, onEdit, onDelete, onColumns, onCustomFields }) => (
  <div className="fade-in">
    <div className="flex justify-end mb-4">
      <button className="flex items-center gap-1.5 px-3 py-[7px] bg-success text-success-foreground rounded-md text-[12px] font-semibold cursor-pointer hover:brightness-110"
        onClick={onCreate}><Icons.plus size={14} /> Nuevo</button>
    </div>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
      {boards.map(b => {
        const uc = users.filter(u => u.isAdminTotal || u.boardRoles[b.id]).length;
        const cc = cards.filter(c => c.boardId === b.id && !c.deleted && !c.closed).length;
        return (
          <div key={b.id} className="bg-card border border-border rounded-[10px] p-5 hover:border-border-strong transition-colors">
            <div className="flex items-start justify-between mb-3.5">
              <div>
                <div className="text-[15px] font-bold text-foreground">{b.name}</div>
                <div className="text-[11px] text-primary font-semibold mt-0.5">{b.prefix}</div>
              </div>
              <div className="flex gap-1">
                <button className="px-2 py-1 bg-surface-3 text-foreground border border-border rounded text-[11px] font-semibold cursor-pointer hover:bg-surface-4" title="Campos" onClick={() => onCustomFields(b)}><Icons.fields size={12} /></button>
                <button className="px-2 py-1 bg-surface-3 text-foreground border border-border rounded text-[11px] font-semibold cursor-pointer hover:bg-surface-4" title="Carriles" onClick={() => onColumns(b)}><Icons.columns size={12} /></button>
                <button className="px-2 py-1 bg-surface-3 text-foreground border border-border rounded text-[11px] font-semibold cursor-pointer hover:bg-surface-4" onClick={() => onEdit(b)}><Icons.edit size={12} /></button>
                <button className="px-2 py-1 bg-destructive/10 text-destructive rounded text-[11px] font-semibold cursor-pointer hover:bg-destructive/20" onClick={() => onDelete(b)}><Icons.trash size={12} /></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-2.5">
              {[...b.columns].sort((a, c) => a.order - c.order).map((c, i) => (
                <span key={c.id} className="text-[10px] py-0.5 px-2 bg-surface-3 text-text-secondary rounded border border-border">{i + 1}. {c.name}</span>
              ))}
            </div>
            {(b.customFields || []).length > 0 && (
              <div className="mt-2 text-[11px] text-text-muted flex items-center gap-1"><Icons.fields size={12} /> {b.customFields.length} campo{b.customFields.length > 1 ? 's' : ''}</div>
            )}
            <div className="flex gap-4 mt-3.5 pt-3.5 border-t border-border">
              <span className="text-[11px] text-text-muted"><strong className="text-text-secondary">{b.columns.length}</strong> carriles</span>
              <span className="text-[11px] text-text-muted"><strong className="text-text-secondary">{cc}</strong> abiertos</span>
              <span className="text-[11px] text-text-muted"><strong className="text-text-secondary">{uc}</strong> usuarios</span>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default BoardManagement;
