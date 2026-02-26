import React, { useState, useMemo } from 'react';
import type { User, Board } from '@/types';
import { ROLE_LABELS } from '@/types';
import { Icons } from './Icons';
import { getInitials } from '@/lib/storage';

interface UserListProps {
  users: User[];
  me: User;
  boards: Board[];
  onEdit: (u: User) => void;
  onDelete: (u: User) => void;
  onCreate: () => void;
}

const roleBadgeClass: Record<string, string> = {
  admin_tablero: 'bg-warning/10 text-warning',
  ejecutor: 'bg-primary/10 text-primary',
  consulta: 'bg-surface-3 text-text-secondary',
};

const UserList: React.FC<UserListProps> = ({ users, me, boards, onEdit, onDelete, onCreate }) => {
  const [search, setSearch] = useState('');
  const [filterBoard, setFilterBoard] = useState('all');

  const filtered = useMemo(() => users.filter(u => {
    const ms = !search || u.fullName.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase());
    return ms && (filterBoard === 'all' || u.isAdminTotal || u.boardRoles[filterBoard]);
  }), [users, search, filterBoard]);

  return (
    <div className="fade-in">
      <div className="flex gap-2.5 mb-4 items-center">
        <div className="relative flex-1 max-w-[280px]">
          <input className="w-full py-2 px-3.5 pl-8 bg-surface-2 border border-border rounded-lg text-foreground text-[13px] outline-none focus:border-primary placeholder:text-text-muted"
            placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"><Icons.search size={14} /></span>
        </div>
        <select className="py-2 px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-[13px] outline-none cursor-pointer w-[220px]"
          value={filterBoard} onChange={e => setFilterBoard(e.target.value)}>
          <option value="all">Todos</option>
          {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="flex-1" />
        <button className="flex items-center gap-1.5 px-3 py-[7px] bg-success text-success-foreground rounded-md text-[12px] font-semibold cursor-pointer hover:brightness-110"
          onClick={onCreate}><Icons.plus size={14} /> Nuevo</button>
      </div>

      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Usuario', 'Nombre', 'Correo', 'Tipo', 'Tableros', 'Estado', ''].map(h => (
                <th key={h} className="text-left py-3 px-4 text-[11px] font-semibold text-text-muted uppercase tracking-wide bg-surface-2 border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-surface-2 transition-colors">
                <td className="py-3 px-4 text-[12px] font-mono text-foreground border-b border-border">{u.username}</td>
                <td className="py-3 px-4 text-[13px] font-medium text-foreground border-b border-border">{u.fullName}</td>
                <td className="py-3 px-4 text-[12px] text-text-secondary border-b border-border">{u.email || '—'}</td>
                <td className="py-3 px-4 border-b border-border">
                  {u.isAdminTotal
                    ? <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/10 text-destructive">Admin Total</span>
                    : <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-surface-3 text-text-secondary">Usuario</span>}
                </td>
                <td className="py-3 px-4 border-b border-border">
                  {u.isAdminTotal
                    ? <span className="text-[12px] text-text-muted italic">Todos</span>
                    : <div className="flex flex-wrap gap-1.5">{Object.entries(u.boardRoles).map(([bid, role]) => {
                      const b = boards.find(x => x.id === bid);
                      return b ? (
                        <span key={bid} className="inline-flex items-center gap-1 py-1 px-2.5 bg-surface-3 rounded-full text-[11px] text-text-secondary border border-border">
                          <span className="font-semibold">{b.prefix}</span>
                          <span className={`px-1.5 py-px rounded-full text-[10px] font-semibold ${roleBadgeClass[role]}`}>{ROLE_LABELS[role]}</span>
                        </span>
                      ) : null;
                    })}</div>}
                </td>
                <td className="py-3 px-4 border-b border-border">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${u.active ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {u.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-3 px-4 border-b border-border">
                  <div className="flex gap-1">
                    <button className="px-2 py-1 bg-surface-3 text-foreground border border-border rounded text-[11px] font-semibold cursor-pointer hover:bg-surface-4"
                      onClick={() => onEdit(u)}><Icons.edit size={12} /></button>
                    {u.id !== me.id && (
                      <button className="px-2 py-1 bg-destructive/10 text-destructive rounded text-[11px] font-semibold cursor-pointer hover:bg-destructive/20"
                        onClick={() => onDelete(u)}><Icons.trash size={12} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserList;
