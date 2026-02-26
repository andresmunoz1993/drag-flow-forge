import React, { useState } from 'react';
import type { User, Board, RoleKey } from '@/types';
import { ROLE_LABELS } from '@/types';
import { Icons } from './Icons';

interface UserFormProps {
  user: User | null;
  onSave: (data: Partial<User>) => void;
  onClose: () => void;
  existingUsernames: string[];
  me: User;
  boards: Board[];
}

const roleBadgeClass: Record<string, string> = {
  admin_tablero: 'bg-warning/10 text-warning',
  ejecutor: 'bg-primary/10 text-primary',
  consulta: 'bg-surface-3 text-text-secondary',
};

const UserForm: React.FC<UserFormProps> = ({ user, onSave, onClose, existingUsernames, me, boards }) => {
  const isEdit = !!user;
  const [form, setForm] = useState({
    username: user?.username || '',
    password: user?.password || '',
    fullName: user?.fullName || '',
    email: user?.email || '',
    isAdminTotal: user?.isAdminTotal || false,
    active: user?.active !== undefined ? user.active : true,
    boardRoles: user?.boardRoles ? { ...user.boardRoles } : {} as Record<string, RoleKey>,
  });
  const [showPw, setShowPw] = useState(!isEdit);
  const [error, setError] = useState('');
  const [addBoard, setAddBoard] = useState('');
  const [addRole, setAddRole] = useState<RoleKey>('ejecutor');

  const isSelf = user?.id === me.id;
  const set = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }));

  const addBoardRole = () => {
    if (!addBoard) return;
    set('boardRoles', { ...form.boardRoles, [addBoard]: addRole });
    setAddBoard('');
  };

  const removeBoardRole = (bid: string) => {
    const br = { ...form.boardRoles };
    delete br[bid];
    set('boardRoles', br);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.username.trim() || !form.fullName.trim()) { setError('Campos requeridos'); return; }
    if (!isEdit && !form.password) { setError('Contraseña requerida'); return; }
    const un = form.username.trim().toLowerCase();
    if (existingUsernames.includes(un) && (!isEdit || un !== user!.username.toLowerCase())) { setError('Ya existe'); return; }
    onSave(form);
  };

  const available = boards.filter(b => !form.boardRoles[b.id]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-card border border-border rounded-[14px] w-[560px] max-h-[85vh] overflow-y-auto p-7 fade-in" onClick={e => e.stopPropagation()}>
        <div className="text-[17px] font-bold text-foreground mb-5">{isEdit ? 'Editar' : 'Crear'} Usuario</div>
        {error && <div className="p-3 rounded-lg text-[13px] mb-4 bg-destructive/10 text-destructive">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-x-3.5">
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Usuario</label>
              <input className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary placeholder:text-text-muted"
                value={form.username} onChange={e => set('username', e.target.value)} placeholder="Usuario" />
            </div>
            <div className="mb-4">
              <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">{isEdit ? 'Nueva Contraseña' : 'Contraseña'}</label>
              <div className="relative">
                <input className="w-full py-[11px] px-3.5 pr-10 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary placeholder:text-text-muted"
                  type={showPw ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder={isEdit ? '••••••' : 'Contraseña'} />
                <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-text-muted cursor-pointer p-1"
                  onClick={() => setShowPw(!showPw)}>{showPw ? <Icons.eyeOff size={16} /> : <Icons.eye size={16} />}</button>
              </div>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Nombre</label>
            <input className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary placeholder:text-text-muted"
              value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="Nombre completo" />
          </div>
          <div className="mb-4">
            <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Correo</label>
            <input className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none focus:border-primary placeholder:text-text-muted"
              type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@ejemplo.com" />
          </div>

          <div className="flex gap-6 mb-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-[22px] rounded-full relative cursor-pointer transition-colors border ${form.isAdminTotal ? 'bg-primary border-primary' : 'bg-surface-4 border-border'} ${isSelf ? 'opacity-50 !cursor-not-allowed' : ''}`}
                onClick={() => !isSelf && set('isAdminTotal', !form.isAdminTotal)}>
                <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-foreground rounded-full transition-transform ${form.isAdminTotal ? 'translate-x-[18px]' : ''}`} />
              </div>
              <span className="text-[13px] text-text-secondary">Admin Total</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-[22px] rounded-full relative cursor-pointer transition-colors border ${form.active ? 'bg-primary border-primary' : 'bg-surface-4 border-border'} ${isSelf ? 'opacity-50 !cursor-not-allowed' : ''}`}
                onClick={() => !isSelf && set('active', !form.active)}>
                <div className={`absolute top-[2px] left-[2px] w-4 h-4 bg-foreground rounded-full transition-transform ${form.active ? 'translate-x-[18px]' : ''}`} />
              </div>
              <span className="text-[13px] text-text-secondary">Activo</span>
            </div>
          </div>

          {!form.isAdminTotal && (
            <div className="mt-4 p-4 bg-surface-2 rounded-lg border border-border">
              <div className="text-[12px] font-semibold text-text-secondary mb-3 uppercase tracking-wide">Tableros</div>
              {Object.entries(form.boardRoles).map(([bid, role]) => {
                const b = boards.find(x => x.id === bid);
                return b ? (
                  <div key={bid} className="flex items-center justify-between py-2 border-b border-border">
                    <div>
                      <span className="text-[13px] text-foreground">{b.name}</span>
                      <span className={`ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${roleBadgeClass[role]}`}>{ROLE_LABELS[role]}</span>
                    </div>
                    <button type="button" className="px-2 py-1 bg-destructive/10 text-destructive rounded text-[11px] cursor-pointer" onClick={() => removeBoardRole(bid)}><Icons.x size={12} /></button>
                  </div>
                ) : null;
              })}
              {available.length > 0 && (
                <div className="flex gap-2 items-end mt-3">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Tablero</label>
                    <select className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none cursor-pointer"
                      value={addBoard} onChange={e => setAddBoard(e.target.value)}>
                      <option value="">—</option>
                      {available.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Rol</label>
                    <select className="w-full py-[11px] px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-sm outline-none cursor-pointer"
                      value={addRole} onChange={e => setAddRole(e.target.value as RoleKey)}>
                      <option value="admin_tablero">Admin Tablero</option>
                      <option value="ejecutor">Ejecutor</option>
                      <option value="consulta">Consulta</option>
                    </select>
                  </div>
                  <button type="button" className="h-[38px] px-3 py-2 bg-surface-3 text-foreground border border-border rounded-md text-[12px] font-semibold cursor-pointer hover:bg-surface-4"
                    onClick={addBoardRole} disabled={!addBoard}>+</button>
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

export default UserForm;
