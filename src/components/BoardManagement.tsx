import React, { useState } from 'react';
import type { Board, BoardLanding, Card, Column, CustomField, SapConfig, SpAutoImportConfig, User } from '@/types';
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
            <label className="block text-[12px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Nombre</label>
            <input className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary"
              value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="mb-4">
            <label className="block text-[12px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Prefijo</label>
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
                <span className="text-[12px] text-text-muted font-mono min-w-[24px] text-center">{i + 1}</span>
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
  const [useFormula, setUseFormula] = useState(false);
  const [formulaDays, setFormulaDays] = useState(15);
  const [error, setError] = useState('');

  const add = () => {
    if (!name.trim()) { setError('Nombre requerido'); return; }
    if (fields.find(f => f.name.toLowerCase() === name.trim().toLowerCase())) { setError('Ya existe'); return; }
    setError('');
    const newField: CustomField = {
      id: generateId(), name: name.trim(), type,
      options: type === 'dropdown' ? options.split(',').map(o => o.trim()).filter(Boolean) : [],
      ...(type === 'date' && useFormula ? { formula: 'createdAt', formulaDays } : {}),
    };
    setFields(p => [...p, newField]);
    setName(''); setOptions(''); setUseFormula(false); setFormulaDays(15);
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
                {f.formula === 'createdAt' && f.formulaDays !== undefined && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary"><Icons.formula size={9} /> +{f.formulaDays}d</span>
                )}
                {f.type === 'dropdown' && f.options.length > 0 && <span className="text-text-secondary flex-1 truncate">{f.options.join(', ')}</span>}
                <button className="px-2 py-1 bg-destructive/10 text-destructive rounded text-[12px] cursor-pointer" onClick={() => setFields(p => p.filter(x => x.id !== f.id))}><Icons.x size={12} /></button>
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
              <label className="block text-[12px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Nombre</label>
              <input className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary"
                value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Categoría" />
            </div>
            <div className="mb-2.5">
              <label className="block text-[12px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Tipo</label>
              <select className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none cursor-pointer"
                value={type} onChange={e => setType(e.target.value as CustomField['type'])}>
                {Object.entries(CF_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          {type === 'dropdown' && (
            <div className="mb-2.5">
              <label className="block text-[12px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Opciones (separadas por coma)</label>
              <input className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary"
                value={options} onChange={e => setOptions(e.target.value)} placeholder="Opción 1, Opción 2, Opción 3" />
            </div>
          )}
          {type === 'date' && (
            <div className="mb-2.5 p-3 bg-surface-3 border border-border rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4 accent-primary" checked={useFormula} onChange={e => setUseFormula(e.target.checked)} />
                <span className="text-[12px] font-semibold text-text-secondary flex items-center gap-1.5"><Icons.formula size={12} /> Calcular automáticamente</span>
              </label>
              {useFormula && (
                <div className="flex items-center gap-2 mt-2.5">
                  <span className="text-[12px] text-text-muted">Fecha de creación +</span>
                  <input type="number" min={1} max={365} className="w-16 py-1 px-2 bg-surface-2 border border-border rounded text-foreground text-[12px] outline-none focus:border-primary text-center"
                    value={formulaDays} onChange={e => setFormulaDays(Math.max(1, parseInt(e.target.value) || 1))} />
                  <span className="text-[12px] text-text-muted">días</span>
                </div>
              )}
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

/* ===== Landing Manager ===== */
interface LandingManagerProps {
  board: Board;
  onSave: (landing: BoardLanding) => void;
  onClose: () => void;
}

export const LandingManager: React.FC<LandingManagerProps> = ({ board, onSave, onClose }) => {
  const [enabled, setEnabled] = useState(board.landing?.enabled ?? false);
  const landingUrl = `${window.location.origin}/landing/${board.id}`;

  const copyUrl = () => { navigator.clipboard.writeText(landingUrl); };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-card border border-border rounded-[14px] w-[500px] max-h-[85vh] overflow-y-auto p-7 fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-[17px] font-bold text-foreground mb-1"><Icons.globe size={18} /> Landing Público</div>
        <div className="text-[12px] text-text-muted mb-5">{board.name}</div>

        <div className="p-4 bg-surface-2 border border-border rounded-lg mb-4">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setEnabled(p => !p)}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${enabled ? 'bg-success' : 'bg-surface-4 border border-border'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-foreground">{enabled ? 'Landing habilitado' : 'Landing deshabilitado'}</div>
              <div className="text-[12px] text-text-muted">Permite que personas externas creen casos sin usuario</div>
            </div>
          </label>
        </div>

        {enabled && (
          <div className="p-4 bg-success/5 border border-success/20 rounded-lg mb-4">
            <div className="text-[12px] font-semibold text-text-secondary uppercase tracking-wide mb-2">URL del Landing</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[12px] bg-surface-3 border border-border px-3 py-2 rounded text-foreground font-mono break-all">{landingUrl}</code>
              <button onClick={copyUrl} className="shrink-0 flex items-center gap-1 px-2.5 py-2 bg-surface-3 border border-border text-foreground rounded text-[12px] font-semibold cursor-pointer hover:bg-surface-4" title="Copiar URL">
                <Icons.copy size={12} />
              </button>
              <a href={landingUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="shrink-0 flex items-center gap-1 px-2.5 py-2 bg-surface-3 border border-border text-foreground rounded text-[12px] font-semibold hover:bg-surface-4" title="Abrir en nueva pestaña">
                <Icons.externalLink size={12} />
              </a>
            </div>
            <div className="mt-3 text-[12px] text-text-muted space-y-1">
              <div>• El responsable se asignará automáticamente al primer administrador del tablero</div>
              <div>• Se exigirá adjuntar al menos un archivo</div>
              <div>• Los campos con fórmula se calculan automáticamente</div>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end mt-6">
          <button className="px-5 py-2.5 bg-surface-3 text-foreground border border-border rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-surface-4" onClick={onClose}>Cancelar</button>
          <button className="px-5 py-2.5 bg-success text-success-foreground rounded-lg text-[13px] font-semibold cursor-pointer hover:brightness-110" onClick={() => onSave({ enabled })}>Guardar</button>
        </div>
      </div>
    </div>
  );
};

/* ===== SAP Manager ===== */
interface SapManagerProps {
  board: Board;
  onSave: (config: SapConfig | undefined) => void;
  onClose: () => void;
}

export const SapManager: React.FC<SapManagerProps> = ({ board, onSave, onClose }) => {
  const existing = board.sap;
  const [enabled, setEnabled] = useState(!!existing);
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? '');
  const [companyDB, setCompanyDB] = useState(existing?.companyDB ?? '');
  const [username, setUsername] = useState(existing?.username ?? '');
  const [password, setPassword] = useState(existing?.password ?? '');
  const [queryName, setQueryName] = useState(existing?.queryName ?? '');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const handleSave = () => {
    if (enabled) {
      if (!baseUrl.trim() || !companyDB.trim() || !username.trim() || !password.trim() || !queryName.trim()) {
        setError('Todos los campos son requeridos para habilitar SAP.');
        return;
      }
      onSave({ baseUrl: baseUrl.trim(), companyDB: companyDB.trim(), username: username.trim(), password: password.trim(), queryName: queryName.trim() });
    } else {
      onSave(undefined);
    }
  };

  const inp = 'w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary placeholder:text-text-muted';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-card border border-border rounded-[14px] w-[540px] max-h-[90vh] overflow-y-auto p-7 fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-[17px] font-bold text-foreground mb-1"><Icons.sap size={18} /> Integración SAP B1</div>
        <div className="text-[12px] text-text-muted mb-5">{board.name}</div>

        {error && <div className="p-3 rounded-lg text-[13px] mb-4 bg-destructive/10 text-destructive">{error}</div>}

        {/* Toggle */}
        <div className="p-4 bg-surface-2 border border-border rounded-lg mb-4">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setEnabled(p => !p)}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${enabled ? 'bg-primary' : 'bg-surface-4 border border-border'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-foreground">{enabled ? 'Integración SAP habilitada' : 'Integración SAP deshabilitada'}</div>
              <div className="text-[12px] text-text-muted">Permite buscar facturas/pedidos en SAP Business One desde el landing</div>
            </div>
          </label>
        </div>

        {enabled && (
          <div className="space-y-3">
            <div>
              <label className="block text-[12px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">URL de Service Layer</label>
              <input className={inp} value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://sap-server:50000" />
              <div className="text-[10px] text-text-muted mt-1">Sin barra final. Incluye el puerto (50000 por defecto).</div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Base de datos (CompanyDB)</label>
              <input className={inp} value={companyDB} onChange={e => setCompanyDB(e.target.value)} placeholder="ALLERS_PROD" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Usuario SAP SL</label>
                <input className={inp} value={username} onChange={e => setUsername(e.target.value)} placeholder="manager" />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Contraseña</label>
                <div className="relative">
                  <input className={inp + ' pr-10'} type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" />
                  <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-text-muted cursor-pointer p-1"
                    onClick={() => setShowPw(p => !p)}>{showPw ? <Icons.eyeOff size={15} /> : <Icons.eye size={15} />}</button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Nombre de la xSQL Query</label>
              <input className={inp + ' font-mono'} value={queryName} onChange={e => setQueryName(e.target.value)} placeholder="GetOrderDetails" />
              <div className="text-[10px] text-text-muted mt-1">
                Query predefinida en SAP SL que recibe el número de documento y devuelve: DocNum, ItemCount, TotalValue, DocCurrency, SalesPersonCode, SalesPersonName.
              </div>
            </div>
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-[12px] text-text-muted space-y-1">
              <div className="font-semibold text-text-secondary mb-1">Configuración de usuario:</div>
              <div>• En cada usuario del sistema asigna su <strong>ID SAP</strong> (SlpCode) para correlacionar con el vendedor SAP.</div>
              <div>• El campo ID SAP se encuentra en el formulario de Editar Usuario.</div>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end mt-6">
          <button className="px-5 py-2.5 bg-surface-3 text-foreground border border-border rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-surface-4" onClick={onClose}>Cancelar</button>
          <button className="px-5 py-2.5 bg-success text-success-foreground rounded-lg text-[13px] font-semibold cursor-pointer hover:brightness-110" onClick={handleSave}>Guardar</button>
        </div>
      </div>
    </div>
  );
};

/* ===== SP Auto-Import Manager ===== */
interface SpAutoImportManagerProps {
  board: Board;
  users: User[];
  onSave: (config: SpAutoImportConfig | undefined) => void;
  onClose: () => void;
}

export const SpAutoImportManager: React.FC<SpAutoImportManagerProps> = ({ board, users, onSave, onClose }) => {
  const existing = board.spAutoImport;
  const sortedCols = [...board.columns].sort((a, b) => a.order - b.order);
  const assignableUsers = users.filter(u => u.active && (u.isAdminTotal || u.boardRoles[board.id]));

  const [enabled, setEnabled] = useState(!!existing);
  const [spName, setSpName] = useState(existing?.spName ?? '');
  const [defaultAssigneeId, setDefaultAssigneeId] = useState(
    existing?.defaultAssigneeId ?? assignableUsers[0]?.id ?? ''
  );
  const [targetColumnId, setTargetColumnId] = useState(
    existing?.targetColumnId ?? sortedCols[0]?.id ?? ''
  );
  const [error, setError] = useState('');

  const handleSave = () => {
    if (enabled) {
      if (!spName.trim()) { setError('El nombre del SP es requerido.'); return; }
      if (!defaultAssigneeId) { setError('Selecciona un responsable por defecto.'); return; }
      onSave({ enabled: true, spName: spName.trim(), defaultAssigneeId, targetColumnId: targetColumnId || undefined });
    } else {
      onSave(undefined);
    }
  };

  const inp = 'w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary placeholder:text-text-muted';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-card border border-border rounded-[14px] w-[540px] max-h-[90vh] overflow-y-auto p-7 fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-[17px] font-bold text-foreground mb-1">
          <Icons.sync size={18} /> Importación Automática desde SP
        </div>
        <div className="text-[12px] text-text-muted mb-5">{board.name}</div>

        {error && <div className="p-3 rounded-lg text-[13px] mb-4 bg-destructive/10 text-destructive">{error}</div>}

        {/* Toggle */}
        <div className="p-4 bg-surface-2 border border-border rounded-lg mb-4">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setEnabled(p => !p)}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${enabled ? 'bg-warning' : 'bg-surface-4 border border-border'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-foreground">
                {enabled ? 'Importación habilitada' : 'Importación deshabilitada'}
              </div>
              <div className="text-[12px] text-text-muted">
                Permite crear casos automáticamente desde un stored procedure
              </div>
            </div>
          </label>
        </div>

        {enabled && (
          <div className="space-y-3">
            {/* SP Name */}
            <div>
              <label className="block text-[12px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                Nombre del Stored Procedure
              </label>
              <input
                className={inp + ' font-mono'}
                value={spName}
                onChange={e => setSpName(e.target.value)}
                placeholder="sp_GetCasosParaImportar"
              />
              <div className="text-[10px] text-text-muted mt-1">
                Nombre exacto del SP en la base de datos configurada en el backend.
              </div>
            </div>

            {/* Default Assignee */}
            <div>
              <label className="block text-[12px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                Responsable por Defecto
              </label>
              <select
                className={inp + ' cursor-pointer'}
                value={defaultAssigneeId}
                onChange={e => setDefaultAssigneeId(e.target.value)}>
                {assignableUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>
              <div className="text-[10px] text-text-muted mt-1">
                Usuario al que se asignarán los casos si el SP no especifica responsable.
              </div>
            </div>

            {/* Target Column */}
            {sortedCols.length > 0 && (
              <div>
                <label className="block text-[12px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">
                  Carril Destino
                </label>
                <select
                  className={inp + ' cursor-pointer'}
                  value={targetColumnId}
                  onChange={e => setTargetColumnId(e.target.value)}>
                  {sortedCols.map((c, i) => (
                    <option key={c.id} value={c.id}>{i + 1}. {c.name}</option>
                  ))}
                </select>
                <div className="text-[10px] text-text-muted mt-1">
                  Carril donde se colocarán los nuevos casos importados.
                </div>
              </div>
            )}

            {/* Info box */}
            <div className="p-3 bg-warning/5 border border-warning/20 rounded-lg text-[12px] text-text-muted space-y-1">
              <div className="font-semibold text-text-secondary mb-1">Funcionamiento:</div>
              <div>• El botón <strong>Importar desde SP</strong> aparece en el tablero Kanban.</div>
              <div>• Solo los casos con un <strong>ID externo nuevo</strong> se crean (sin duplicados).</div>
              <div>• Los campos personalizados se mapean por <strong>nombre exacto</strong> del campo.</div>
              <div>• La creación manual de casos sigue funcionando de forma independiente.</div>
              <div>• La cola de IDs garantiza que no haya choques entre creaciones manuales y automáticas.</div>
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end mt-6">
          <button className="px-5 py-2.5 bg-surface-3 text-foreground border border-border rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-surface-4" onClick={onClose}>Cancelar</button>
          <button className="px-5 py-2.5 bg-success text-success-foreground rounded-lg text-[13px] font-semibold cursor-pointer hover:brightness-110" onClick={handleSave}>Guardar</button>
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
  me: User;
  onCreate: () => void;
  onEdit: (b: Board) => void;
  onDelete: (b: Board) => void;
  onColumns: (b: Board) => void;
  onCustomFields: (b: Board) => void;
  onLanding: (b: Board) => void;
  onSap: (b: Board) => void;
  onSpAutoImport: (b: Board) => void;
}

const BoardManagement: React.FC<BoardManagementProps> = ({ boards, cards, users, me, onCreate, onEdit, onDelete, onColumns, onCustomFields, onLanding, onSap, onSpAutoImport }) => (
  <div className="fade-in">
    <div className="flex justify-end mb-4">
      <button className="flex items-center gap-1.5 px-3 py-[7px] bg-success text-success-foreground rounded-md text-[12px] font-semibold cursor-pointer hover:brightness-110"
        onClick={onCreate}><Icons.plus size={14} /> Nuevo</button>
    </div>
    <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
      {boards.map(b => {
        const uc = users.filter(u => u.isAdminTotal || u.boardRoles[b.id]).length;
        const cc = cards.filter(c => c.boardId === b.id && !c.deleted && !c.closed).length;
        const landingOn = b.landing?.enabled;
        return (
          <div key={b.id} className="bg-card border border-border rounded-[10px] p-5 hover:border-border-strong transition-colors">
            <div className="flex items-start justify-between mb-3.5">
              <div>
                <div className="text-[15px] font-bold text-foreground">{b.name}</div>
                <div className="text-[12px] text-primary font-semibold mt-0.5">{b.prefix}</div>
              </div>
              <div className="flex gap-1">
                {me.isAdminTotal && (
                  <button className={`px-2 py-1 border rounded text-[12px] font-semibold cursor-pointer ${b.spAutoImport?.enabled ? 'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20' : 'bg-surface-3 text-text-secondary border-border hover:bg-surface-4'}`}
                    title="Importación Automática desde SP" onClick={() => onSpAutoImport(b)}><Icons.sync size={12} /></button>
                )}
                {me.isAdminTotal && (
                  <button className={`px-2 py-1 border rounded text-[12px] font-semibold cursor-pointer ${b.sap ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20' : 'bg-surface-3 text-text-secondary border-border hover:bg-surface-4'}`}
                    title="Integración SAP B1" onClick={() => onSap(b)}><Icons.sap size={12} /></button>
                )}
                <button className={`px-2 py-1 border rounded text-[12px] font-semibold cursor-pointer ${landingOn ? 'bg-success/10 text-success border-success/30 hover:bg-success/20' : 'bg-surface-3 text-text-secondary border-border hover:bg-surface-4'}`}
                  title="Landing Público" onClick={() => onLanding(b)}><Icons.globe size={12} /></button>
                <button className="px-2 py-1 bg-surface-3 text-foreground border border-border rounded text-[12px] font-semibold cursor-pointer hover:bg-surface-4" title="Campos" onClick={() => onCustomFields(b)}><Icons.fields size={12} /></button>
                <button className="px-2 py-1 bg-surface-3 text-foreground border border-border rounded text-[12px] font-semibold cursor-pointer hover:bg-surface-4" title="Carriles" onClick={() => onColumns(b)}><Icons.columns size={12} /></button>
                <button className="px-2 py-1 bg-surface-3 text-foreground border border-border rounded text-[12px] font-semibold cursor-pointer hover:bg-surface-4" onClick={() => onEdit(b)}><Icons.edit size={12} /></button>
                <button className="px-2 py-1 bg-destructive/10 text-destructive rounded text-[12px] font-semibold cursor-pointer hover:bg-destructive/20" onClick={() => onDelete(b)}><Icons.trash size={12} /></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-2.5">
              {[...b.columns].sort((a, c) => a.order - c.order).map((c, i) => (
                <span key={c.id} className="text-[10px] py-0.5 px-2 bg-surface-3 text-text-secondary rounded border border-border">{i + 1}. {c.name}</span>
              ))}
            </div>
            {(b.customFields || []).length > 0 && (
              <div className="mt-2 text-[12px] text-text-muted flex items-center gap-1"><Icons.fields size={12} /> {b.customFields.length} campo{b.customFields.length > 1 ? 's' : ''}</div>
            )}
            <div className="flex gap-4 mt-3.5 pt-3.5 border-t border-border">
              <span className="text-[12px] text-text-muted"><strong className="text-text-secondary">{b.columns.length}</strong> carriles</span>
              <span className="text-[12px] text-text-muted"><strong className="text-text-secondary">{cc}</strong> abiertos</span>
              <span className="text-[12px] text-text-muted"><strong className="text-text-secondary">{uc}</strong> usuarios</span>
              {landingOn && <span className="text-[12px] text-success flex items-center gap-1"><Icons.globe size={10} /> Landing</span>}
              {me.isAdminTotal && b.sap && <span className="text-[12px] text-primary flex items-center gap-1"><Icons.sap size={10} /> SAP</span>}
              {me.isAdminTotal && b.spAutoImport?.enabled && <span className="text-[12px] text-warning flex items-center gap-1"><Icons.sync size={10} /> SP</span>}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

export default BoardManagement;
