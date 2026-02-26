import React from 'react';
import type { User, Board, Card } from '@/types';

interface DashboardProps {
  users: User[];
  boards: Board[];
  cards: Card[];
}

const Dashboard: React.FC<DashboardProps> = ({ users, boards, cards }) => {
  const activeCards = cards.filter(c => !c.deleted && !c.closed);

  return (
    <div className="fade-in">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5 mb-6">
        <div className="bg-card border border-border rounded-[10px] p-[18px]">
          <div className="text-[28px] font-bold text-foreground">{users.length}</div>
          <div className="text-[12px] text-text-muted mt-0.5">Usuarios</div>
        </div>
        <div className="bg-card border border-border rounded-[10px] p-[18px]">
          <div className="text-[28px] font-bold text-success">{users.filter(u => u.active).length}</div>
          <div className="text-[12px] text-text-muted mt-0.5">Activos</div>
        </div>
        <div className="bg-card border border-border rounded-[10px] p-[18px]">
          <div className="text-[28px] font-bold text-warning">{boards.length}</div>
          <div className="text-[12px] text-text-muted mt-0.5">Tableros</div>
        </div>
        <div className="bg-card border border-border rounded-[10px] p-[18px]">
          <div className="text-[28px] font-bold text-primary">{activeCards.length}</div>
          <div className="text-[12px] text-text-muted mt-0.5">Casos abiertos</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        <div className="py-4 px-4 border-b border-border">
          <span className="text-[14px] font-semibold text-foreground">Tableros</span>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Tablero', 'Prefijo', 'Carriles', 'Abiertos', 'Cerrados'].map(h => (
                <th key={h} className="text-left py-3 px-4 text-[11px] font-semibold text-text-muted uppercase tracking-wide bg-surface-2 border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {boards.map(b => (
              <tr key={b.id} className="hover:bg-surface-2 transition-colors">
                <td className="py-3 px-4 text-[13px] font-semibold text-foreground border-b border-border">{b.name}</td>
                <td className="py-3 px-4 text-[13px] border-b border-border"><span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">{b.prefix}</span></td>
                <td className="py-3 px-4 text-[13px] border-b border-border">{b.columns.length}</td>
                <td className="py-3 px-4 text-[13px] font-semibold border-b border-border">{activeCards.filter(c => c.boardId === b.id).length}</td>
                <td className="py-3 px-4 text-[13px] text-text-muted border-b border-border">{cards.filter(c => c.boardId === b.id && c.closed).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
