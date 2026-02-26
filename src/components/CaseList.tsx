import React, { useState, useMemo } from 'react';
import type { Board, Card, User } from '@/types';
import { Icons } from './Icons';
import { formatShortDate } from '@/lib/storage';

interface CaseListProps {
  cards: Card[];
  boards: Board[];
  users: User[];
  onCardClick: (c: Card) => void;
}

const CaseList: React.FC<CaseListProps> = ({ cards, boards, users, onCardClick }) => {
  const [search, setSearch] = useState('');
  const [show, setShow] = useState<'active' | 'closed' | 'deleted'>('active');
  const [filterBoard, setFilterBoard] = useState('all');

  const filtered = useMemo(() => cards.filter(c => {
    if (show === 'active' && (c.deleted || c.closed)) return false;
    if (show === 'closed' && !c.closed) return false;
    if (show === 'deleted' && !c.deleted) return false;
    const ms = !search || (search.length >= 3 && c.code.toLowerCase().includes(search.toLowerCase()));
    return ms && (filterBoard === 'all' || c.boardId === filterBoard);
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [cards, search, show, filterBoard]);

  return (
    <div className="fade-in">
      <div className="flex gap-2.5 mb-4 items-center flex-wrap">
        <div className="relative flex-1 max-w-[280px]">
          <input className="w-full py-2 px-3.5 pl-8 bg-surface-2 border border-border rounded-lg text-foreground text-[13px] outline-none focus:border-primary placeholder:text-text-muted"
            placeholder="Mínimo 3 dígitos..." value={search} onChange={e => setSearch(e.target.value)} />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"><Icons.search size={14} /></span>
        </div>
        <select className="py-2 px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-[13px] outline-none cursor-pointer w-[200px]"
          value={filterBoard} onChange={e => setFilterBoard(e.target.value)}>
          <option value="all">Todos los Tableros</option>
          {boards.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="py-2 px-3.5 bg-surface-2 border border-border rounded-lg text-foreground text-[13px] outline-none cursor-pointer w-[140px]"
          value={show} onChange={e => setShow(e.target.value as any)}>
          <option value="active">Abiertos</option>
          <option value="closed">Cerrados</option>
          <option value="deleted">Eliminados</option>
        </select>
        <div className="flex-1" />
        <span className="text-[12px] text-text-muted">{filtered.length} casos</span>
      </div>

      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['ID', 'Tablero', 'Título', 'Carril', 'Responsable', 'Informador', 'Creado', ''].map(h => (
                <th key={h} className="text-left py-3 px-4 text-[11px] font-semibold text-text-muted uppercase tracking-wide bg-surface-2 border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const b = boards.find(x => x.id === c.boardId);
              const col = b?.columns.find(x => x.id === c.columnId);
              const a = users.find(u => u.id === c.assigneeId);
              return (
                <tr key={c.id} className="cursor-pointer hover:bg-surface-2 transition-colors" onClick={() => onCardClick(c)} style={c.deleted || c.closed ? { opacity: 0.6 } : {}}>
                  <td className="py-3 px-4 text-[12px] font-semibold text-primary whitespace-nowrap border-b border-border">{c.code}</td>
                  <td className="py-3 px-4 border-b border-border"><span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">{b?.prefix}</span></td>
                  <td className="py-3 px-4 text-[13px] text-foreground border-b border-border max-w-[260px] truncate">{c.title}</td>
                  <td className="py-3 px-4 text-[12px] text-text-secondary border-b border-border">{col?.name || '—'}</td>
                  <td className="py-3 px-4 text-[12px] border-b border-border">{a?.fullName || '—'}</td>
                  <td className="py-3 px-4 text-[12px] text-text-secondary border-b border-border">{c.reporterName}</td>
                  <td className="py-3 px-4 text-[12px] text-text-muted whitespace-nowrap border-b border-border">{formatShortDate(c.createdAt)}</td>
                  <td className="py-3 px-4 border-b border-border">
                    {c.closed ? <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-success/10 text-success">Cerrado</span>
                      : c.deleted ? <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/10 text-destructive">Elim.</span>
                      : <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">Abierto</span>}
                  </td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={8} className="text-center py-10 text-text-muted">No se encontraron casos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CaseList;
